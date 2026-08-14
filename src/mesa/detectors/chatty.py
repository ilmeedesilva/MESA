from __future__ import annotations

from collections import defaultdict

import networkx as nx

from mesa.detectors.base import Detector
from mesa.detectors.evidence import evidence_chain_item, source_files_from_evidence
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
            evidence = [
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
            ]
            confidence = min(0.95, 0.55 + (len(calls) / max(self.threshold, 1)) * 0.1)
            findings.append(
                Finding(
                    id=f"MESA-CHAT-{index:03d}",
                    type=FindingType.CHATTY_SERVICE,
                    severity=_severity(len(calls)),
                    confidence=confidence,
                    services=[source, target],
                    description=(
                        f"{source} has {len(calls)} static call sites targeting {target}, "
                        f"meeting or exceeding the chatty threshold of {self.threshold}."
                    ),
                    evidence=evidence,
                    recommendation=(
                        "Review whether these calls can be consolidated into a coarser API, "
                        "replaced with asynchronous events, or moved behind a read model. "
                        "If the services always change and deploy together, reassess the "
                        "service boundary."
                    ),
                    detector_name="ChattyServiceDetector",
                    rule_id="chatty-service.static-call-count",
                    evidence_chain=[
                        evidence_chain_item(
                            "collect_api_calls",
                            f"Collected static API call edges from {source} to {target}.",
                            source=calls[0].get("source") if calls else None,
                            data={"call_count": len(calls)},
                        ),
                        evidence_chain_item(
                            "compare_threshold",
                            f"Call count {len(calls)} meets or exceeds threshold {self.threshold}.",
                            data={"threshold": self.threshold, "call_count": len(calls)},
                        ),
                        evidence_chain_item(
                            "classify_risk",
                            "Classified repeated synchronous call evidence as chatty service coupling.",
                            data={"severity": _severity(len(calls)).value, "confidence": confidence},
                        ),
                    ],
                    confidence_reason=(
                        f"Confidence is based on {len(calls)} static call sites compared with "
                        f"the configured threshold of {self.threshold}."
                    ),
                    limitations=[
                        "Static call count does not prove these calls occur in the same runtime transaction.",
                        "Runtime traces or latency metrics are needed to confirm operational impact.",
                    ],
                    source_files=source_files_from_evidence(evidence),
                    related_services=[source, target],
                    why_valid=(
                        f"MESA found {len(calls)} source-level API call references from {source} "
                        f"to {target}, which is enough evidence to flag a likely chatty interaction."
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
