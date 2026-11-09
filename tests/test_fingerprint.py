from pathlib import Path

from mesa.analysis import analyze_services
from mesa.fingerprint import compute_fingerprint, new_findings
from mesa.models import FindingType

ROOT = Path(__file__).parent / "fixtures"
DEMO = Path(__file__).parents[1] / "demo-projects" / "myservice-broken"


def _demo_paths() -> list[str]:
    return [str(path) for path in sorted(DEMO.iterdir()) if path.is_dir()]


def test_every_finding_has_a_fingerprint_and_scans_repeat_exactly() -> None:
    first = analyze_services(_demo_paths())
    second = analyze_services(_demo_paths())

    assert all(len(finding.fingerprint) == 40 for finding in first.findings)
    assert [f.fingerprint for f in first.findings] == [f.fingerprint for f in second.findings]


def test_fingerprint_ignores_ids_line_numbers_and_file_paths() -> None:
    finding = analyze_services([str(ROOT / "hardcoded" / "billing-service")]).findings[0]
    moved = finding.model_copy(deep=True)
    moved.id = "MESA-HCDD-999"
    moved.evidence[0]["line_number"] = 999
    moved.evidence[0]["file_path"] = "elsewhere/app.py"

    assert compute_fingerprint(moved) == compute_fingerprint(finding)


def test_unrelated_findings_do_not_change_existing_fingerprints() -> None:
    alone = analyze_services([str(ROOT / "hardcoded" / "billing-service")])
    together = analyze_services(
        [
            str(ROOT / "cycle" / "order-service"),
            str(ROOT / "cycle" / "payment-service"),
            str(ROOT / "hardcoded" / "billing-service"),
        ]
    )

    together_prints = {finding.fingerprint for finding in together.findings}
    assert {finding.fingerprint for finding in alone.findings} <= together_prints


def test_two_different_urls_between_the_same_services_differ() -> None:
    findings = [
        finding
        for finding in analyze_services([str(ROOT / "hardcoded" / "billing-service")]).findings
        if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY
    ]
    values = {finding.evidence[0]["value"] for finding in findings}
    assert len(values) > 1
    assert len({finding.fingerprint for finding in findings}) == len(values)


def test_new_findings_counts_repeated_fingerprints() -> None:
    finding = analyze_services([str(ROOT / "hardcoded" / "billing-service")]).findings[0]
    copy = finding.model_copy(deep=True)

    assert new_findings([finding], [finding]) == []
    assert new_findings([finding, copy], [finding]) == [copy]
    assert new_findings([finding], []) == [finding]


def test_reports_without_fingerprints_are_still_compared() -> None:
    finding = analyze_services([str(ROOT / "hardcoded" / "billing-service")]).findings[0]
    old_report_finding = finding.model_copy(update={"fingerprint": ""})

    assert new_findings([finding], [old_report_finding]) == []
