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


DEMO = Path(__file__).parents[1] / "demo-projects" / "myservice-broken"


def test_discovery_accepts_a_relative_root_with_a_compose_file(monkeypatch) -> None:
    # Regression: a relative root plus docker-compose build contexts raised ValueError.
    monkeypatch.chdir(DEMO.parent)
    candidates = discover_service_candidates(Path("myservice-broken"))

    assert [candidate.relative_path for candidate in candidates] == [
        "order-service",
        "payment-service",
        "platform-service",
        "user-service",
    ]
    assert all(c.signal_counts["docker_compose_matches"] >= 1 for c in candidates)


def test_default_excludes_skip_tests_fixtures_and_the_root(tmp_path: Path) -> None:
    from mesa.discovery.service_candidates import DEFAULT_DISCOVERY_EXCLUDES

    for folder in ["services/order-service", "tests/fixtures/fake-service", "examples/demo-api"]:
        service = tmp_path / folder
        service.mkdir(parents=True)
        (service / "requirements.txt").write_text("fastapi\n", "utf-8")
        (service / "app.py").write_text("app = 1\n", "utf-8")
    (tmp_path / "pyproject.toml").write_text("[project]\nname='x'\n", "utf-8")
    (tmp_path / "main.py").write_text("print(1)\n", "utf-8")

    everything = {c.relative_path for c in discover_service_candidates(tmp_path)}
    filtered = {
        c.relative_path
        for c in discover_service_candidates(
            tmp_path, exclude=DEFAULT_DISCOVERY_EXCLUDES, drop_root_when_nested=True
        )
    }

    assert {".", "tests/fixtures/fake-service", "examples/demo-api"} <= everything
    assert filtered == {"services/order-service"}


def test_include_and_exclude_globs(tmp_path: Path) -> None:
    for folder in ["services/a-service", "services/b-service", "tools/c-service"]:
        service = tmp_path / folder
        service.mkdir(parents=True)
        (service / "requirements.txt").write_text("fastapi\n", "utf-8")
        (service / "app.py").write_text("app = 1\n", "utf-8")

    included = discover_service_candidates(tmp_path, include=["services/*"])
    excluded = discover_service_candidates(tmp_path, exclude=["**/b-service/**", "tools/**"])

    assert [c.relative_path for c in included] == ["services/a-service", "services/b-service"]
    assert [c.relative_path for c in excluded] == ["services/a-service"]


def test_compose_context_inside_an_excluded_folder_is_not_a_candidate(tmp_path: Path) -> None:
    (tmp_path / "examples" / "demo").mkdir(parents=True)
    (tmp_path / "docker-compose.yml").write_text(
        "services:\n  demo:\n    build: ./examples/demo\n", "utf-8"
    )

    assert [c.relative_path for c in discover_service_candidates(tmp_path)] == ["examples/demo"]
    assert discover_service_candidates(tmp_path, exclude=["examples/**"]) == []
