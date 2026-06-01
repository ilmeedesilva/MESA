from __future__ import annotations

import json
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from mesa import __version__
from mesa.analysis import analyze_services

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


if __name__ == "__main__":
    app()

