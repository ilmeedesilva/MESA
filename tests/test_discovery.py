from pathlib import Path

from mesa.discovery import discover_service_candidates
from mesa.ingestion.repository import preview_repository
from mesa.models import RepoScanPreviewRequest, RepoSourceType

ROOT = Path(__file__).parent / "fixtures"


def test_discover_service_candidates_returns_confidence_and_reasons() -> None:
    candidates = discover_service_candidates(ROOT / "chatty")

    assert [candidate.relative_path for candidate in candidates] == [
        "order-service",
        "user-service",
    ]
    assert all(candidate.confidence >= 0.24 for candidate in candidates)
    assert all(candidate.reasons for candidate in candidates)
    assert all(candidate.language == "python" for candidate in candidates)
    assert all(candidate.selected_by_default for candidate in candidates)


def test_preview_repository_exposes_discovered_services() -> None:
    preview = preview_repository(
        RepoScanPreviewRequest(
            source_type=RepoSourceType.LOCAL_PATH,
            location=str(ROOT / "chatty"),
        )
    )

    assert preview.candidate_service_paths == ["order-service", "user-service"]
    assert len(preview.discovered_services) == 2
    assert preview.discovered_services[0].relative_path == "order-service"
    assert preview.discovered_services[0].reasons
