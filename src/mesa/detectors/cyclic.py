from __future__ import annotations

import networkx as nx

from mesa.detectors.base import Detector
from mesa.detectors.evidence import evidence_chain_item, source_files_from_evidence
from mesa.models import Finding, FindingType, Severity


class CyclicDependencyDetector(Detector):
    def detect(self, graph: nx.MultiDiGraph) -> list[Finding]:
        call_graph = nx.DiGraph()
        edge_evidence: dict[tuple[str, str], list[dict]] = {}
        for source, target, data in graph.edges(data=True):
            if data.get("type") == "api_call":
                call_graph.add_edge(source, target)
                edge_evidence.setdefault((source, target), []).append(data)

        findings: list[Finding] = []
        for index, cycle in enumerate(_unique_cycles(call_graph), start=1):
            cycle_path = cycle + [cycle[0]]
            evidence = [{"cycle": cycle, "cycle_path": cycle_path, "cycle_length": len(cycle)}]
            for source, target in zip(cycle_path, cycle_path[1:]):
                for edge in edge_evidence.get((source, target), []):
                    evidence.append(
                        {
                            "source_service": source,
                            "target_service": target,
                            "method": edge.get("method"),
                            "url": edge.get("url"),
                            "source": edge.get("source"),
                        }
                    )
            findings.append(
                Finding(
                    id=f"MESA-CYCL-{index:03d}",
                    type=FindingType.CYCLIC_DEPENDENCY,
                    severity=_severity(len(cycle)),
                    confidence=0.9,
                    services=cycle,
                    description=f"Cyclic service dependency detected: {' -> '.join(cycle_path)}.",
                    evidence=evidence,
                    recommendation=(
                        "Break the cycle by reversing one dependency, introducing an event, "
                        "or extracting shared responsibility into an owning service. Prioritize "
                        "two-service cycles because they most directly block independent deployment."
                    ),
                    detector_name="CyclicDependencyDetector",
                    rule_id="cyclic-dependency.api-call-cycle",
                    evidence_chain=[
                        evidence_chain_item(
                            "build_call_graph",
                            "Projected API call edges into a directed service dependency graph.",
                            data={"edge_count": call_graph.number_of_edges()},
                        ),
                        evidence_chain_item(
                            "detect_cycle",
                            f"Found a closed dependency path: {' -> '.join(cycle_path)}.",
                            source=next(
                                (
                                    item.get("source")
                                    for item in evidence
                                    if isinstance(item.get("source"), dict)
                                ),
                                None,
                            ),
                            data={"cycle_length": len(cycle), "cycle_path": cycle_path},
                        ),
                    ],
                    confidence_reason=(
                        "Confidence is high because the directed service graph contains a closed "
                        "cycle built from static API call evidence."
                    ),
                    limitations=[
                        "Static dependencies do not prove all cycle edges are exercised at runtime.",
                        "The detector does not yet rank which edge is cheapest to remove.",
                    ],
                    source_files=source_files_from_evidence(evidence),
                    related_services=cycle,
                    why_valid=(
                        f"MESA found API call dependencies that form the closed path "
                        f"{' -> '.join(cycle_path)}, which is direct evidence of cyclic coupling."
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
