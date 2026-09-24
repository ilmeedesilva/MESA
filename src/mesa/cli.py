from __future__ import annotations

import json
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from mesa import __version__
from mesa.analysis import analyze_services
from mesa.analysis.fitness_gate import evaluate_architecture_gate
from mesa.evaluation import evaluate_benchmark, export_evaluation
from mesa.evaluation.ai_baseline import export_ai_baseline, run_ai_baseline
from mesa.models import AnalysisResult, ArchitectureGateThresholds

app = typer.Typer(help="MESA cross-service static architecture analyzer.")
console = Console()


@app.callback()
def main(version: bool = typer.Option(False, "--version", help="Show version and exit.")) -> None:
    if version:
        console.print(f"MESA {__version__}")
        raise typer.Exit()


@app.command()
def analyze(
    service_paths: list[Path] = typer.Argument(..., help="Service directories to analyze."),
    chatty_threshold: int = typer.Option(3, help="Static call-site threshold for chatty services."),
    output: Path | None = typer.Option(None, "--output", "-o", help="Write JSON report to file."),
) -> None:
    result = analyze_services([str(path) for path in service_paths], chatty_threshold)
    if output:
        output.write_text(result.model_dump_json(indent=2), encoding="utf-8")
        console.print(f"Wrote report to {output}")
        return

    _print_console_report(result.model_dump())


@app.command()
def gate(
    service_paths: list[Path] = typer.Argument(..., help="Service directories to analyze."),
    chatty_threshold: int = typer.Option(3, help="Static call-site threshold for chatty services."),
    minimum_health_score: float = typer.Option(75.0, help="Minimum allowed system health score."),
    maximum_critical_findings: int = typer.Option(0, help="Maximum allowed critical findings."),
    baseline_report: Path | None = typer.Option(
        None,
        "--baseline-report",
        help="Optional previous MESA JSON report for new-risk comparison.",
    ),
    output: Path | None = typer.Option(None, "--output", "-o", help="Write gate JSON to file."),
    fail: bool = typer.Option(True, "--fail/--no-fail", help="Exit with code 1 when the gate fails."),
) -> None:
    result = analyze_services([str(path) for path in service_paths], chatty_threshold)
    baseline = _load_analysis_report(baseline_report) if baseline_report else None
    thresholds = ArchitectureGateThresholds(
        minimum_health_score=minimum_health_score,
        maximum_critical_findings=maximum_critical_findings,
    )
    gate_result = evaluate_architecture_gate(result, thresholds=thresholds, baseline=baseline)
    payload = gate_result.model_dump_json(indent=2)
    if output:
        output.write_text(payload, encoding="utf-8")
        console.print(f"Wrote gate result to {output}")
    else:
        console.print_json(payload)
    if fail and gate_result.status.value == "failed":
        raise typer.Exit(1)


@app.command()
def evaluate(
    benchmark: Path = typer.Argument(..., help="Ground-truth benchmark YAML file."),
    output_dir: Path = typer.Option(Path("evaluation-results"), "--output-dir", "-o", help="Directory for CSV/JSON metrics."),
    chatty_threshold: int = typer.Option(3, help="Static call-site threshold for chatty services."),
) -> None:
    report = evaluate_benchmark(benchmark, chatty_threshold=chatty_threshold)
    paths = export_evaluation(report, output_dir)
    overall = report["detector"]["overall"]
    discovery = report["discovery"]["overall"]
    explanations = report["explanations"]["overall"]
    recommendations = report["recommendations"]["overall"]
    console.print("[bold]MESA Evaluation Report[/bold]")
    console.print(
        f"Detector precision: {overall['precision']} | "
        f"Detector recall: {overall['recall']} | "
        f"Detector F1: {overall['f1_score']}"
    )
    console.print(
        f"Discovery precision: {discovery['precision']} | "
        f"Discovery recall: {discovery['recall']} | "
        f"Discovery F1: {discovery['f1_score']}"
    )
    console.print(
        f"Explanation helpfulness: {explanations['helpfulness_score']} | "
        f"Grounding: {explanations['grounding_score']} | "
        f"Coverage: {explanations['coverage_score']}"
    )
    console.print(
        f"Recommendation usefulness: {recommendations['usefulness_score']} | "
        f"Structured coverage: {recommendations['structured_coverage']}"
    )
    console.print(f"Wrote JSON results to {paths['json']}")
    console.print(f"Wrote CSV results to {paths['csv']}")
    console.print(f"Wrote Markdown summary to {paths['markdown']}")


@app.command("evaluate-ai-baseline")
def evaluate_ai_baseline(
    benchmark: Path = typer.Argument(..., help="Ground-truth benchmark YAML file."),
    systems: str = typer.Option(..., "--systems", help="Comma-separated system ids to run, e.g. god-service,cyclic-dependencies."),
    runs: int = typer.Option(5, "--runs", help="Number of repeated runs per system."),
    provider: str = typer.Option("openai", "--provider", help="Which LLM API to call: openai or anthropic."),
    output_dir: Path = typer.Option(
        Path("evaluation-results/ai-baseline-comparison"), "--output-dir", "-o", help="Directory for JSON/Markdown results."
    ),
) -> None:
    """Prompt a general-purpose LLM directly (no MESA) against the same benchmark
    systems MESA is scored on, to measure accuracy and determinism as a baseline
    comparison. Makes real, billed calls to the selected provider's API
    (MESA_OPENAI_API_KEY, or MESA_ANTHROPIC_API_KEY/ANTHROPIC_API_KEY for
    --provider anthropic) - confirm the cost with the user before running this.
    """
    system_ids = [item.strip() for item in systems.split(",") if item.strip()]
    report = run_ai_baseline(benchmark, system_ids, runs=runs, provider=provider)
    paths = export_ai_baseline(report, output_dir)
    console.print("[bold]MESA AI Baseline Comparison[/bold]")
    for system in report["systems"]:
        console.print(
            f"{system['name']}: F1 {system['f1_score']['mean']} (+/- {system['f1_score']['stdev']}) | "
            f"exact-match rate {system['determinism']['exact_match_rate']} | "
            f"mean pairwise Jaccard {system['determinism']['mean_pairwise_jaccard']}"
        )
    console.print(f"Wrote JSON results to {paths['json']}")
    console.print(f"Wrote Markdown summary to {paths['markdown']}")


def _print_console_report(result: dict) -> None:
    console.print("[bold]MESA Analysis Report[/bold]")
    console.print(
        f"Services: {result['summary']['service_count']} | "
        f"Findings: {result['summary']['finding_count']}"
    )

    table = Table(title="Findings")
    table.add_column("ID")
    table.add_column("Type")
    table.add_column("Severity")
    table.add_column("Services")
    table.add_column("Description")

    for finding in result["findings"]:
        table.add_row(
            finding["id"],
            finding["type"],
            finding["severity"],
            ", ".join(finding["services"]),
            finding["description"],
        )
    console.print(table)
    console.print_json(json.dumps(result["summary"]))


def _load_analysis_report(path: Path) -> AnalysisResult:
    try:
        return AnalysisResult.model_validate_json(path.read_text(encoding="utf-8"))
    except Exception as error:
        raise typer.BadParameter(f"Could not read baseline report '{path}': {error}") from error


if __name__ == "__main__":
    app()
