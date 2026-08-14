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


def test_discover_real_repo_style_service_candidates() -> None:
    candidates = discover_service_candidates(ROOT / "real-repo" / "shop")
    by_path = {candidate.relative_path: candidate for candidate in candidates}

    assert {"frontend-service", "catalog-service", "inventory-api"}.issubset(by_path)
    assert by_path["frontend-service"].selected_by_default
    assert by_path["catalog-service"].selected_by_default
    assert by_path["inventory-api"].selected_by_default

    assert by_path["frontend-service"].language in {"javascript", "typescript"}
    assert by_path["catalog-service"].language == "java"
    assert by_path["inventory-api"].signal_counts["openapi_matches"] >= 1
    assert by_path["inventory-api"].signal_counts["kubernetes_matches"] >= 1
    assert by_path["frontend-service"].signal_counts["docker_compose_matches"] >= 1
    assert any("Express" in reason for reason in by_path["frontend-service"].reasons)
    assert any("Spring Boot" in reason for reason in by_path["catalog-service"].reasons)


def test_preview_repository_warns_about_unclear_real_repo_candidates() -> None:
    preview = preview_repository(
        RepoScanPreviewRequest(
            source_type=RepoSourceType.LOCAL_PATH,
            location=str(ROOT / "real-repo" / "shop"),
        )
    )

    assert {"frontend-service", "catalog-service", "inventory-api"}.issubset(
        set(preview.candidate_service_paths)
    )
    assert any("unclear implementation language" in warning for warning in preview.warnings)
