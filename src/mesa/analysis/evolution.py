from __future__ import annotations

from collections import Counter
from typing import Any

from mesa.models import AnalysisResult, EvolutionReport, Finding, FindingType, Severity

_SEVERITY_RANK = {
    Severity.LOW.value: 1,
    Severity.MEDIUM.value: 2,
    Severity.HIGH.value: 3,
    Severity.CRITICAL.value: 4,
}


def compare_scan_results(
    project_id: str,
    base_scan_id: str,
    base_result: AnalysisResult,
    target_scan_id: str,
    target_result: AnalysisResult,
) -> EvolutionReport:
    """Compare two architecture scan results as deterministic architecture snapshots."""
    base_snapshot = _snapshot(base_result)
    target_snapshot = _snapshot(target_result)

    new_risks = _finding_summaries(target_snapshot["findings"] - base_snapshot["findings"], target_result.findings)
    resolved_risks = _finding_summaries(base_snapshot["findings"] - target_snapshot["findings"], base_result.findings)
    worsened_risks = _worsened_risks(base_result.findings, target_result.findings)

    new_dependencies = _dependency_summaries(target_snapshot["dependencies"] - base_snapshot["dependencies"])
    removed_dependencies = _dependency_summaries(base_snapshot["dependencies"] - target_snapshot["dependencies"])
    new_cycles = _cycle_summaries(target_snapshot["cycles"] - base_snapshot["cycles"])
    removed_cycles = _cycle_summaries(base_snapshot["cycles"] - target_snapshot["cycles"])

    score_trend = _score_trend(base_result, target_result)
    service_level_changes = _service_level_changes(base_result, target_result)
    risk_trend = _risk_trend(base_result.findings, target_result.findings, new_risks, resolved_risks, worsened_risks)

    recommendations = _recommendations(
        new_risks=new_risks,
        resolved_risks=resolved_risks,
        worsened_risks=worsened_risks,
        new_dependencies=new_dependencies,
        removed_dependencies=removed_dependencies,
        score_trend=score_trend,
        new_cycles=new_cycles,
    )

    return EvolutionReport(
        project_id=project_id,
        base_scan_id=base_scan_id,
        target_scan_id=target_scan_id,
        architecture_change_summary={
            "services_previous": len(base_snapshot["services"]),
            "services_current": len(target_snapshot["services"]),
            "new_services": sorted(target_snapshot["services"] - base_snapshot["services"]),
            "removed_services": sorted(base_snapshot["services"] - target_snapshot["services"]),
            "dependency_delta": len(new_dependencies) - len(removed_dependencies),
            "risk_delta": len(new_risks) - len(resolved_risks),
            "summary": _summary_sentence(new_risks, resolved_risks, new_dependencies, removed_dependencies, score_trend),
        },
        risk_trend=risk_trend,
        score_trend=score_trend,
        service_level_changes=service_level_changes,
        new_dependencies=new_dependencies,
        removed_dependencies=removed_dependencies,
        new_cycles=new_cycles,
        removed_cycles=removed_cycles,
        recommendations=recommendations,
    )


def _snapshot(result: AnalysisResult) -> dict[str, Any]:
    return {
        "services": {service.name for service in result.services},
        "dependencies": {_dependency_key(edge) for edge in result.graph.get("edges", []) if _dependency_key(edge)},
        "findings": {_finding_key(finding) for finding in result.findings},
        "cycles": {_cycle_key(finding) for finding in result.findings if finding.type == FindingType.CYCLIC_DEPENDENCY},
    }


def _dependency_key(edge: dict[str, Any]) -> tuple[str, str, str] | None:
    source = str(edge.get("source", "")).strip()
    target = str(edge.get("target", "")).strip()
    edge_type = str(edge.get("type", "depends")).strip() or "depends"
    if not source or not target or source == target:
        return None
    return (source, target, edge_type)


def _finding_key(finding: Finding) -> tuple[str, tuple[str, ...]]:
    return (finding.type.value, tuple(sorted(finding.services)))


def _cycle_key(finding: Finding) -> tuple[str, ...]:
    for evidence in finding.evidence:
        cycle = evidence.get("cycle") or evidence.get("services")
        if isinstance(cycle, list) and cycle:
            return tuple(str(service) for service in cycle)
    return tuple(sorted(finding.services))


def _finding_summaries(keys: set[tuple[str, tuple[str, ...]]], findings: list[Finding]) -> list[dict[str, Any]]:
    by_key = {_finding_key(finding): finding for finding in findings}
    summaries = []
    for key in sorted(keys):
        finding = by_key.get(key)
        summaries.append(
            {
                "type": key[0],
                "services": list(key[1]),
                "severity": finding.severity.value if finding else "UNKNOWN",
                "confidence": finding.confidence if finding else 0.0,
                "description": finding.description if finding else "Risk changed between snapshots.",
            }
        )
    return summaries


def _dependency_summaries(keys: set[tuple[str, str, str]]) -> list[dict[str, Any]]:
    return [
        {"source": source, "target": target, "type": edge_type}
        for source, target, edge_type in sorted(keys)
    ]


def _cycle_summaries(keys: set[tuple[str, ...]]) -> list[dict[str, Any]]:
    return [{"services": list(cycle), "length": len(cycle)} for cycle in sorted(keys)]


def _worsened_risks(base_findings: list[Finding], target_findings: list[Finding]) -> list[dict[str, Any]]:
    base_by_key = {_finding_key(finding): finding for finding in base_findings}
    target_by_key = {_finding_key(finding): finding for finding in target_findings}
    worsened = []
    for key in sorted(base_by_key.keys() & target_by_key.keys()):
        previous = base_by_key[key]
        current = target_by_key[key]
        if _SEVERITY_RANK[current.severity.value] > _SEVERITY_RANK[previous.severity.value]:
            worsened.append(
                {
                    "type": key[0],
                    "services": list(key[1]),
                    "previous_severity": previous.severity.value,
                    "current_severity": current.severity.value,
                }
            )
    return worsened


def _score_trend(base_result: AnalysisResult, target_result: AnalysisResult) -> dict[str, Any]:
    base_scores = _scores_by_scope_target(base_result)
    target_scores = _scores_by_scope_target(target_result)
    system_key = ("system", "system")
    previous = base_scores.get(system_key)
    current = target_scores.get(system_key)
    service_deltas = []
    for key in sorted(base_scores.keys() | target_scores.keys()):
        if key[0] != "service":
            continue
        before = base_scores.get(key)
        after = target_scores.get(key)
        if before is None or after is None:
            continue
        delta = round(after - before, 2)
        if abs(delta) >= 0.01:
            service_deltas.append({"service": key[1], "previous": before, "current": after, "delta": delta})
    return {
        "system_previous": previous,
        "system_current": current,
        "system_delta": round(current - previous, 2) if previous is not None and current is not None else None,
        "improved_services": [item for item in service_deltas if item["delta"] > 0],
        "worsened_services": [item for item in service_deltas if item["delta"] < 0],
    }


def _scores_by_scope_target(result: AnalysisResult) -> dict[tuple[str, str], float]:
    health = result.summary.get("health_scores", {})
    scores = {}
    for scope in ("service", "domain"):
        for score in health.get(scope, []):
            scores[(str(score.get("scope", scope)), str(score.get("target", "")))] = float(score.get("score", 0.0))
    system = health.get("system")
    if system:
        scores[("system", str(system.get("target", "system")))] = float(system.get("score", 0.0))
    return scores


def _service_level_changes(base_result: AnalysisResult, target_result: AnalysisResult) -> list[dict[str, Any]]:
    base_services = {service.name: service for service in base_result.services}
    target_services = {service.name: service for service in target_result.services}
    finding_counts = {
        "base": Counter(service for finding in base_result.findings for service in finding.services),
        "target": Counter(service for finding in target_result.findings for service in finding.services),
    }
    changes = []
    for service in sorted(base_services.keys() | target_services.keys()):
        before = base_services.get(service)
        after = target_services.get(service)
        status = "changed"
        if before is None:
            status = "new"
        elif after is None:
            status = "removed"
        file_delta = (after.file_count if after else 0) - (before.file_count if before else 0)
        finding_delta = finding_counts["target"][service] - finding_counts["base"][service]
        if status != "changed" or file_delta or finding_delta:
            changes.append(
                {
                    "service": service,
                    "status": status,
                    "file_delta": file_delta,
                    "finding_delta": finding_delta,
                    "endpoint_delta": (len(after.endpoints) if after else 0) - (len(before.endpoints) if before else 0),
                    "database_delta": (len(after.databases) if after else 0) - (len(before.databases) if before else 0),
                }
            )
    return changes


def _risk_trend(
    base_findings: list[Finding],
    target_findings: list[Finding],
    new_risks: list[dict[str, Any]],
    resolved_risks: list[dict[str, Any]],
    worsened_risks: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "previous_total": len(base_findings),
        "current_total": len(target_findings),
        "delta": len(target_findings) - len(base_findings),
        "new_risk_count": len(new_risks),
        "resolved_risk_count": len(resolved_risks),
        "worsened_risk_count": len(worsened_risks),
        "previous_by_severity": dict(Counter(finding.severity.value for finding in base_findings)),
        "current_by_severity": dict(Counter(finding.severity.value for finding in target_findings)),
        "new_risks": new_risks,
        "resolved_risks": resolved_risks,
        "worsened_risks": worsened_risks,
    }


def _recommendations(**context: Any) -> list[str]:
    recommendations = []
    if context["new_cycles"]:
        recommendations.append("Prioritize newly introduced dependency cycles before further feature work.")
    if context["new_dependencies"]:
        recommendations.append("Review new cross-service dependencies and confirm they preserve deployment independence.")
    if context["worsened_risks"]:
        recommendations.append("Investigate risks whose severity increased and assign remediation owners.")
    if context["score_trend"].get("system_delta") is not None and context["score_trend"]["system_delta"] < 0:
        recommendations.append("System health decreased; compare changed services and dependencies before accepting the architecture baseline.")
    if context["resolved_risks"] and not recommendations:
        recommendations.append("Architecture risk improved; keep the current refactoring direction and monitor the next snapshot.")
    if not recommendations:
        recommendations.append("No major architectural deterioration detected between these snapshots.")
    return recommendations


def _summary_sentence(
    new_risks: list[dict[str, Any]],
    resolved_risks: list[dict[str, Any]],
    new_dependencies: list[dict[str, Any]],
    removed_dependencies: list[dict[str, Any]],
    score_trend: dict[str, Any],
) -> str:
    delta = score_trend.get("system_delta")
    score_text = "system score unchanged" if delta in (None, 0) else f"system score changed by {delta:+.1f}"
    return (
        f"{len(new_risks)} new risks, {len(resolved_risks)} resolved risks, "
        f"{len(new_dependencies)} new dependencies, {len(removed_dependencies)} removed dependencies; {score_text}."
    )
