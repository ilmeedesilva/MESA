from __future__ import annotations

import networkx as nx

from mesa.detectors.base import Detector
from mesa.models import Finding, FindingType, Severity


class CyclicDependencyDetector(Detector):
    def detect(self, graph: nx.MultiDiGraph) -> list[Finding]:
        call_graph = nx.DiGraph()
        for source, target, data in graph.edges(data=True):
            if data.get("type") == "api_call":
                call_graph.add_edge(source, target)

        findings: list[Finding] = []
        for index, cycle in enumerate(_unique_cycles(call_graph), start=1):
            cycle_path = cycle + [cycle[0]]
            findings.append(
                Finding(
                    id=f"MESA-CYCL-{index:03d}",
                    type=FindingType.CYCLIC_DEPENDENCY,
                    severity=_severity(len(cycle)),
                    confidence=0.9,
                    services=cycle,
                    description=f"Cyclic service dependency detected: {' -> '.join(cycle_path)}.",
                    evidence=[{"cycle": cycle, "cycle_path": cycle_path, "cycle_length": len(cycle)}],
                    recommendation=(
                        "Break the cycle by reversing one dependency, introducing an event, "
                        "or extracting shared responsibility into an owning service. Prioritize "
                        "two-service cycles because they most directly block independent deployment."
                    ),
                )
            )
        return findings


def _unique_cycles(graph: nx.DiGraph) -> list[list[str]]:
    seen: set[tuple[str, ...]] = set()
    unique: list[list[str]] = []
    for cycle in nx.simple_cycles(graph):
        canonical = tuple(sorted(cycle))
        if canonical in seen:
            continue
        seen.add(canonical)
        unique.append(cycle)
    return unique


def _severity(length: int) -> Severity:
    if length == 2:
        return Severity.CRITICAL
    if length == 3:
        return Severity.HIGH
    return Severity.MEDIUM

