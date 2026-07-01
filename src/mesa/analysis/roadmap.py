from __future__ import annotations

from collections import Counter, defaultdict
from statistics import mean
from typing import Any

from mesa.models import (
    AnalysisResult,
    Finding,
    FindingRecommendation,
    FindingType,
    RemediationRoadmap,
    RoadmapAction,
    RoadmapBucket,
    RoadmapDependency,
    RoadmapPlanStep,
    Severity,
)

_SEVERITY_RANK = {
    Severity.LOW: 1,
    Severity.MEDIUM: 2,
    Severity.HIGH: 3,
    Severity.CRITICAL: 4,
}

_BUCKET_BY_TYPE = {
    FindingType.HARD_CODED_SERVICE_DEPENDENCY: RoadmapBucket.QUICK_WIN,
    FindingType.CHATTY_SERVICE: RoadmapBucket.MEDIUM_TERM,
    FindingType.GOVERNANCE_POLICY_VIOLATION: RoadmapBucket.MEDIUM_TERM,
    FindingType.CYCLIC_DEPENDENCY: RoadmapBucket.HIGH_EFFORT,
    FindingType.SHARED_DATABASE: RoadmapBucket.HIGH_EFFORT,
    FindingType.GOD_SERVICE: RoadmapBucket.HIGH_EFFORT,
}

_EXECUTION_BONUS = {
    RoadmapBucket.QUICK_WIN: 6.0,
    RoadmapBucket.MEDIUM_TERM: 3.0,
    RoadmapBucket.HIGH_EFFORT: 0.0,
}

_IMPACTED_DIMENSIONS = {
    FindingType.HARD_CODED_SERVICE_DEPENDENCY: ["hard_coded_dependency_risk", "deployment_independence"],
    FindingType.CHATTY_SERVICE: ["coupling", "api_complexity", "deployment_independence"],
    FindingType.CYCLIC_DEPENDENCY: ["cyclic_dependencies", "coupling", "deployment_independence"],
    FindingType.SHARED_DATABASE: ["shared_database_usage", "ownership_clarity", "deployment_independence"],
    FindingType.GOD_SERVICE: ["god_service_risk", "cohesion", "coupling", "ownership_clarity"],
    FindingType.GOVERNANCE_POLICY_VIOLATION: ["deployment_independence", "ownership_clarity"],
}


def build_remediation_roadmap(scan_id: str, result: AnalysisResult) -> RemediationRoadmap:
    findings = result.findings
    system_score, weak_dimensions = _system_health_context(result)
    if not findings:
        return RemediationRoadmap(
            scan_id=scan_id,
            generated_from_finding_count=0,
            system_health_score=system_score,
            summary="No remediation roadmap was generated because this scan does not contain active findings.",
        )

    service_scores = _service_score_map(result)
    centrality = _service_centrality(result)
    linked_findings = Counter(service for finding in findings for service in finding.services)
    actions = [
        _build_action(
            scan_id=scan_id,
            cluster_index=index,
            findings=cluster,
            service_scores=service_scores,
            centrality=centrality,
            linked_findings=linked_findings,
            system_score=system_score,
            weak_dimensions=weak_dimensions,
        )
        for index, cluster in enumerate(_cluster_findings(findings), start=1)
    ]

    dependencies = _derive_dependencies(actions)
    for action in actions:
        action.dependencies = [item.depends_on for item in dependencies if item.action_id == action.id]

    ordered_actions = _ordered_actions(actions, dependencies)
    for rank, action in enumerate(ordered_actions, start=1):
        action.priority_rank = rank

    return RemediationRoadmap(
        scan_id=scan_id,
        generated_from_finding_count=len(findings),
        system_health_score=system_score,
        summary=_roadmap_summary(findings, ordered_actions, system_score),
        quick_wins=[action for action in ordered_actions if action.bucket == RoadmapBucket.QUICK_WIN],
        medium_term_changes=[action for action in ordered_actions if action.bucket == RoadmapBucket.MEDIUM_TERM],
        high_effort_refactors=[action for action in ordered_actions if action.bucket == RoadmapBucket.HIGH_EFFORT],
        suggested_order=[
            RoadmapPlanStep(
                order=index,
                action_id=action.id,
                title=action.title,
                bucket=action.bucket,
                why_now=action.suggested_order_reason,
            )
            for index, action in enumerate(ordered_actions, start=1)
        ],
        dependencies=dependencies,
    )


def _cluster_findings(findings: list[Finding]) -> list[list[Finding]]:
    grouped: dict[tuple[Any, ...], list[Finding]] = defaultdict(list)
    for finding in findings:
        grouped[_cluster_key(finding)].append(finding)
    return [grouped[key] for key in sorted(grouped.keys(), key=lambda value: repr(value))]


def _cluster_key(finding: Finding) -> tuple[Any, ...]:
    if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY:
        return ("hardcoded", "global")
    if finding.type == FindingType.CHATTY_SERVICE:
        evidence = finding.evidence[0] if finding.evidence else {}
        caller = str(evidence.get("caller", finding.services[0] if finding.services else "unknown"))
        callee = str(evidence.get("callee", finding.services[-1] if finding.services else "unknown"))
        return ("chatty", caller, callee)
    if finding.type == FindingType.CYCLIC_DEPENDENCY:
        cycle = tuple(sorted(_cycle_services(finding)))
        return ("cycle",) + cycle
    if finding.type == FindingType.SHARED_DATABASE:
        database = _shared_database_key(finding)
        return ("shared_database", database)
    if finding.type == FindingType.GOD_SERVICE:
        service = finding.services[0] if finding.services else finding.id
        return ("god_service", service)
    if finding.type == FindingType.GOVERNANCE_POLICY_VIOLATION:
        return ("governance", _policy_name(finding).lower())
    return (finding.type.value,) + tuple(sorted(finding.services))


def _build_action(
    *,
    scan_id: str,
    cluster_index: int,
    findings: list[Finding],
    service_scores: dict[str, float],
    centrality: dict[str, float],
    linked_findings: Counter[str],
    system_score: float | None,
    weak_dimensions: list[str],
) -> RoadmapAction:
    primary_type = findings[0].type
    bucket = _BUCKET_BY_TYPE[primary_type]
    affected_services = sorted({service for finding in findings for service in finding.services})
    recommendations = [recommendation for finding in findings for recommendation in finding.recommendations[:1]]
    title, summary, rationale, suggested_order_reason = _action_text(
        primary_type=primary_type,
        findings=findings,
        services=affected_services,
        recommendations=recommendations,
    )
    impacted_dimensions = [
        dimension
        for dimension in _IMPACTED_DIMENSIONS.get(primary_type, [])
        if dimension in weak_dimensions
    ] or _IMPACTED_DIMENSIONS.get(primary_type, [])[:2]
    average_confidence = round(mean(finding.confidence for finding in findings), 2)
    max_severity = max(findings, key=lambda finding: _SEVERITY_RANK[finding.severity]).severity
    max_centrality = round(max((centrality.get(service, 0.0) for service in affected_services), default=0.0), 2)
    max_linked_findings = max((linked_findings.get(service, 0) for service in affected_services), default=len(findings))
    service_health = _service_health_pressure(affected_services, service_scores, system_score)
    priority_score = _priority_score(
        primary_type=primary_type,
        findings=findings,
        max_centrality=max_centrality,
        max_linked_findings=max_linked_findings,
        service_health_pressure=service_health,
    )
    expected_benefit = _expected_benefit(recommendations, primary_type)

    return RoadmapAction(
        id=f"roadmap-{scan_id[:8]}-{cluster_index:02d}",
        title=title,
        bucket=bucket,
        priority_rank=cluster_index,
        priority_score=priority_score,
        summary=summary,
        rationale=rationale,
        expected_benefit=expected_benefit,
        suggested_order_reason=suggested_order_reason,
        estimated_difficulty=_estimated_difficulty(recommendations, bucket),
        affected_services=affected_services,
        related_findings=[finding.id for finding in findings],
        related_finding_types=sorted({finding.type for finding in findings}, key=lambda item: item.value),
        metrics={
            "finding_count": len(findings),
            "max_severity": max_severity.value,
            "average_confidence": average_confidence,
            "service_centrality": max_centrality,
            "max_linked_findings": max_linked_findings,
            "service_health_pressure": round(service_health, 2),
            "impacted_dimensions": impacted_dimensions,
        },
    )


def _action_text(
    *,
    primary_type: FindingType,
    findings: list[Finding],
    services: list[str],
    recommendations: list[FindingRecommendation],
) -> tuple[str, str, str, str]:
    service_text = _service_text(services)
    if primary_type == FindingType.HARD_CODED_SERVICE_DEPENDENCY:
        occurrences = sum(
            max(int(evidence.get("duplicate_occurrences", 1)), 1)
            for finding in findings
            for evidence in finding.evidence
        )
        return (
            f"Externalize hard-coded endpoints in {len(services)} service{'s' if len(services) != 1 else ''}",
            f"Replace embedded hosts, URLs, or ports across {service_text} with deployment-managed configuration.",
            f"MESA found {len(findings)} hard-coded endpoint signals covering roughly {occurrences} repeated occurrences. "
            "Cleaning these first reduces environment drift and makes later refactors safer to execute.",
            "This is a low-effort quick win that removes operational coupling and clears noise before deeper structural work.",
        )
    if primary_type == FindingType.CHATTY_SERVICE:
        evidence = findings[0].evidence[0] if findings[0].evidence else {}
        caller = str(evidence.get("caller", services[0] if services else "caller"))
        callee = str(evidence.get("callee", services[-1] if services else "callee"))
        call_count = sum(int(finding.evidence[0].get("call_count", 0)) for finding in findings if finding.evidence)
        return (
            f"Reduce chatty traffic between {caller} and {callee}",
            f"Consolidate repeated synchronous calls between {caller} and {callee} into coarser APIs, events, or read models.",
            f"MESA counted {call_count} static call sites across this interaction path. The pattern increases latency sensitivity "
            "and pushes two services toward tighter runtime coupling.",
            "Address this after obvious configuration cleanups so the API boundary can be redesigned on stable client wiring.",
        )
    if primary_type == FindingType.CYCLIC_DEPENDENCY:
        cycle = " -> ".join(_cycle_services(findings[0]))
        return (
            f"Break the dependency cycle across {service_text}",
            f"Remove the bidirectional dependency loop that currently ties {service_text} into the same change path.",
            f"The detected cycle path is {cycle}. Cycles directly block deployment independence and often hide unclear ownership.",
            "Prioritize this structural refactor early because it affects multiple services and amplifies other risks when left in place.",
        )
    if primary_type == FindingType.SHARED_DATABASE:
        database = _shared_database_key(findings[0])
        database_label = database if len(database) <= 42 else f"{database[:39]}..."
        return (
            f"Remove shared database access for {service_text}",
            f"Assign one data owner for {database_label} and move other services behind APIs, events, or read models.",
            f"MESA found direct persistence coupling across {service_text}. Shared database access weakens ownership clarity and makes schema changes risky.",
            "Treat this as a major architectural refactor because it changes data ownership and usually needs staged migration work.",
        )
    if primary_type == FindingType.GOD_SERVICE:
        service = services[0] if services else "the hotspot service"
        return (
            f"Decompose the hotspot service {service}",
            f"Split {service} into clearer responsibility boundaries and reduce the amount of behavior concentrated in one deployable unit.",
            f"MESA marked {service} as an oversized hotspot linked to multiple architectural stress signals. "
            "Breaking surrounding coupling first will make the decomposition safer and easier to scope.",
            "Schedule this after related coupling and ownership fixes so the extraction plan is based on cleaner boundaries.",
        )

    policy_name = _policy_name(findings[0])
    return (
        f"Bring policy '{policy_name}' back into compliance",
        f"Use the related remediation work to satisfy the governance rule '{policy_name}' and re-run the scan to confirm compliance.",
        "This governance action captures an agreed architectural rule that is currently being violated. "
        "It should be closed only after the underlying structural causes are resolved.",
        "Use this as a verification checkpoint after the overlapping fixes complete, not as an isolated refactor.",
    )


def _expected_benefit(recommendations: list[FindingRecommendation], primary_type: FindingType) -> str:
    if recommendations:
        return recommendations[0].expected_impact
    fallback = {
        FindingType.HARD_CODED_SERVICE_DEPENDENCY: "Improves environment portability and reduces endpoint drift.",
        FindingType.CHATTY_SERVICE: "Reduces synchronous coupling and improves latency resilience.",
        FindingType.CYCLIC_DEPENDENCY: "Improves independent deployment and lowers cascading change risk.",
        FindingType.SHARED_DATABASE: "Improves ownership clarity and safer schema evolution.",
        FindingType.GOD_SERVICE: "Improves service maintainability and responsibility clarity.",
        FindingType.GOVERNANCE_POLICY_VIOLATION: "Brings the system back in line with agreed architecture rules.",
    }
    return fallback[primary_type]


def _estimated_difficulty(
    recommendations: list[FindingRecommendation], bucket: RoadmapBucket
) -> str:
    if recommendations:
        return recommendations[0].estimated_difficulty
    return {
        RoadmapBucket.QUICK_WIN: "Low",
        RoadmapBucket.MEDIUM_TERM: "Medium",
        RoadmapBucket.HIGH_EFFORT: "High",
    }[bucket]


def _priority_score(
    *,
    primary_type: FindingType,
    findings: list[Finding],
    max_centrality: float,
    max_linked_findings: int,
    service_health_pressure: float,
) -> float:
    severity_component = (max(_SEVERITY_RANK[finding.severity] for finding in findings) / 4) * 40
    confidence_component = mean(finding.confidence for finding in findings) * 16
    centrality_component = max_centrality * 14
    linked_component = min(max_linked_findings, 5) / 5 * 10
    health_component = service_health_pressure * 14
    spread_component = min(len(findings), 4) / 4 * 4
    structural_bonus = 4.0 if primary_type in {
        FindingType.CYCLIC_DEPENDENCY,
        FindingType.SHARED_DATABASE,
        FindingType.GOD_SERVICE,
    } else 0.0
    return round(
        min(
            severity_component
            + confidence_component
            + centrality_component
            + linked_component
            + health_component
            + spread_component
            + structural_bonus,
            100.0,
        ),
        2,
    )


def _derive_dependencies(actions: list[RoadmapAction]) -> list[RoadmapDependency]:
    by_id = {action.id: action for action in actions}
    dependencies: list[RoadmapDependency] = []
    for action in actions:
        primary_type = _primary_type(action)
        for candidate in actions:
            if candidate.id == action.id:
                continue
            candidate_type = _primary_type(candidate)
            overlap = set(action.affected_services) & set(candidate.affected_services)
            if primary_type == FindingType.GOVERNANCE_POLICY_VIOLATION and candidate_type != FindingType.GOVERNANCE_POLICY_VIOLATION:
                if overlap or not action.affected_services:
                    dependencies.append(
                        RoadmapDependency(
                            action_id=action.id,
                            depends_on=candidate.id,
                            reason="Re-check the governance rule after the overlapping architectural fix is complete.",
                        )
                    )
            elif (
                primary_type == FindingType.GOD_SERVICE
                and candidate_type
                in {
                    FindingType.HARD_CODED_SERVICE_DEPENDENCY,
                    FindingType.CHATTY_SERVICE,
                    FindingType.CYCLIC_DEPENDENCY,
                    FindingType.SHARED_DATABASE,
                }
                and overlap
            ):
                dependencies.append(
                    RoadmapDependency(
                        action_id=action.id,
                        depends_on=candidate.id,
                        reason="Reduce surrounding coupling first so the decomposition target is clearer.",
                    )
                )
            elif (
                primary_type == FindingType.CHATTY_SERVICE
                and candidate_type == FindingType.HARD_CODED_SERVICE_DEPENDENCY
                and overlap
            ):
                dependencies.append(
                    RoadmapDependency(
                        action_id=action.id,
                        depends_on=candidate.id,
                        reason="Stabilize endpoint configuration before redesigning the interaction boundary.",
                    )
                )

    unique: dict[tuple[str, str], RoadmapDependency] = {}
    for dependency in dependencies:
        if dependency.action_id == dependency.depends_on:
            continue
        if dependency.depends_on not in by_id:
            continue
        unique[(dependency.action_id, dependency.depends_on)] = dependency
    return sorted(unique.values(), key=lambda item: (item.action_id, item.depends_on))


def _ordered_actions(
    actions: list[RoadmapAction], dependencies: list[RoadmapDependency]
) -> list[RoadmapAction]:
    pending = {action.id: action for action in actions}
    remaining = {
        action.id: {dependency.depends_on for dependency in dependencies if dependency.action_id == action.id}
        for action in actions
    }
    ordered: list[RoadmapAction] = []

    while pending:
        ready = [
            action
            for action_id, action in pending.items()
            if not remaining.get(action_id)
        ]
        if not ready:
            ready = list(pending.values())
        ready.sort(
            key=lambda action: (
                action.priority_score + _EXECUTION_BONUS[action.bucket],
                action.priority_score,
                -len(action.dependencies),
            ),
            reverse=True,
        )
        current = ready[0]
        ordered.append(current)
        pending.pop(current.id, None)
        for action_id in remaining:
            remaining[action_id].discard(current.id)

    return ordered


def _roadmap_summary(
    findings: list[Finding], ordered_actions: list[RoadmapAction], system_score: float | None
) -> str:
    top_action = ordered_actions[0]
    score_text = f" with a current system health score of {system_score:.1f}/100" if system_score is not None else ""
    return (
        f"MESA grouped {len(findings)} findings into {len(ordered_actions)} remediation actions{score_text}. "
        f"Start with '{top_action.title}', then follow the suggested order to combine quick wins and deeper structural fixes."
    )


def _service_score_map(result: AnalysisResult) -> dict[str, float]:
    service_scores = result.summary.get("health_scores", {}).get("service", [])
    return {
        str(score.get("target", "")): float(score.get("score", 0.0))
        for score in service_scores
        if score.get("target")
    }


def _system_health_context(result: AnalysisResult) -> tuple[float | None, list[str]]:
    system = result.summary.get("health_scores", {}).get("system")
    if not system:
        return None, []
    score = float(system.get("score", 0.0))
    breakdown = system.get("breakdown", {})
    weak_dimensions = [
        str(dimension)
        for dimension, value in breakdown.items()
        if float(value) < 70.0
    ]
    return score, weak_dimensions


def _service_centrality(result: AnalysisResult) -> dict[str, float]:
    service_ids = {
        str(node.get("id"))
        for node in result.graph.get("nodes", [])
        if node.get("type") == "service"
    }
    degree: Counter[str] = Counter()
    for edge in result.graph.get("edges", []):
        source = str(edge.get("source", ""))
        target = str(edge.get("target", ""))
        if source in service_ids:
            degree[source] += 1
        if target in service_ids:
            degree[target] += 1
    if not degree:
        return {service_id: 0.0 for service_id in service_ids}
    max_degree = max(degree.values())
    return {
        service_id: round(degree.get(service_id, 0) / max(max_degree, 1), 2)
        for service_id in service_ids
    }


def _service_health_pressure(
    services: list[str],
    service_scores: dict[str, float],
    system_score: float | None,
) -> float:
    if services:
        scores = [service_scores.get(service) for service in services if service_scores.get(service) is not None]
        if scores:
            return max(0.0, 1 - (mean(scores) / 100.0))
    if system_score is None:
        return 0.35
    return max(0.0, 1 - (system_score / 100.0))


def _service_text(services: list[str]) -> str:
    if not services:
        return "the affected services"
    if len(services) <= 3:
        return ", ".join(services)
    return f"{', '.join(services[:3])}, and {len(services) - 3} more"


def _cycle_services(finding: Finding) -> list[str]:
    for evidence in finding.evidence:
        cycle = evidence.get("cycle")
        if isinstance(cycle, list) and cycle:
            return [str(service) for service in cycle]
    return finding.services


def _shared_database_key(finding: Finding) -> str:
    for evidence in finding.evidence:
        database = evidence.get("database")
        if database:
            return str(database)
    return "shared database"


def _policy_name(finding: Finding) -> str:
    for evidence in finding.evidence:
        policy_name = evidence.get("policy_name")
        if policy_name:
            return str(policy_name)
    return "architecture policy"


def _primary_type(action: RoadmapAction) -> FindingType:
    return action.related_finding_types[0]
