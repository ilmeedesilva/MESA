"""Markdown comment, SARIF and annotations.

Golden files: each `<name>.input.json` in tests/fixtures/reports holds a gate
result and the scan's findings. The expected outputs sit next to it. After an
intended change to a report, regenerate them with

    MESA_UPDATE_GOLDEN=1 pytest tests/test_reporting.py

and review the diff.
"""

import json
import os
from pathlib import Path

import jsonschema
import pytest

from mesa.models import (
    ArchitectureFitnessGateResult,
    Finding,
    FindingType,
    Severity,
    SourceLocation,
)
from mesa.reporting import (
    COMMENT_MARKER,
    LinkContext,
    render_annotations,
    render_markdown,
    render_sarif,
)

REPORTS = Path(__file__).parent / "fixtures" / "reports"
CASES = ["pr-new-cycle", "pr-fixes-cycle", "absolute-cycle"]
LINKS = LinkContext(server_url="https://github.com", repository="octo/shop", sha="abc123")
UPDATE = os.environ.get("MESA_UPDATE_GOLDEN") == "1"


def _load(name: str) -> tuple[ArchitectureFitnessGateResult, list[Finding]]:
    data = json.loads((REPORTS / f"{name}.input.json").read_text(encoding="utf-8"))
    gate = ArchitectureFitnessGateResult.model_validate(data["gate"])
    findings = [Finding.model_validate(item) for item in data["findings"]]
    return gate, findings


def _markdown(name: str, **options) -> str:
    gate, findings = _load(name)
    return render_markdown(
        gate,
        findings=findings,
        base_label="main",
        links=LINKS,
        version="TEST",
        elapsed_seconds=1.0,
        **options,
    )


def _sarif(name: str) -> dict:
    gate, findings = _load(name)
    new = {f.fingerprint for f in gate.new_findings} if gate.has_baseline else None
    return render_sarif(findings, version="TEST", new_fingerprints=new)


def _check_golden(path: Path, actual: str) -> None:
    if UPDATE:
        path.write_text(actual, encoding="utf-8")
    assert path.exists(), f"Missing golden file {path.name}; run with MESA_UPDATE_GOLDEN=1"
    assert actual == path.read_text(encoding="utf-8")


@pytest.mark.parametrize("name", CASES)
def test_markdown_golden(name: str) -> None:
    _check_golden(REPORTS / f"{name}.md", _markdown(name))


@pytest.mark.parametrize("name", CASES)
def test_sarif_golden(name: str) -> None:
    _check_golden(REPORTS / f"{name}.sarif", json.dumps(_sarif(name), indent=2) + "\n")


@pytest.mark.parametrize("name", CASES)
def test_annotations_golden(name: str) -> None:
    gate, findings = _load(name)
    lines = render_annotations(gate.new_findings if gate.has_baseline else findings)
    _check_golden(REPORTS / f"{name}.annotations.txt", "\n".join(lines) + "\n")


@pytest.mark.parametrize("name", CASES)
def test_sarif_matches_the_official_schema(name: str) -> None:
    schema = json.loads((REPORTS / "sarif-schema-2.1.0.json").read_text(encoding="utf-8"))

    jsonschema.Draft4Validator(schema).validate(_sarif(name))


def test_pull_request_comment_layout() -> None:
    report = _markdown("pr-new-cycle")

    assert report.startswith(COMMENT_MARKER)
    assert "MESA architecture check: FAILED (3 new problems, 0 fixed)" in report
    assert "**Health score:** 98.7 → 79.7 (-19.0, allowed drop is 5.0)" in report
    assert "Cyclic dependency: order-service → user-service → order-service" in report
    # file:line links point at the head commit
    assert "(https://github.com/octo/shop/blob/abc123/order-service/app.py#L30)" in report
    # addresses are code, not auto-links
    assert "calls `http://user-service:8080/users/1`" in report
    assert "**Why it matters:**" in report and "**How to fix:**" in report
    assert "(below the blocking level)" in report  # MEDIUM findings in new-only mode
    assert "Static analysis only: no code was executed." in report


def test_absolute_report_lists_all_findings() -> None:
    report = _markdown("absolute-cycle")

    assert "### Problems found" in report
    assert "(3 findings)" in report
    assert "Existing problems" not in report


def test_sarif_details() -> None:
    sarif = _sarif("pr-new-cycle")
    run = sarif["runs"][0]
    by_rule = {result["ruleId"]: result for result in run["results"]}

    cycle = by_rule["mesa/cyclic-dependency"]
    assert cycle["level"] == "error"
    assert cycle["baselineState"] == "new"
    assert cycle["locations"][0]["physicalLocation"]["region"]["startLine"] == 30
    assert len(cycle["partialFingerprints"]["mesaFingerprint/v1"]) == 40
    assert cycle["relatedLocations"]
    assert by_rule["mesa/hard-coded-service-dependency"]["level"] == "warning"
    rule_ids = [rule["id"] for rule in run["tool"]["driver"]["rules"]]
    assert [rule_ids[r["ruleIndex"]] for r in run["results"]] == [
        r["ruleId"] for r in run["results"]
    ]


def _finding(number: int, **overrides) -> Finding:
    values = {
        "id": f"MESA-HCDD-{number:03d}",
        "type": FindingType.HARD_CODED_SERVICE_DEPENDENCY,
        "severity": Severity.HIGH,
        "confidence": 0.9,
        "services": ["order-service"],
        "description": f"order-service directly references http://svc-{number}:80.",
        "evidence": [
            {"value": f"http://svc-{number}:80", "file_path": "a.py", "line_number": number}
        ],
        "recommendation": "Use configuration.",
        "fingerprint": f"{number:040d}",
        "primary_location": SourceLocation(file_path="a.py", line_number=number),
    }
    values.update(overrides)
    return Finding(**values)


def _gate_with(new: list[Finding], existing: list[Finding]) -> ArchitectureFitnessGateResult:
    return ArchitectureFitnessGateResult(
        status="failed",
        threshold=75.0,
        has_baseline=True,
        new_findings=new,
        unchanged_count=len(existing),
        health_before=90.0,
        health_after=50.0,
        health_delta=-40.0,
        mode="new-only",
    )


def test_long_reports_are_cut_and_say_how_many_are_missing() -> None:
    new = [_finding(n) for n in range(1, 400)]
    existing = [_finding(n) for n in range(400, 600)]
    gate = _gate_with(new, existing)

    report = render_markdown(gate, findings=new + existing, version="TEST", max_chars=20_000)

    assert len(report) <= 20_000
    assert "more findings not shown here" in report
    assert "Existing problems not caused by this change: 200 (not blocking)." in report
    assert report.rstrip().endswith("</sub>")


def test_untrusted_text_cannot_break_the_comment() -> None:
    hostile = _finding(
        1,
        description="<script>alert(1)</script> ping @octocat **bold**",
        evidence=[{"value": "http://x:1", "file_path": "a.py", "line_number": 1}],
    )
    gate = _gate_with([hostile], [])

    report = render_markdown(gate, findings=[hostile], version="TEST")
    sarif_text = json.dumps(render_sarif([hostile], version="TEST"))

    assert "<script>" not in report
    assert "@octocat" not in report  # no notification
    assert "alert(1)" in sarif_text  # SARIF is JSON, no escaping needed


def test_findings_without_location_are_counted_not_dropped_silently() -> None:
    system_wide = _finding(1, primary_location=None, evidence=[{"policy_id": "p"}])

    sarif = render_sarif([system_wide, _finding(2)], version="TEST")

    run = sarif["runs"][0]
    assert len(run["results"]) == 1
    assert run["properties"]["findingsWithoutLocation"] == 1
    assert render_annotations([system_wide]) == []


def test_annotation_escaping_and_limit() -> None:
    tricky = _finding(1, description="50% done,\nnext line", severity=Severity.CRITICAL)
    many = [tricky] + [_finding(n) for n in range(2, 30)]

    lines = render_annotations(many)

    assert len(lines) == 10
    first = next(line for line in lines if "50%25 done" in line)
    assert first.startswith(
        "::error file=a.py,line=1,title=MESA%3A Hard-coded service dependency::"
    )
    assert "%0A" in first and "\n" not in first
