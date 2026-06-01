from __future__ import annotations

from collections import defaultdict

import networkx as nx

from mesa.detectors.base import Detector
from mesa.models import Finding, FindingType, Severity


class SharedDatabaseDetector(Detector):
    def detect(self, graph: nx.MultiDiGraph) -> list[Finding]:
        db_users: dict[str, set[str]] = defaultdict(set)
        evidence_by_db: dict[str, list[dict]] = defaultdict(list)

        for source, target, data in graph.edges(data=True):
            if data.get("type") != "uses_database":
                continue
            db_key = graph.nodes[target].get("key", target)
            db_users[db_key].add(source)
            evidence_by_db[db_key].append(
                {"service": source, "database": db_key, "source": data.get("source")}
            )

        findings: list[Finding] = []
        index = 1
        for db_key, services in sorted(db_users.items()):
            if len(services) < 2:
                continue
            service_list = sorted(services)
            findings.append(
                Finding(
                    id=f"MESA-SHDB-{index:03d}",
                    type=FindingType.SHARED_DATABASE,
                    severity=Severity.CRITICAL if len(service_list) == 2 else Severity.HIGH,
                    confidence=0.88,
                    services=service_list,
                    description=f"{', '.join(service_list)} share database {db_key}.",
                    evidence=evidence_by_db[db_key],
                    recommendation=(
                        "Assign one service as the data owner and remove direct database access "
                        "from the others. Replace shared persistence with service APIs, events, "
                        "or CQRS read models depending on consistency needs."
                    ),
                )
            )
            index += 1
        return findings

