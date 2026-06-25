from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import networkx as nx

from mesa.detectors.base import Detector
from mesa.models import Finding, FindingType, Severity

HIGH_RISK_THRESHOLD = 70.0
MEDIUM_RISK_THRESHOLD = 50.0

WEIGHTS = {
    "api_exposure": 15.0,
    "inbound_dependencies": 15.0,
    "outbound_dependencies": 15.0,
    "database_ownership": 10.0,
    "file_volume": 15.0,
    "domain_breadth": 10.0,
    "centrality": 10.0,
    "linked_findings": 10.0,
}

NORMALIZERS = {
    "api_count": 10,
    "inbound_dependencies": 5,
    "outbound_dependencies": 5,
    "database_count": 3,
    "file_count": 20,
    "domain_keyword_count": 8,
    "linked_findings": 5,
}


@dataclass(frozen=True)
class GodServiceScore:
    service: str
    score: float
    severity: Severity
    metrics: dict[str, Any]
    contributions: dict[str, float]
    explanation: str
    recommendation: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "service": self.service,
            "score": self.score,
            "severity": self.severity.value,
            "metrics": self.metrics,
            "contributions": self.contributions,
            "explanation": self.explanation,
            "recommendation": self.recommendation,
        }


class GodServiceDetector(Detector):
    """Detect services accumulating too many responsibilities and dependencies."""

    def __init__(self, high_risk_threshold: float = HIGH_RISK_THRESHOLD) -> None:
        self.high_risk_threshold = high_risk_threshold

    def detect(self, graph: nx.MultiDiGraph) -> list[Finding]:
        findings: list[Finding] = []
        for index, score in enumerate(score_god_services(graph), start=1):
            if score.score < self.high_risk_threshold:
                continue
            findings.append(
                Finding(
                    id=f"MESA-GODS-{index:03d}",
                    type=FindingType.GOD_SERVICE,
                    severity=score.severity,
                    confidence=min(0.95, 0.62 + score.score / 300),
                    services=[score.service],
                    description=(
                        f"{score.service} has a God Service risk score of {score.score:.1f}/100. "
                        "The service appears too central or responsible for too many capabilities."
                    ),
                    evidence=[
                        {
                            "anti_pattern": "God Service",
                            "service": score.service,
                            "score": score.score,
                            "severity": score.severity.value,
                            "metrics": score.metrics,
                            "contributions": score.contributions,
                            "explanation": score.explanation,
                        }
                    ],
                    recommendation=score.recommendation,
                )
            )
        return findings


def score_god_services(graph: nx.MultiDiGraph) -> list[GodServiceScore]:
    service_names = sorted(
        node for node, data in graph.nodes(data=True) if data.get("type") == "service"
    )
    scores = [_score_service(graph, service_name, service_names) for service_name in service_names]
    return sorted(scores, key=lambda item: item.score, reverse=True)


def _score_service(
    graph: nx.MultiDiGraph, service_name: str, service_names: list[str]
) -> GodServiceScore:
    data = graph.nodes[service_name]
    metrics = _metrics_for(graph, service_name, service_names, data)
    contributions = {
        "api_exposure": _weighted(metrics["api_count"], NORMALIZERS["api_count"], WEIGHTS["api_exposure"]),
        "inbound_dependencies": _weighted(
            metrics["inbound_dependencies"],
            NORMALIZERS["inbound_dependencies"],
            WEIGHTS["inbound_dependencies"],
        ),
        "outbound_dependencies": _weighted(
            metrics["outbound_dependencies"],
            NORMALIZERS["outbound_dependencies"],
            WEIGHTS["outbound_dependencies"],
        ),
        "database_ownership": _weighted(
            metrics["database_count"], NORMALIZERS["database_count"], WEIGHTS["database_ownership"]
        ),
        "file_volume": _weighted(metrics["file_count"], NORMALIZERS["file_count"], WEIGHTS["file_volume"]),
        "domain_breadth": _weighted(
            metrics["domain_keyword_count"],
            NORMALIZERS["domain_keyword_count"],
            WEIGHTS["domain_breadth"],
        ),
        "centrality": round(metrics["centrality_score"] * WEIGHTS["centrality"], 2),
        "linked_findings": _weighted(
            metrics["linked_findings"], NORMALIZERS["linked_findings"], WEIGHTS["linked_findings"]
        ),
    }
    score = round(min(sum(contributions.values()), 100.0), 2)
    severity = _severity(score)
    return GodServiceScore(
        service=service_name,
        score=score,
        severity=severity,
        metrics=metrics,
        contributions=contributions,
        explanation=_explanation(service_name, metrics),
        recommendation=_recommendation(service_name, metrics),
    )


def _metrics_for(
    graph: nx.MultiDiGraph, service_name: str, service_names: list[str], data: dict[str, Any]
) -> dict[str, Any]:
    inbound_sources = {
        source
        for source, _, edge_data in graph.in_edges(service_name, data=True)
        if graph.nodes[source].get("type") == "service" and edge_data.get("type") in _SERVICE_EDGE_TYPES
    }
    outbound_targets = {
        target
        for _, target, edge_data in graph.out_edges(service_name, data=True)
        if graph.nodes[target].get("type") == "service" and edge_data.get("type") in _SERVICE_EDGE_TYPES
    }
    linked_findings = int(data.get("linked_findings", 0))
    service_count = max(len(service_names), 1)
    centrality_score = 0.0
    if service_count > 1:
        centrality_score = min((len(inbound_sources) + len(outbound_targets)) / (2 * (service_count - 1)), 1.0)

    domain_keywords = data.get("domain_keywords", []) or []
    return {
        "api_count": int(data.get("endpoint_count", 0)),
        "inbound_dependencies": len(inbound_sources),
        "outbound_dependencies": len(outbound_targets),
        "database_count": int(data.get("database_count", 0)),
        "file_count": int(data.get("file_count", 0)),
        "domain_keyword_count": len(domain_keywords),
        "domain_keywords": domain_keywords,
        "centrality_score": round(centrality_score, 2),
        "linked_findings": linked_findings,
    }


def _weighted(value: int | float, normalizer: int | float, weight: float) -> float:
    return round(min(value / normalizer, 1.0) * weight, 2)


def _severity(score: float) -> Severity:
    if score >= 85:
        return Severity.CRITICAL
    if score >= HIGH_RISK_THRESHOLD:
        return Severity.HIGH
    if score >= MEDIUM_RISK_THRESHOLD:
        return Severity.MEDIUM
    return Severity.LOW


def _explanation(service_name: str, metrics: dict[str, Any]) -> str:
    drivers: list[str] = []
    if metrics["api_count"] >= 8:
        drivers.append(f"exposes {metrics['api_count']} APIs")
    if metrics["inbound_dependencies"] >= 3:
        drivers.append(f"has {metrics['inbound_dependencies']} inbound service dependencies")
    if metrics["outbound_dependencies"] >= 3:
        drivers.append(f"depends on {metrics['outbound_dependencies']} services")
    if metrics["database_count"] >= 2:
        drivers.append(f"owns or touches {metrics['database_count']} databases/entities")
    if metrics["file_count"] >= 12:
        drivers.append(f"spans {metrics['file_count']} files/modules")
    if metrics["domain_keyword_count"] >= 5:
        drivers.append(f"handles {metrics['domain_keyword_count']} domain concepts")
    if metrics["linked_findings"] >= 2:
        drivers.append(f"is linked to {metrics['linked_findings']} existing findings")
    if not drivers:
        drivers.append("has moderate architectural breadth but remains below the high-risk threshold")
    return f"{service_name} " + ", ".join(drivers) + "."


def _recommendation(service_name: str, metrics: dict[str, Any]) -> str:
    domains = metrics.get("domain_keywords", [])[:6]
    domain_hint = f" Start by grouping capabilities around: {', '.join(domains)}." if domains else ""
    return (
        f"Review {service_name} for responsibility boundaries. Split cohesive capabilities into "
        "separate services or modules, move read-heavy APIs behind query/read models, reduce direct "
        "outbound dependencies through events or orchestration, and assign clear data ownership."
        f"{domain_hint} Re-run MESA after each decomposition step to confirm the score decreases."
    )


_SERVICE_EDGE_TYPES = {"api_call", "shared_database"}
