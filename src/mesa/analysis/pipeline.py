from __future__ import annotations

import os
from pathlib import Path

import networkx as nx

from mesa.analysis.extractor import extract_service_facts
from mesa.analysis.health import calculate_health_scores
from mesa.analysis.recommendations import enrich_findings_with_recommendations
from mesa.detectors import (
    ChattyServiceDetector,
    CyclicDependencyDetector,
    GodServiceDetector,
    HardCodedServiceDependencyDetector,
    SharedDatabaseDetector,
    score_god_services,
)
from mesa.fingerprint import assign_fingerprints
from mesa.graph.builder import build_graph, graph_to_dict
from mesa.models import AnalysisResult


def analyze_services(
    service_paths: list[str],
    chatty_threshold: int = 3,
    *,
    path_base: str | Path | None = None,
) -> AnalysisResult:
    """Analyze the given service directories together.

    Source file paths in the result are relative to `path_base`. When it is not
    given, they are relative to the folder that contains the services (the
    common parent), e.g. `order-service/app.py`.
    """
    sibling_service_names = {Path(path).resolve().name for path in service_paths}
    base = Path(path_base) if path_base is not None else default_path_base(service_paths)
    services = [
        extract_service_facts(
            Path(path), sibling_service_names=sibling_service_names, path_base=base
        )
        for path in service_paths
    ]
    graph = build_graph(services)

    detectors = [
        ChattyServiceDetector(threshold=chatty_threshold),
        CyclicDependencyDetector(),
        SharedDatabaseDetector(),
        HardCodedServiceDependencyDetector(),
    ]
    findings = []
    for detector in detectors:
        findings.extend(detector.detect(graph))

    _attach_linked_finding_counts(graph, findings)
    god_service_scores = [score.to_dict() for score in score_god_services(graph)]
    findings.extend(GodServiceDetector().detect(graph))
    findings = enrich_findings_with_recommendations(findings)
    assign_fingerprints(findings)
    health_scores = calculate_health_scores(graph, findings, god_service_scores)

    return AnalysisResult(
        services=services,
        findings=findings,
        graph=graph_to_dict(graph),
        summary={
            "service_count": len(services),
            "finding_count": len(findings),
            "findings_by_type": _count_by(findings, "type"),
            "findings_by_severity": _count_by(findings, "severity"),
            "god_service_scores": god_service_scores,
            "health_scores": health_scores,
        },
    )


def default_path_base(service_paths: list[str]) -> Path | None:
    """The deepest folder that contains every service directory."""
    if not service_paths:
        return None
    parents = [str(Path(path).resolve().parent) for path in service_paths]
    try:
        return Path(os.path.commonpath(parents))
    except ValueError:  # different drives on Windows
        return None


def _count_by(items: list, attr: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        value = getattr(item, attr)
        key = value.value if hasattr(value, "value") else str(value)
        counts[key] = counts.get(key, 0) + 1
    return counts


def _attach_linked_finding_counts(graph: nx.MultiDiGraph, findings: list) -> None:
    counts: dict[str, int] = {}
    for finding in findings:
        for service in finding.services:
            counts[service] = counts.get(service, 0) + 1
    for service, count in counts.items():
        if service in graph:
            graph.nodes[service]["linked_findings"] = count
