from pathlib import Path

from mesa.evaluation import evaluate_benchmark, export_evaluation

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


def test_evaluation_runner_exports_csv_and_json(tmp_path: Path) -> None:
    report = evaluate_benchmark(ROOT / "benchmarks" / "ground_truth.yml")
    paths = export_evaluation(report, tmp_path)

    json_path = Path(paths["json"])
    csv_path = Path(paths["csv"])

    assert json_path.exists()
    assert csv_path.exists()
    assert "precision" in csv_path.read_text(encoding="utf-8")
    assert "mesa-phase-11-synthetic-benchmarks" in json_path.read_text(encoding="utf-8")
