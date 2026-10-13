import importlib
from pathlib import Path

from mesa.evaluation import (
    evaluate_benchmark,
    export_evaluation,
    list_available_benchmarks,
    load_ai_baseline_comparison,
    missing_benchmark_service_paths,
    resolve_benchmark_path,
)
from mesa.evaluation.runner import find_matching_ground_truth_system

ROOT = Path(__file__).parent.parent


def test_evaluation_runner_calculates_research_metrics() -> None:
    report = evaluate_benchmark(ROOT / "benchmarks" / "ground_truth.yml")

    assert report["overall"]["true_positives"] > 0
    assert report["overall"]["precision"] >= 0.9
    assert report["overall"]["recall"] >= 0.9
    assert report["overall"]["f1_score"] >= 0.9
    assert {system["id"] for system in report["systems"]} >= {
        "clean-architecture",
        "chatty-services",
        "cyclic-dependencies",
        "shared-database",
        "hard-coded-dependencies",
        "god-service",
        "distributed-monolith",
    }
    assert "CHATTY_SERVICE" in report["by_type"]
    assert "CYCLIC_DEPENDENCY" in report["by_type"]
    assert report["discovery"]["overall"]["system_count"] >= 1
    assert report["discovery"]["overall"]["precision"] is not None
    assert report["explanations"]["overall"]["system_count"] >= 1
    assert report["explanations"]["overall"]["helpfulness_score"] is not None
    assert report["recommendations"]["overall"]["system_count"] >= 1
    assert report["recommendations"]["overall"]["usefulness_score"] is not None
    assert report["evaluation_notes"]["track_summary"]["detector_quality_is_separate_from_explanation_quality"] is True
    phase_i_system = next(system for system in report["phase_i_systems"] if system["id"] == "chatty-services")
    assert phase_i_system["discovery"]["predicted_candidates"]
    assert phase_i_system["explanations"]["cases"]
    assert phase_i_system["recommendations"]["finding_count"] >= 1


def test_evaluation_runner_exports_csv_and_json(tmp_path: Path) -> None:
    report = evaluate_benchmark(ROOT / "benchmarks" / "ground_truth.yml")
    paths = export_evaluation(report, tmp_path)

    json_path = Path(paths["json"])
    csv_path = Path(paths["csv"])
    markdown_path = Path(paths["markdown"])

    assert json_path.exists()
    assert csv_path.exists()
    assert markdown_path.exists()
    assert "precision" in csv_path.read_text(encoding="utf-8")
    assert "mesa-phase-11-synthetic-benchmarks" in json_path.read_text(encoding="utf-8")
    assert "Service Discovery Quality" in markdown_path.read_text(encoding="utf-8")


def test_list_available_benchmarks_includes_known_files_and_excludes_template() -> None:
    listings = list_available_benchmarks()
    ids = {item["id"] for item in listings}

    assert "ground_truth" in ids
    assert "public_repo_manual_review_template" not in ids
    ground_truth = next(item for item in listings if item["id"] == "ground_truth")
    assert ground_truth["system_count"] > 0
    assert "clean-architecture" in ground_truth["system_ids"]


def test_resolve_benchmark_path_rejects_unlisted_and_traversal_ids() -> None:
    assert resolve_benchmark_path("ground_truth") == (ROOT / "benchmarks" / "ground_truth.yml").resolve()
    assert resolve_benchmark_path("public_repo_manual_review_template") is None
    assert resolve_benchmark_path("../pyproject") is None
    assert resolve_benchmark_path("does-not-exist") is None
    assert resolve_benchmark_path("../../etc/passwd") is None


def test_missing_benchmark_service_paths_reports_unresolvable_paths(tmp_path: Path) -> None:
    benchmark_path = tmp_path / "broken.yml"
    benchmark_path.write_text(
        """
benchmark: broken
systems:
  - id: broken-system
    name: Broken system
    service_paths:
      - definitely/does/not/exist
    ground_truth: []
""",
        encoding="utf-8",
    )

    missing = missing_benchmark_service_paths(benchmark_path)

    assert len(missing) == 1
    assert missing[0].endswith("definitely/does/not/exist")


def test_find_matching_ground_truth_system_searches_every_registered_benchmark() -> None:
    """Regression test: find_matching_ground_truth_system() used to only ever
    check the default benchmarks/ground_truth.yml, so a scan of a real
    repository registered in its own real_repo_*.yml (e.g. real_repo_sockshop.yml)
    could never auto-populate research-evaluation-record metrics - the
    Research Evaluation panel always showed N/A for real repos, even ones
    with a fully authored ground truth file, until this was fixed."""
    benchmarks_dir = ROOT / "benchmarks"

    cyclic_paths = [
        str((benchmarks_dir / "../tests/fixtures/cycle/order-service").resolve()),
        str((benchmarks_dir / "../tests/fixtures/cycle/payment-service").resolve()),
    ]
    match = find_matching_ground_truth_system(cyclic_paths)
    assert match is not None
    assert match["system_id"] == "cyclic-dependencies"

    sock_shop_services = [
        "catalogue", "carts", "orders", "payment", "shipping", "user", "queue-master", "front-end",
    ]
    sock_shop_paths = [
        str((benchmarks_dir / "real-repos" / "sock-shop" / name).resolve())
        for name in sock_shop_services
    ]
    match = find_matching_ground_truth_system(sock_shop_paths)
    assert match is not None
    assert match["system_id"] == "sock-shop"
    assert match["benchmark"] == "mesa-real-repo-sockshop"


def test_benchmarks_dir_honours_mesa_workspace_root_override(monkeypatch) -> None:
    """Regression test for a real bug: in the Docker image, the installed
    package lives under /app (baked in at build time) but scanned
    repositories - including MESA's own seeded fixtures and real-repo
    checkouts - are reached via the live-mounted /workspace. BENCHMARKS_DIR
    used to derive purely from __file__, resolving to /app/benchmarks, so a
    scanned service's /workspace/... root_path could never match a
    benchmark's expected path even with byte-identical content - ground
    truth auto-matching for research evaluation records was structurally
    broken inside Docker. MESA_WORKSPACE_ROOT (set in docker-compose.yml)
    fixes this; this test confirms the override is actually honoured.
    """
    import mesa.evaluation.runner as runner_module

    fake_root = str(ROOT)
    monkeypatch.setenv("MESA_WORKSPACE_ROOT", fake_root)
    try:
        importlib.reload(runner_module)
        assert runner_module.BENCHMARKS_DIR == Path(fake_root) / "benchmarks"
    finally:
        monkeypatch.delenv("MESA_WORKSPACE_ROOT", raising=False)
        importlib.reload(runner_module)
    assert missing_benchmark_service_paths(ROOT / "benchmarks" / "ground_truth.yml") == []


def test_load_ai_baseline_comparison_returns_none_when_no_report_exists(tmp_path, monkeypatch) -> None:
    import mesa.evaluation.runner as runner_module

    monkeypatch.setattr(runner_module, "AI_BASELINE_COMPARISON_PATH", tmp_path / "does_not_exist.json")

    assert load_ai_baseline_comparison() is None


def test_load_ai_baseline_comparison_reads_the_exported_report(tmp_path, monkeypatch) -> None:
    import mesa.evaluation.runner as runner_module

    report_path = tmp_path / "ai_baseline_comparison.json"
    report_path.write_text('{"benchmark": "ground_truth.yml", "systems": []}', encoding="utf-8")
    monkeypatch.setattr(runner_module, "AI_BASELINE_COMPARISON_PATH", report_path)

    report = load_ai_baseline_comparison()

    assert report == {"benchmark": "ground_truth.yml", "systems": []}


def test_load_ai_baseline_comparisons_reads_one_report_per_model_directory(tmp_path, monkeypatch) -> None:
    import mesa.evaluation.runner as runner_module
    from mesa.evaluation import load_ai_baseline_comparisons

    for directory, model in (("ai-baseline-comparison", "claude-sonnet-5"), ("ai-baseline-comparison-opus5", "claude-opus-5")):
        (tmp_path / directory).mkdir()
        (tmp_path / directory / "ai_baseline_comparison.json").write_text(
            f'{{"model": "{model}", "systems": []}}', encoding="utf-8"
        )
    (tmp_path / "ai-baseline-comparison-broken").mkdir()
    (tmp_path / "ai-baseline-comparison-broken" / "ai_baseline_comparison.json").write_text("{", encoding="utf-8")
    monkeypatch.setattr(runner_module, "EVALUATION_RESULTS_DIR", tmp_path)

    reports = load_ai_baseline_comparisons()

    assert [report["model"] for report in reports] == ["claude-sonnet-5", "claude-opus-5"]
    assert [report["results_dir"] for report in reports] == ["ai-baseline-comparison", "ai-baseline-comparison-opus5"]


def test_load_ai_baseline_comparisons_returns_empty_list_when_nothing_exported(tmp_path, monkeypatch) -> None:
    import mesa.evaluation.runner as runner_module
    from mesa.evaluation import load_ai_baseline_comparisons

    monkeypatch.setattr(runner_module, "EVALUATION_RESULTS_DIR", tmp_path)

    assert load_ai_baseline_comparisons() == []
