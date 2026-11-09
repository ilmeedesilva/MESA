"""Scan a whole repository: discover its services, analyze them, apply policies.

Used by `mesa scan` and `mesa ci`. All paths in the result (source files and
service roots) are relative to `path_base`, normally the repository root, so a
report from a CI runner and one from a laptop look the same and GitHub can
link to the files.
"""

from __future__ import annotations

import re
from pathlib import Path

from mesa.analysis import analyze_services
from mesa.analysis.extractor import relative_source_path
from mesa.analysis.governance import evaluate_policies, parse_policy_document
from mesa.analysis.recommendations import enrich_findings_with_recommendations
from mesa.config import ConfigError, MesaConfig
from mesa.discovery import discover_service_candidates
from mesa.models import AnalysisResult, PolicyRecord


def discover_services(root: Path, config: MesaConfig) -> list[Path]:
    """The service folders to analyze under `root`, sorted."""
    candidates = discover_service_candidates(
        root,
        exclude=config.services.all_excludes(),
        include=config.services.include,
        drop_root_when_nested=True,
    )
    if config.services.include:
        chosen = candidates  # listed explicitly: keep every match
    else:
        chosen = [c for c in candidates if c.selected_by_default] or candidates
    resolved = root.resolve()
    return sorted(resolved / c.relative_path for c in chosen)


def load_policies(path: Path) -> list[PolicyRecord]:
    try:
        documents = parse_policy_document(path.read_text(encoding="utf-8"))
    except OSError as error:
        raise ConfigError(f"Could not read policy file {path}: {error}") from error
    except ValueError as error:
        raise ConfigError(f"Invalid policy file {path}: {error}") from error
    return [
        PolicyRecord(
            id=policy.id or _slug(policy.name),
            project_id="cli",
            name=policy.name,
            rule=policy.rule,
            severity=policy.severity,
            description=policy.description,
            enabled=policy.enabled,
        )
        for policy in documents
    ]


def scan_repository(
    root: Path,
    config: MesaConfig,
    *,
    path_base: Path | None = None,
    policy_path: Path | None = None,
) -> AnalysisResult:
    root = root.resolve()
    base = (path_base or root).resolve()
    services = discover_services(root, config)
    result = analyze_services(
        [str(path) for path in services], config.chatty_threshold, path_base=base
    )
    apply_policies(result, policy_path or config.policies_path())

    for service in result.services:
        service.root_path = relative_source_path(service.root_path, base)
    for node in result.graph.get("nodes", []):
        if isinstance(node.get("root_path"), str):
            node["root_path"] = relative_source_path(node["root_path"], base)
    result.summary["selected_service_paths"] = [
        relative_source_path(str(path), base) for path in services
    ]
    return result


def apply_policies(result: AnalysisResult, policy_path: Path | None) -> None:
    if policy_path is None:
        return
    policy_findings = evaluate_policies(result, load_policies(policy_path))
    if not policy_findings:
        return
    result.findings.extend(policy_findings)
    result.findings = enrich_findings_with_recommendations(result.findings)
    counts_by_type: dict[str, int] = {}
    counts_by_severity: dict[str, int] = {}
    for finding in result.findings:
        counts_by_type[finding.type.value] = counts_by_type.get(finding.type.value, 0) + 1
        counts_by_severity[finding.severity.value] = (
            counts_by_severity.get(finding.severity.value, 0) + 1
        )
    result.summary["finding_count"] = len(result.findings)
    result.summary["findings_by_type"] = counts_by_type
    result.summary["findings_by_severity"] = counts_by_severity


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "policy"
