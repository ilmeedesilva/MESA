from __future__ import annotations

import os

from mesa.models import AnalysisResult
from mesa.storage.repository import PostgresPersistenceRepository


class PostgresAnalysisStore:
    """Backward-compatible wrapper around the Phase 1 persistence repository."""

    def __init__(self, dsn: str | None = None) -> None:
        self.dsn = dsn or os.getenv("MESA_POSTGRES_DSN", "postgresql://mesa:mesa@localhost:5432/mesa")

    def initialize(self) -> None:
        PostgresPersistenceRepository(self.dsn).initialize()

    def save_report(self, project_id: str, result: AnalysisResult) -> None:
        repository = PostgresPersistenceRepository(self.dsn)
        if repository.get_project(project_id) is None:
            raise ValueError(f"Project {project_id!r} does not exist")
        repository.save_scan_result(project_id, result)
