from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any

import networkx as nx

from mesa.models import Finding, FindingType, HealthScore

DIMENSIONS = [
    "coupling",
    "cohesion",
    "cyclic_dependencies",
    "shared_database_usage",
    "hard_coded_dependency_risk",
    "god_service_risk",
    "api_complexity",
    "deployment_independence",
    "ownership_clarity",
]


WEIGHTS = {
    "coupling": 0.14,
    "cohesion": 0.12,
    "cyclic_dependencies": 0.12,
    "shared_database_usage": 0.11,
    "hard_coded_dependency_risk": 0.10,
    "god_service_risk": 0.13,
    "api_complexity": 0.09,
    "deployment_independence": 0.10,
    "ownership_clarity": 0.09,
}


def calculate_health_scores(
    graph: nx.MultiDiGraph, findings: list[Finding], god_service_scores: list[dict[str, Any]]
) -> dict[str, Any]:
    """Calculate service, domain, and system architectural health scores."""
    services = sorted(node for node, data in graph.nodes(data=True) if data.get("type") == "service")
    finding_counts = _finding_counts(findings)
    god_scores = {score["service"]: float(score["score"]) for score in god_service_scores}
    service_scores = [
        _service_health(graph, service, services, findings, finding_counts, god_scores)
        for service in services
    ]
    domain_scores = _domain_scores(service_scores)
    system_score = _system_score(service_scores, domain_scores, findings)
    return {
        "service": [score.model_dump(mode="json") for score in service_scores],
        "domain": [score.model_dump(mode="json") for score in domain_scores],
        "system": system_score.model_dump(mode="json"),
    }


def flatten_health_scores(health_scores: dict[str, Any]) -> list[HealthScore]:
    scores = [HealthScore.model_validate(score) for score in health_scores.get("service", [])]
    scores.extend(HealthScore.model_validate(score) for score in health_scores.get("domain", []))
    system_score = health_scores.get("system")
    if system_score:
        scores.append(HealthScore.model_validate(system_score))
    return scores


def _service_health(
    graph: nx.MultiDiGraph,
    service: str,
    services: list[str],
    findings: list[Finding],
    finding_counts: dict[tuple[str, FindingType], int],
    god_scores: dict[str, float],
) -> HealthScore:
    data = graph.nodes[service]
    inbound = _neighbor_count(graph, service, incoming=True)
    outbound = _neighbor_count(graph, service, incoming=False)
    service_count = max(len(services), 1)
    endpoint_count = int(data.get("endpoint_count", 0))
    database_count = int(data.get("database_count", 0))
    domain_count = len(data.get("domain_keywords", []) or [])
    hardcoded_count = finding_counts.get((service, FindingType.HARD_CODED_SERVICE_DEPENDENCY), 0)
    shared_db_count = finding_counts.get((service, FindingType.SHARED_DATABASE), 0)
    cycle_count = finding_counts.get((service, FindingType.CYCLIC_DEPENDENCY), 0)
    god_score = god_scores.get(service, 0.0)

    dependency_ratio = (inbound + outbound) / max(2 * (service_count - 1), 1)
    coupling = _score_from_penalty(dependency_ratio * 80 + max(outbound - 2, 0) * 7)
    cohesion = _score_from_penalty(max(domain_count - 4, 0) * 8)
    cyclic = _score_from_penalty(cycle_count * 55)
    shared_db = _score_from_penalty(shared_db_count * 45)
    hardcoded = _score_from_penalty(hardcoded_count * 18)
    god = _score_from_penalty(god_score)
    api_complexity = _score_from_penalty(max(endpoint_count - 4, 0) * 7)
    deployment_independence = _score_from_penalty(
        cycle_count * 40 + hardcoded_count * 12 + dependency_ratio * 35
    )
    ownership_clarity = _score_from_penalty(shared_db_count * 45 + max(database_count - 1, 0) * 12)

    breakdown = _round_breakdown(
        {
            "coupling": coupling,
            "cohesion": cohesion,
            "cyclic_dependencies": cyclic,
            "shared_database_usage": shared_db,
            "hard_coded_dependency_risk": hardcoded,
            "god_service_risk": god,
            "api_complexity": api_complexity,
            "deployment_independence": deployment_independence,
            "ownership_clarity": ownership_clarity,
        }
    )
    score = _weighted_score(breakdown)
    weak_dimensions = _weak_dimensions(breakdown)
    return HealthScore(
        scope="service",
        target=service,
        score=score,
        grade=_grade(score),
        breakdown=breakdown,
        explanation=_explanation("service", service, score, weak_dimensions),
        recommendations=_recommendations(weak_dimensions, service),
    )


def _domain_scores(service_scores: list[HealthScore]) -> list[HealthScore]:
    grouped: dict[str, list[HealthScore]] = defaultdict(list)
    for score in service_scores:
        grouped[_domain_for(score.target)].append(score)

    domain_scores: list[HealthScore] = []
    for domain, scores in sorted(grouped.items()):
        breakdown = _round_breakdown(
            {dimension: mean(score.breakdown[dimension] for score in scores) for dimension in DIMENSIONS}
        )
        numeric = _weighted_score(breakdown)
        weak_dimensions = _weak_dimensions(breakdown)
        domain_scores.append(
            HealthScore(
                scope="domain",
                target=domain,
                score=numeric,
                grade=_grade(numeric),
                breakdown=breakdown,
                explanation=_explanation("domain", domain, numeric, weak_dimensions),
                recommendations=_recommendations(weak_dimensions, domain),
            )
        )
    return domain_scores


def _system_score(
    service_scores: list[HealthScore], domain_scores: list[HealthScore], findings: list[Finding]
) -> HealthScore:
    if not service_scores:
        breakdown = {dimension: 100.0 for dimension in DIMENSIONS}
    else:
        breakdown = _round_breakdown(
            {dimension: mean(score.breakdown[dimension] for score in service_scores) for dimension in DIMENSIONS}
        )

    systemic_penalty = 0.0
    if any(finding.type == FindingType.CYCLIC_DEPENDENCY for finding in findings):
        systemic_penalty += 5.0
    if any(finding.type == FindingType.SHARED_DATABASE for finding in findings):
        systemic_penalty += 5.0
    if len(domain_scores) > 1:
        domain_spread = max(score.score for score in domain_scores) - min(score.score for score in domain_scores)
        systemic_penalty += min(domain_spread / 10, 5.0)

    numeric = max(round(_weighted_score(breakdown) - systemic_penalty, 2), 0.0)
    weak_dimensions = _weak_dimensions(breakdown)
    return HealthScore(
        scope="system",
        target="system",
        score=numeric,
        grade=_grade(numeric),
        breakdown=breakdown,
        explanation=_explanation("system", "system", numeric, weak_dimensions),
        recommendations=_recommendations(weak_dimensions, "system"),
    )


def _finding_counts(findings: list[Finding]) -> dict[tuple[str, FindingType], int]:
    counts: dict[tuple[str, FindingType], int] = {}
    for finding in findings:
        for service in finding.services:
            key = (service, finding.type)
            counts[key] = counts.get(key, 0) + 1
    return counts


def _neighbor_count(graph: nx.MultiDiGraph, service: str, incoming: bool) -> int:
    edges = graph.in_edges(service, data=True) if incoming else graph.out_edges(service, data=True)
    index = 0 if incoming else 1
    return len(
        {
            edge[index]
            for edge in edges
            if graph.nodes[edge[index]].get("type") == "service"
            and edge[2].get("type") in {"api_call", "shared_database"}
        }
    )


def _domain_for(service_name: str) -> str:
    cleaned = service_name.removesuffix("-service").removesuffix("_service")
    return cleaned.split("-")[0].split("_")[0] or service_name


def _score_from_penalty(penalty: float) -> float:
    return max(round(100.0 - min(penalty, 100.0), 2), 0.0)


def _round_breakdown(breakdown: dict[str, float]) -> dict[str, float]:
    return {dimension: round(float(breakdown[dimension]), 2) for dimension in DIMENSIONS}


def _weighted_score(breakdown: dict[str, float]) -> float:
    return round(sum(breakdown[dimension] * WEIGHTS[dimension] for dimension in DIMENSIONS), 2)


def _grade(score: float) -> str:
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Moderate"
    if score >= 30:
        return "Poor"
    return "Critical"


def _weak_dimensions(breakdown: dict[str, float]) -> list[str]:
    return [dimension for dimension, score in sorted(breakdown.items(), key=lambda item: item[1]) if score < 70]


def _explanation(scope: str, target: str, score: float, weak_dimensions: list[str]) -> str:
    if weak_dimensions:
        weak_text = ", ".join(dimension.replace("_", " ") for dimension in weak_dimensions[:4])
        return f"{target} has {scope}-level architectural health {score:.1f}/100; weakest dimensions are {weak_text}."
    return f"{target} has {scope}-level architectural health {score:.1f}/100 with no dimension below the Good threshold."


def _recommendations(weak_dimensions: list[str], target: str) -> list[str]:
    if not weak_dimensions:
        return [f"Keep monitoring {target} for architectural drift as the system evolves."]

    mapping = {
        "coupling": "Reduce direct service dependencies; prefer events, stable APIs, or orchestration boundaries.",
        "cohesion": "Split unrelated domain capabilities and keep each service focused on one bounded context.",
        "cyclic_dependencies": "Break dependency cycles by reversing ownership, introducing events, or extracting shared responsibilities.",
        "shared_database_usage": "Assign clear data owners and replace shared persistence with APIs, events, or read models.",
        "hard_coded_dependency_risk": "Move endpoints into environment-specific configuration or service discovery.",
        "god_service_risk": "Decompose oversized services around cohesive capabilities and reduce central responsibilities.",
        "api_complexity": "Consolidate overly granular APIs and separate read models from command workflows.",
        "deployment_independence": "Remove runtime coupling that forces services to change, deploy, or scale together.",
        "ownership_clarity": "Clarify service ownership over data, APIs, and domain responsibilities.",
    }
    return [mapping[dimension] for dimension in weak_dimensions[:5]]
