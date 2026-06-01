from __future__ import annotations

from pathlib import Path

from mesa.analysis.extractor import extract_service_facts
from mesa.detectors import (
    ChattyServiceDetector,
    CyclicDependencyDetector,
    HardCodedServiceDependencyDetector,
    SharedDatabaseDetector,
)
from mesa.graph.builder import build_graph, graph_to_dict
from mesa.models import AnalysisResult


def analyze_services(service_paths: list[str], chatty_threshold: int = 3) -> AnalysisResult:
    services = [extract_service_facts(Path(path)) for path in service_paths]
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

    return AnalysisResult(
        services=services,
        findings=findings,
        graph=graph_to_dict(graph),
        summary={
            "service_count": len(services),
            "finding_count": len(findings),
            "findings_by_type": _count_by(findings, "type"),
            "findings_by_severity": _count_by(findings, "severity"),
        },
    )


def _count_by(items: list, attr: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        value = getattr(item, attr)
        key = value.value if hasattr(value, "value") else str(value)
        counts[key] = counts.get(key, 0) + 1
    return counts

