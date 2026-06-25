from __future__ import annotations

from abc import ABC, abstractmethod

import networkx as nx

from mesa.models import Finding


class Detector(ABC):
    @abstractmethod
    def detect(self, graph: nx.MultiDiGraph) -> list[Finding]:
        raise NotImplementedError

