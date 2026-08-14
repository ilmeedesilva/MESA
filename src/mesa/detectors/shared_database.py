from __future__ import annotations

from collections import defaultdict

import networkx as nx

from mesa.detectors.base import Detector
from mesa.detectors.evidence import evidence_chain_item, source_files_from_evidence
from mesa.models import Finding, FindingType, Severity


class SharedDatabaseDetector(Detector):
    def detect(self, graph: nx.MultiDiGraph) -> list[Finding]:
        db_users: dict[str, set[str]] = defaultdict(set)
        evidence_by_db: dict[str, list[dict]] = defaultdict(list)

        for source, target, data in graph.edges(data=True):
            if data.get("type") != "uses_database":
                continue
            db_key = graph.nodes[target].get("key", target)
            db_users[db_key].add(source)
            evidence_by_db[db_key].append(
                {"service": source, "database": db_key, "source": data.get("source")}
            )

        findings: list[Finding] = []
        index = 1
        for db_key, services in sorted(db_users.items()):
            if len(services) < 2:
                continue
            service_list = sorted(services)
            evidence = evidence_by_db[db_key]
            findings.append(
                Finding(
                    id=f"MESA-SHDB-{index:03d}",
                    type=FindingType.SHARED_DATABASE,
                    severity=Severity.CRITICAL if len(service_list) == 2 else Severity.HIGH,
                    confidence=0.88,
                    services=service_list,
                    description=f"{', '.join(service_list)} share database {db_key}.",
                    evidence=evidence,
                    recommendation=(
                        "Assign one service as the data owner and remove direct database access "
                        "from the others. Replace shared persistence with service APIs, events, "
                        "or CQRS read models depending on consistency needs."
                    ),
                    detector_name="SharedDatabaseDetector",
                    rule_id="shared-database.multiple-service-users",
                    evidence_chain=[
                        evidence_chain_item(
                            "collect_database_edges",
                            f"Collected database usage edges for {db_key}.",
                            source=evidence[0].get("source") if evidence else None,
                            data={"database": db_key, "usage_count": len(evidence)},
                        ),
                        evidence_chain_item(
                            "group_by_database",
                            f"Grouped {len(service_list)} services that reference the same database key.",
                            data={"database": db_key, "services": service_list},
                        ),
                    ],
                    confidence_reason=(
                        f"Confidence is high because {len(service_list)} services contain static "
                        f"database connection evidence for the same database key."
                    ),
                    limitations=[
                        "Static connection strings do not prove concurrent runtime writes.",
                        "The detector cannot yet distinguish read-only replicas from shared ownership.",
                    ],
                    source_files=source_files_from_evidence(evidence),
                    related_services=service_list,
                    why_valid=(
                        f"MESA found database usage evidence linking {', '.join(service_list)} "
                        f"to {db_key}, which indicates likely shared persistence ownership."
                    ),
                )
            )
            index += 1
        return findings
