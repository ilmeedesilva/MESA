from __future__ import annotations

import json
import os
from pathlib import Path
from typing import NoReturn

import typer
from rich.console import Console
from rich.table import Table

from mesa import __version__
from mesa.analysis import analyze_services
from mesa.analysis.fitness_gate import evaluate_architecture_gate
from mesa.ci import CIError, annotation_lines, render_summary, run_ci
from mesa.config import ConfigError, MesaConfig, load_config
from mesa.evaluation import evaluate_benchmark, export_evaluation
from mesa.evaluation.ai_baseline import export_ai_baseline, run_ai_baseline
from mesa.models import (
    AnalysisResult,
    ArchitectureFitnessGateResult,
    ArchitectureGateMode,
    ArchitectureGateThresholds,
    Severity,
)
from mesa.reporting import render_markdown, render_sarif
from mesa.scan import apply_policies, scan_repository

app = typer.Typer(help="MESA cross-service static architecture analyzer.")
console = Console()
err_console = Console(stderr=True)


def _show_version(value: bool) -> None:
    if value:
        console.print(f"MESA {__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: bool = typer.Option(
        False,
        "--version",
        help="Show version and exit.",
        callback=_show_version,
        is_eager=True,
    ),
) -> None:
    """MESA cross-service static architecture analyzer."""


@app.command()
def analyze(
    service_paths: list[Path] = typer.Argument(..., help="Service directories to analyze."),
    chatty_threshold: int = typer.Option(3, help="Static call-site threshold for chatty services."),
    output: Path | None = typer.Option(None, "--output", "-o", help="Write JSON report to file."),
) -> None:
    """Analyze the given service folders together."""
    result = analyze_services([str(path) for path in service_paths], chatty_threshold)
    if output:
        output.write_text(result.model_dump_json(indent=2), encoding="utf-8")
        console.print(f"Wrote report to {output}")
        return

    _print_console_report(result.model_dump())


@app.command()
def scan(
    root: Path = typer.Argument(Path("."), help="Repository folder to scan."),
    config: Path | None = typer.Option(
        None, "--config", "-c", help="Config file (default: .mesa.yml in ROOT, if present)."
    ),
    policy: Path | None = typer.Option(None, "--policy", help="Governance policy YAML file."),
    output_format: str = typer.Option("text", "--format", help="text or json."),
    output: Path | None = typer.Option(None, "--output", "-o", help="Write the JSON report here."),
) -> None:
    """Find the services under ROOT and analyze them together."""
    _check_choice("--format", output_format, ["text", "json"])
    if not root.is_dir():
        raise typer.BadParameter(f"Not a folder: {root}", param_hint="ROOT")
    mesa_config = _load_config(config, root)
    try:
        result = scan_repository(root, mesa_config, policy_path=policy)
    except ConfigError as error:
        _fail(str(error))
    if output:
        output.write_text(result.model_dump_json(indent=2), encoding="utf-8")
        console.print(f"Wrote report to {output}")
    elif output_format == "json":
        print(result.model_dump_json(indent=2))
    if output_format == "text" and not output:
        services = result.summary.get("selected_service_paths", [])
        console.print(f"Services found: {', '.join(services) if services else 'none'}")
        _print_console_report(result.model_dump())


@app.command()
def gate(
    service_paths: list[Path] | None = typer.Argument(
        None, help="Service directories to analyze (or use --report)."
    ),
    report: Path | None = typer.Option(
        None, "--report", help="A MESA JSON report (from `mesa scan -o`) to check instead."
    ),
    chatty_threshold: int = typer.Option(3, help="Static call-site threshold for chatty services."),
    mode: str = typer.Option(
        "absolute", "--mode", help="absolute (fixed thresholds) or new-only (needs a baseline)."
    ),
    minimum_health_score: float = typer.Option(75.0, help="Minimum allowed system health score."),
    maximum_critical_findings: int = typer.Option(0, help="Maximum allowed critical findings."),
    max_health_drop: float = typer.Option(
        5.0, "--max-health-drop", help="New-only: largest allowed health score drop."
    ),
    fail_on_new_severity: str = typer.Option(
        "HIGH", "--fail-on-new-severity", help="New-only: LOW, MEDIUM, HIGH or CRITICAL."
    ),
    baseline_report: Path | None = typer.Option(
        None,
        "--baseline-report",
        help="Optional previous MESA JSON report for new-risk comparison.",
    ),
    policy: Path | None = typer.Option(
        None, "--policy", help="Governance policy YAML file (with service paths)."
    ),
    output_format: str = typer.Option(
        "json", "--format", help="json, text, markdown (pull request comment) or sarif."
    ),
    output: Path | None = typer.Option(
        None, "--output", "-o", help="Write the result (in --format, text as JSON) to a file."
    ),
    fail: bool = typer.Option(
        True, "--fail/--no-fail", help="Exit with code 1 when the gate fails."
    ),
) -> None:
    """Check a scan against architecture fitness rules."""
    _check_choice("--format", output_format, ["json", "text", "markdown", "sarif"])
    if bool(service_paths) == bool(report):
        raise typer.BadParameter("Give either service paths or --report, not both.")
    if report and policy:
        raise typer.BadParameter("--policy works with service paths. Use `mesa scan --policy`.")
    if report:
        result = _load_analysis_report(report)
    else:
        result = analyze_services([str(path) for path in service_paths or []], chatty_threshold)
        try:
            apply_policies(result, policy)
        except ConfigError as error:
            _fail(str(error))
    baseline = _load_analysis_report(baseline_report) if baseline_report else None
    thresholds = ArchitectureGateThresholds(
        mode=_parse_mode(mode),
        minimum_health_score=minimum_health_score,
        maximum_critical_findings=maximum_critical_findings,
        max_health_drop=max_health_drop,
        fail_on_new_severity=_parse_severity(fail_on_new_severity),
    )
    if thresholds.mode == ArchitectureGateMode.NEW_ONLY and baseline is None:
        raise typer.BadParameter("--mode new-only needs --baseline-report.")
    gate_result = evaluate_architecture_gate(result, thresholds=thresholds, baseline=baseline)
    if output_format == "markdown":
        payload = render_markdown(gate_result, findings=result.findings, version=__version__)
    elif output_format == "sarif":
        new_prints = (
            {f.fingerprint for f in gate_result.new_findings} if gate_result.has_baseline else None
        )
        payload = json.dumps(
            render_sarif(result.findings, version=__version__, new_fingerprints=new_prints),
            indent=2,
        )
    else:
        payload = gate_result.model_dump_json(indent=2)
    if output:
        output.write_text(payload, encoding="utf-8")
        console.print(f"Wrote gate result to {output}")
    elif output_format != "text":
        print(payload)
    if output_format == "text":
        _print_gate(gate_result)
    if fail and gate_result.status.value == "failed":
        raise typer.Exit(1)


@app.command()
def ci(
    base_ref: str | None = typer.Option(
        None, "--base-ref", help="Base commit or branch to compare with (e.g. the PR base SHA)."
    ),
    path: Path = typer.Option(Path("."), "--path", help="Folder to scan inside the repository."),
    config: Path | None = typer.Option(
        None, "--config", "-c", help="Config file (default: .mesa.yml in --path, if present)."
    ),
    policy: Path | None = typer.Option(None, "--policy", help="Governance policy YAML file."),
    mode: str | None = typer.Option(None, "--mode", help="Override gate.mode from the config."),
    max_health_drop: float | None = typer.Option(
        None, "--max-health-drop", help="Override gate.max_health_drop."
    ),
    fail_on_new_severity: str | None = typer.Option(
        None, "--fail-on-new-severity", help="Override gate.fail_on_new_severity."
    ),
    out_dir: Path = typer.Option(Path("mesa-out"), "--out-dir", help="Folder for the reports."),
    head_sha: str | None = typer.Option(
        None, "--head-sha", help="Commit to link file references to (default: HEAD)."
    ),
    annotate: bool | None = typer.Option(
        None,
        "--annotations/--no-annotations",
        help="Print GitHub annotations for new findings (default: on in GitHub Actions).",
    ),
    fail: bool = typer.Option(True, "--fail/--no-fail", help="Exit with code 1 when it fails."),
) -> None:
    """Compare the working tree with --base-ref and fail on new architecture problems."""
    if not path.is_dir():
        raise typer.BadParameter(f"Not a folder: {path}", param_hint="--path")
    mesa_config = _load_config(config, path)
    gate_settings = mesa_config.gate
    if max_health_drop is not None:
        gate_settings = gate_settings.model_copy(update={"max_health_drop": max_health_drop})
    if fail_on_new_severity is not None:
        gate_settings = gate_settings.model_copy(
            update={"fail_on_new_severity": _parse_severity(fail_on_new_severity)}
        )
    thresholds = gate_settings.thresholds(_parse_mode(mode) if mode else None)
    try:
        result = run_ci(
            path=path,
            config=mesa_config,
            thresholds=thresholds,
            out_dir=out_dir,
            base_ref=base_ref or None,
            policy_path=policy,
            head_sha=head_sha or None,
        )
    except (CIError, ConfigError) as error:
        _fail(str(error))
    console.print(render_summary(result), markup=False, highlight=False)
    console.print(f"Wrote reports to {out_dir}")
    if annotate if annotate is not None else os.environ.get("GITHUB_ACTIONS") == "true":
        for line in annotation_lines(result):
            print(line)
    if fail and result.gate.status.value == "failed":
        raise typer.Exit(1)


@app.command()
def evaluate(
    benchmark: Path = typer.Argument(..., help="Ground-truth benchmark YAML file."),
    output_dir: Path = typer.Option(
        Path("evaluation-results"), "--output-dir", "-o", help="Directory for CSV/JSON metrics."
    ),
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
    systems: str = typer.Option(
        ...,
        "--systems",
        help="Comma-separated system ids to run, e.g. god-service,cyclic-dependencies.",
    ),
    runs: int = typer.Option(5, "--runs", help="Number of repeated runs per system."),
    provider: str = typer.Option(
        "openai", "--provider", help="Which LLM API to call: openai or anthropic."
    ),
    output_dir: Path = typer.Option(
        Path("evaluation-results/ai-baseline-comparison"),
        "--output-dir",
        "-o",
        help="Directory for JSON/Markdown results.",
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


def _print_gate(gate_result: ArchitectureFitnessGateResult) -> None:
    status = gate_result.status.value.upper()
    console.print(f"[bold]Architecture gate: {status}[/bold] (mode: {gate_result.mode.value})")
    for rule in gate_result.rules:
        console.print(f"  {'pass' if rule.passed else 'FAIL'}  {rule.message}", markup=False)
    if gate_result.has_baseline:
        console.print(
            f"New: {len(gate_result.new_findings)} | Fixed: {len(gate_result.fixed_findings)} "
            f"| Unchanged: {gate_result.unchanged_count}"
        )


def _load_config(config: Path | None, default_dir: Path) -> MesaConfig:
    try:
        return load_config(config, default_dir=default_dir)
    except ConfigError as error:
        _fail(str(error))


def _parse_mode(value: str) -> ArchitectureGateMode:
    try:
        return ArchitectureGateMode(value.lower())
    except ValueError as error:
        raise typer.BadParameter("Use absolute or new-only.", param_hint="--mode") from error


def _parse_severity(value: str) -> Severity:
    try:
        return Severity(value.upper())
    except ValueError as error:
        raise typer.BadParameter(
            "Use LOW, MEDIUM, HIGH or CRITICAL.", param_hint="--fail-on-new-severity"
        ) from error


def _check_choice(option: str, value: str, choices: list[str]) -> None:
    if value not in choices:
        raise typer.BadParameter(f"Use {' or '.join(choices)}.", param_hint=option)


def _fail(message: str) -> NoReturn:
    err_console.print(f"Error: {message}", markup=False, highlight=False)
    raise typer.Exit(2)


def _load_analysis_report(path: Path) -> AnalysisResult:
    try:
        return AnalysisResult.model_validate_json(path.read_text(encoding="utf-8"))
    except Exception as error:
        raise typer.BadParameter(f"Could not read baseline report '{path}': {error}") from error


if __name__ == "__main__":
    app()
