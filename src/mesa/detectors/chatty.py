from __future__ import annotations

from collections import defaultdict

import networkx as nx

from mesa.detectors.base import Detector
from mesa.models import Finding, FindingType, Severity


class ChattyServiceDetector(Detector):
    def __init__(self, threshold: int = 3) -> None:
        self.threshold = threshold

    def detect(self, graph: nx.MultiDiGraph) -> list[Finding]:
        calls_by_pair: dict[tuple[str, str], list[dict]] = defaultdict(list)
        for source, target, data in graph.edges(data=True):
            if data.get("type") == "api_call":
                calls_by_pair[(source, target)].append(data)

        findings: list[Finding] = []
        index = 1
        for (source, target), calls in sorted(calls_by_pair.items()):
            if len(calls) < self.threshold:
                continue
            findings.append(
                Finding(
                    id=f"MESA-CHAT-{index:03d}",
                    type=FindingType.CHATTY_SERVICE,
                    severity=_severity(len(calls)),
                    confidence=min(0.95, 0.55 + (len(calls) / max(self.threshold, 1)) * 0.1),
                    services=[source, target],
                    description=(
                        f"{source} has {len(calls)} static call sites targeting {target}, "
                        f"meeting or exceeding the chatty threshold of {self.threshold}."
                    ),
                    evidence=[
                        {
                            "caller": source,
                            "callee": target,
                            "call_count": len(calls),
                            "calls": [
                                {
                                    "url": call.get("url"),
                                    "method": call.get("method"),
                                    "source": call.get("source"),
                                }
                                for call in calls
                            ],
                        }
                    ],
                    recommendation=(
                        "Review whether these calls can be consolidated into a coarser API, "
                        "replaced with asynchronous events, or moved behind a read model. "
                        "If the services always change and deploy together, reassess the "
                        "service boundary."
                    ),
                )
            )
            index += 1
        return findings


def _severity(count: int) -> Severity:
    if count >= 10:
        return Severity.HIGH
    if count >= 6:
        return Severity.MEDIUM
    return Severity.LOW

