"""Command-line interface, through typer's CliRunner."""

import json
from pathlib import Path

from typer.testing import CliRunner

from mesa.cli import app

runner = CliRunner()
REPO = Path(__file__).parents[1]
FIXTURES = REPO / "tests" / "fixtures"
DEMO = REPO / "demo-projects"
CYCLE = [str(FIXTURES / "cycle" / "order-service"), str(FIXTURES / "cycle" / "payment-service")]


def test_version() -> None:
    result = runner.invoke(app, ["--version"])

    assert result.exit_code == 0
    assert "MESA" in result.output


def test_scan_finds_services_and_writes_relative_paths(tmp_path: Path) -> None:
    out = tmp_path / "report.json"

    result = runner.invoke(app, ["scan", str(DEMO / "myservice-broken"), "-o", str(out)])

    assert result.exit_code == 0, result.output
    report = json.loads(out.read_text(encoding="utf-8"))
    assert report["summary"]["selected_service_paths"] == [
        "order-service",
        "payment-service",
        "platform-service",
        "user-service",
    ]
    assert report["summary"]["finding_count"] == 26
    assert {service["root_path"] for service in report["services"]} == {
        "order-service",
        "payment-service",
        "platform-service",
        "user-service",
    }
    assert "/" + "Users/" not in out.read_text(encoding="utf-8")


def test_scan_text_and_json_output() -> None:
    text = runner.invoke(app, ["scan", str(DEMO / "myservice-fixed")])
    as_json = runner.invoke(app, ["scan", str(DEMO / "myservice-fixed"), "--format", "json"])

    assert text.exit_code == 0 and "Services found: order-service" in text.output
    assert as_json.exit_code == 0
    assert json.loads(as_json.output)["summary"]["service_count"] == 4


def test_scan_reports_bad_config_with_exit_code_2(tmp_path: Path) -> None:
    config = tmp_path / "bad.yml"
    config.write_text("gate:\n  mode: sometimes\n", encoding="utf-8")

    result = runner.invoke(app, ["scan", str(DEMO / "myservice-fixed"), "--config", str(config)])

    assert result.exit_code == 2
    assert "gate.mode" in result.output


def test_scan_applies_a_policy_file(tmp_path: Path) -> None:
    policy = tmp_path / "policies.yml"
    policy.write_text(
        "policies:\n"
        "  - id: no-cycles\n"
        "    name: No cyclic dependencies\n"
        "    rule: dependency_cycle_count == 0\n"
        "    severity: critical\n",
        encoding="utf-8",
    )
    out = tmp_path / "report.json"

    result = runner.invoke(
        app,
        ["scan", str(DEMO / "myservice-broken"), "--policy", str(policy), "-o", str(out)],
    )

    assert result.exit_code == 0, result.output
    report = json.loads(out.read_text(encoding="utf-8"))
    assert report["summary"]["findings_by_type"]["GOVERNANCE_POLICY_VIOLATION"] == 1


def test_gate_documented_forms_still_work(tmp_path: Path) -> None:
    """The commands in docs/guides/ARCHITECTURE_FITNESS_GATE_CI.md."""
    gate_out = tmp_path / "mesa-gate.json"
    baseline = tmp_path / "baseline-report.json"

    plain = runner.invoke(app, ["gate", *CYCLE, "--output", str(gate_out)])
    overrides = runner.invoke(
        app,
        ["gate", *CYCLE, "--minimum-health-score", "80", "--maximum-critical-findings", "0"],
    )
    analyzed = runner.invoke(app, ["analyze", *CYCLE, "--output", str(baseline)])
    compared = runner.invoke(app, ["gate", *CYCLE, "--baseline-report", str(baseline), "--no-fail"])

    assert plain.exit_code == 1  # the cycle fails the default gate
    assert json.loads(gate_out.read_text(encoding="utf-8"))["status"] == "failed"
    assert overrides.exit_code == 1
    assert analyzed.exit_code == 0
    assert compared.exit_code == 0
    assert "Detected 0 new cyclic dependency" in compared.output


def test_gate_new_only_with_reports(tmp_path: Path) -> None:
    base = tmp_path / "base.json"
    head = tmp_path / "head.json"
    runner.invoke(app, ["scan", str(DEMO / "myservice-fixed"), "-o", str(base)])
    runner.invoke(app, ["scan", str(DEMO / "myservice-broken"), "-o", str(head)])

    failed = runner.invoke(
        app,
        [
            "gate",
            "--report",
            str(head),
            "--baseline-report",
            str(base),
            "--mode",
            "new-only",
            "--format",
            "text",
        ],
    )
    same = runner.invoke(
        app,
        ["gate", "--report", str(head), "--baseline-report", str(head), "--mode", "new-only"],
    )

    assert failed.exit_code == 1
    assert "Architecture gate: FAILED" in failed.output
    assert "New: 26 | Fixed: 0" in failed.output
    assert same.exit_code == 0
    assert json.loads(same.output)["new_findings"] == []


def test_gate_argument_errors() -> None:
    neither = runner.invoke(app, ["gate"])
    new_only_alone = runner.invoke(app, ["gate", *CYCLE, "--mode", "new-only"])
    bad_mode = runner.invoke(app, ["gate", *CYCLE, "--mode", "strict"])
    bad_severity = runner.invoke(app, ["gate", *CYCLE, "--fail-on-new-severity", "huge"])

    assert neither.exit_code == 2
    assert new_only_alone.exit_code == 2 and "baseline" in new_only_alone.output
    assert bad_mode.exit_code == 2
    assert bad_severity.exit_code == 2
