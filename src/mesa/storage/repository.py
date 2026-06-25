from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
import time
from typing import Protocol
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from mesa.analysis.health import flatten_health_scores
from mesa.models import (
    AnalysisResult,
    Finding,
    HealthScore,
    PolicyCreate,
    PolicyRecord,
    ProjectCreate,
    ProjectRecord,
    RepoSourceMetadata,
    ScanRecord,
    SnapshotRecord,
)


class PersistenceRepository(Protocol):
    def _connect(self, **kwargs):
        last_error: Exception | None = None
        for _ in range(10):
            try:
                return psycopg.connect(self.dsn, **kwargs)
            except psycopg.OperationalError as error:
                last_error = error
                time.sleep(0.5)
        if last_error is not None:
            raise last_error
        raise RuntimeError("Could not connect to PostgreSQL")

    def initialize(self) -> None:
        ...

    def create_project(self, data: ProjectCreate) -> ProjectRecord:
        ...

    def get_project(self, project_id: str) -> ProjectRecord | None:
        ...

    def save_scan_result(
        self,
        project_id: str,
        result: AnalysisResult,
        source_metadata: RepoSourceMetadata | None = None,
    ) -> ScanRecord:
        ...

    def get_scan(self, scan_id: str) -> ScanRecord | None:
        ...

    def get_scan_result(self, scan_id: str) -> AnalysisResult | None:
        ...

    def list_scans(self, project_id: str) -> list[ScanRecord]:
        ...

    def list_findings(self, scan_id: str) -> list[Finding]:
        ...

    def list_scores(self, scan_id: str) -> list[HealthScore]:
        ...

    def list_snapshots(self, project_id: str) -> list[SnapshotRecord]:
        ...

    def create_policy(self, project_id: str, data: PolicyCreate) -> PolicyRecord:
        ...

    def update_policy(self, project_id: str, policy_id: str, data: PolicyCreate) -> PolicyRecord | None:
        ...

    def list_policies(self, project_id: str) -> list[PolicyRecord]:
        ...

    def upsert_policies(self, project_id: str, policies: list[PolicyCreate]) -> list[PolicyRecord]:
        ...


class InMemoryPersistenceRepository:
    def __init__(self) -> None:
        self.projects: dict[str, ProjectRecord] = {}
        self.scans: dict[str, ScanRecord] = {}
        self.results: dict[str, AnalysisResult] = {}
        self.snapshots: dict[str, SnapshotRecord] = {}
        self.policies: dict[str, PolicyRecord] = {}

    def _connect(self, **kwargs):
        last_error: Exception | None = None
        for _ in range(10):
            try:
                return psycopg.connect(self.dsn, **kwargs)
            except psycopg.OperationalError as error:
                last_error = error
                time.sleep(0.5)
        if last_error is not None:
            raise last_error
        raise RuntimeError("Could not connect to PostgreSQL")

    def initialize(self) -> None:
        return None

    def create_project(self, data: ProjectCreate) -> ProjectRecord:
        project = ProjectRecord(
            name=data.name,
            description=data.description,
            root_path=data.root_path,
            created_at=_now_iso(),
        )
        self.projects[project.id] = project
        return project

    def get_project(self, project_id: str) -> ProjectRecord | None:
        return self.projects.get(project_id)

    def save_scan_result(
        self,
        project_id: str,
        result: AnalysisResult,
        source_metadata: RepoSourceMetadata | None = None,
    ) -> ScanRecord:
        scan = ScanRecord(
            id=str(uuid4()),
            project_id=project_id,
            status="COMPLETED",
            service_count=result.summary["service_count"],
            finding_count=result.summary["finding_count"],
            source_type=source_metadata.source_type if source_metadata else None,
            source_label=source_metadata.source_label if source_metadata else None,
            repo_url=source_metadata.repo_url if source_metadata else None,
            repo_provider=source_metadata.repo_provider if source_metadata else None,
            repo_ref=source_metadata.repo_ref if source_metadata else None,
            commit_sha=source_metadata.commit_sha if source_metadata else None,
            created_at=_now_iso(),
            completed_at=_now_iso(),
        )
        self.scans[scan.id] = scan
        self.results[scan.id] = result
        snapshot = SnapshotRecord(
            id=str(uuid4()),
            project_id=project_id,
            scan_id=scan.id,
            graph=result.graph,
            created_at=scan.completed_at,
        )
        self.snapshots[snapshot.id] = snapshot
        return scan

    def get_scan(self, scan_id: str) -> ScanRecord | None:
        return self.scans.get(scan_id)

    def get_scan_result(self, scan_id: str) -> AnalysisResult | None:
        return self.results.get(scan_id)

    def list_scans(self, project_id: str) -> list[ScanRecord]:
        scans = [scan for scan in self.scans.values() if scan.project_id == project_id]
        return sorted(scans, key=lambda scan: scan.created_at or "", reverse=True)

    def list_findings(self, scan_id: str) -> list[Finding]:
        result = self.results.get(scan_id)
        return result.findings if result else []

    def list_scores(self, scan_id: str) -> list[HealthScore]:
        result = self.results.get(scan_id)
        if not result:
            return []
        return flatten_health_scores(result.summary.get("health_scores", {}))

    def list_snapshots(self, project_id: str) -> list[SnapshotRecord]:
        snapshots = [snapshot for snapshot in self.snapshots.values() if snapshot.project_id == project_id]
        return sorted(snapshots, key=lambda snapshot: snapshot.created_at or "", reverse=True)

    def create_policy(self, project_id: str, data: PolicyCreate) -> PolicyRecord:
        policy_id = data.id or str(uuid4())
        policy = PolicyRecord(
            id=policy_id,
            project_id=project_id,
            name=data.name,
            rule=data.rule,
            severity=data.severity,
            description=data.description,
            enabled=data.enabled,
            created_at=_now_iso(),
            updated_at=_now_iso(),
        )
        self.policies[policy.id] = policy
        return policy

    def update_policy(self, project_id: str, policy_id: str, data: PolicyCreate) -> PolicyRecord | None:
        existing = self.policies.get(policy_id)
        if existing is None or existing.project_id != project_id:
            return None
        updated = existing.model_copy(
            update={
                "name": data.name,
                "rule": data.rule,
                "severity": data.severity,
                "description": data.description,
                "enabled": data.enabled,
                "updated_at": _now_iso(),
            }
        )
        self.policies[policy_id] = updated
        return updated

    def list_policies(self, project_id: str) -> list[PolicyRecord]:
        return sorted(
            [policy for policy in self.policies.values() if policy.project_id == project_id],
            key=lambda policy: policy.id,
        )

    def upsert_policies(self, project_id: str, policies: list[PolicyCreate]) -> list[PolicyRecord]:
        records = []
        for policy in policies:
            policy_id = policy.id or str(uuid4())
            updated = self.update_policy(project_id, policy_id, policy)
            records.append(updated if updated else self.create_policy(project_id, policy.model_copy(update={"id": policy_id})))
        return records


class PostgresPersistenceRepository:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def _connect(self, **kwargs):
        last_error: Exception | None = None
        for _ in range(10):
            try:
                return psycopg.connect(self.dsn, **kwargs)
            except psycopg.OperationalError as error:
                last_error = error
                time.sleep(0.5)
        if last_error is not None:
            raise last_error
        raise RuntimeError("Could not connect to PostgreSQL")

    def initialize(self) -> None:
        migration = (Path(__file__).parent / "migrations" / "001_persistence_foundation.sql").read_text(encoding="utf-8")
        with self._connect() as connection:
            connection.execute(migration)

    def create_project(self, data: ProjectCreate) -> ProjectRecord:
        project_id = str(uuid4())
        with self._connect(row_factory=dict_row) as connection:
            row = connection.execute(
                """
                INSERT INTO projects (id, name, description, root_path)
                VALUES (%s, %s, %s, %s)
                RETURNING id, name, description, root_path, created_at::text
                """,
                (project_id, data.name, data.description, data.root_path),
            ).fetchone()
        return ProjectRecord(**row)

    def get_project(self, project_id: str) -> ProjectRecord | None:
        with self._connect(row_factory=dict_row) as connection:
            row = connection.execute(
                """
                SELECT id, name, description, root_path, created_at::text
                FROM projects
                WHERE id = %s
                """,
                (project_id,),
            ).fetchone()
        return ProjectRecord(**row) if row else None

    def save_scan_result(
        self,
        project_id: str,
        result: AnalysisResult,
        source_metadata: RepoSourceMetadata | None = None,
    ) -> ScanRecord:
        scan_id = str(uuid4())
        snapshot_id = str(uuid4())
        with self._connect(row_factory=dict_row) as connection:
            row = connection.execute(
                """
                INSERT INTO scans (
                    id, project_id, status, service_count, finding_count, source_type,
                    source_label, repo_url, repo_provider, repo_ref, commit_sha, completed_at
                )
                VALUES (%s, %s, 'COMPLETED', %s, %s, %s, %s, %s, %s, %s, %s, now())
                RETURNING id, project_id, status, service_count, finding_count,
                          source_type, source_label, repo_url, repo_provider, repo_ref, commit_sha,
                          created_at::text, completed_at::text
                """,
                (
                    scan_id,
                    project_id,
                    result.summary["service_count"],
                    result.summary["finding_count"],
                    source_metadata.source_type.value if source_metadata else None,
                    source_metadata.source_label if source_metadata else None,
                    source_metadata.repo_url if source_metadata else None,
                    source_metadata.repo_provider if source_metadata else None,
                    source_metadata.repo_ref if source_metadata else None,
                    source_metadata.commit_sha if source_metadata else None,
                ),
            ).fetchone()

            for service in result.services:
                connection.execute(
                    """
                    INSERT INTO services (
                        scan_id, name, root_path, language, endpoint_count,
                        outbound_call_count, database_count
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        scan_id, service.name, service.root_path, service.language,
                        len(service.endpoints), len(service.calls), len(service.databases),
                    ),
                )

            for edge in result.graph["edges"]:
                if str(edge.get("source", "")).startswith("db:") or str(edge.get("target", "")).startswith("db:"):
                    continue
                connection.execute(
                    """
                    INSERT INTO dependencies (
                        scan_id, source_service, target_service, dependency_type, evidence
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (scan_id, edge["source"], edge["target"], edge.get("type", "unknown"), Jsonb(edge)),
                )

            for finding in result.findings:
                connection.execute(
                    """
                    INSERT INTO findings (
                        id, scan_id, type, severity, confidence, services,
                        description, evidence, recommendation
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        finding.id, scan_id, finding.type.value, finding.severity.value,
                        finding.confidence, Jsonb(finding.services), finding.description,
                        Jsonb(finding.evidence), finding.recommendation,
                    ),
                )

            for score in flatten_health_scores(result.summary.get("health_scores", {})):
                connection.execute(
                    """
                    INSERT INTO scores (scan_id, scope, target, score, breakdown)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        scan_id, score.scope, score.target, score.score,
                        Jsonb(score.model_dump(mode="json")),
                    ),
                )

            connection.execute(
                "INSERT INTO reports (scan_id, content) VALUES (%s, %s)",
                (scan_id, Jsonb(result.model_dump(mode="json"))),
            )
            connection.execute(
                """
                INSERT INTO snapshots (id, project_id, scan_id, graph)
                VALUES (%s, %s, %s, %s)
                """,
                (snapshot_id, project_id, scan_id, Jsonb(result.graph)),
            )
        return ScanRecord(**row)

    def get_scan(self, scan_id: str) -> ScanRecord | None:
        with self._connect(row_factory=dict_row) as connection:
            row = connection.execute(
                """
                SELECT id, project_id, status, service_count, finding_count,
                       source_type, source_label, repo_url, repo_provider, repo_ref, commit_sha,
                       created_at::text, completed_at::text
                FROM scans
                WHERE id = %s
                """,
                (scan_id,),
            ).fetchone()
        return ScanRecord(**row) if row else None

    def get_scan_result(self, scan_id: str) -> AnalysisResult | None:
        with self._connect(row_factory=dict_row) as connection:
            row = connection.execute(
                "SELECT content FROM reports WHERE scan_id = %s ORDER BY id DESC LIMIT 1",
                (scan_id,),
            ).fetchone()
        return AnalysisResult.model_validate(row["content"]) if row else None

    def list_scans(self, project_id: str) -> list[ScanRecord]:
        with self._connect(row_factory=dict_row) as connection:
            rows = connection.execute(
                """
                SELECT id, project_id, status, service_count, finding_count,
                       source_type, source_label, repo_url, repo_provider, repo_ref, commit_sha,
                       created_at::text, completed_at::text
                FROM scans
                WHERE project_id = %s
                ORDER BY created_at DESC
                """,
                (project_id,),
            ).fetchall()
        return [ScanRecord(**row) for row in rows]

    def list_findings(self, scan_id: str) -> list[Finding]:
        result = self.get_scan_result(scan_id)
        return result.findings if result else []

    def list_scores(self, scan_id: str) -> list[HealthScore]:
        with self._connect(row_factory=dict_row) as connection:
            rows = connection.execute(
                """
                SELECT breakdown
                FROM scores
                WHERE scan_id = %s
                ORDER BY CASE scope
                    WHEN 'system' THEN 0
                    WHEN 'domain' THEN 1
                    WHEN 'service' THEN 2
                    ELSE 3
                END, target ASC
                """,
                (scan_id,),
            ).fetchall()
        if rows:
            return [HealthScore.model_validate(row["breakdown"]) for row in rows]
        result = self.get_scan_result(scan_id)
        if not result:
            return []
        return flatten_health_scores(result.summary.get("health_scores", {}))

    def list_snapshots(self, project_id: str) -> list[SnapshotRecord]:
        with self._connect(row_factory=dict_row) as connection:
            rows = connection.execute(
                """
                SELECT id, project_id, scan_id, graph, created_at::text
                FROM snapshots
                WHERE project_id = %s
                ORDER BY created_at DESC
                """,
                (project_id,),
            ).fetchall()
        return [SnapshotRecord(**row) for row in rows]

    def create_policy(self, project_id: str, data: PolicyCreate) -> PolicyRecord:
        policy_id = data.id or str(uuid4())
        with self._connect(row_factory=dict_row) as connection:
            row = connection.execute(
                """
                INSERT INTO policies (id, project_id, name, rule, severity, description, enabled)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, project_id, name, rule, severity, description, enabled,
                          created_at::text, updated_at::text
                """,
                (
                    policy_id, project_id, data.name, data.rule, data.severity.value,
                    data.description, data.enabled,
                ),
            ).fetchone()
        return PolicyRecord(**row)

    def update_policy(self, project_id: str, policy_id: str, data: PolicyCreate) -> PolicyRecord | None:
        with self._connect(row_factory=dict_row) as connection:
            row = connection.execute(
                """
                UPDATE policies
                SET name = %s, rule = %s, severity = %s, description = %s,
                    enabled = %s, updated_at = now()
                WHERE project_id = %s AND id = %s
                RETURNING id, project_id, name, rule, severity, description, enabled,
                          created_at::text, updated_at::text
                """,
                (
                    data.name, data.rule, data.severity.value, data.description,
                    data.enabled, project_id, policy_id,
                ),
            ).fetchone()
        return PolicyRecord(**row) if row else None

    def list_policies(self, project_id: str) -> list[PolicyRecord]:
        with self._connect(row_factory=dict_row) as connection:
            rows = connection.execute(
                """
                SELECT id, project_id, name, rule, severity, description, enabled,
                       created_at::text, updated_at::text
                FROM policies
                WHERE project_id = %s
                ORDER BY id ASC
                """,
                (project_id,),
            ).fetchall()
        return [PolicyRecord(**row) for row in rows]

    def upsert_policies(self, project_id: str, policies: list[PolicyCreate]) -> list[PolicyRecord]:
        records = []
        for policy in policies:
            policy_id = policy.id or str(uuid4())
            updated = self.update_policy(project_id, policy_id, policy)
            records.append(updated if updated else self.create_policy(project_id, policy.model_copy(update={"id": policy_id})))
        return records


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()
