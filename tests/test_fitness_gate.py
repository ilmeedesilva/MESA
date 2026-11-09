from pathlib import Path

import pytest

from mesa.analysis import analyze_services
from mesa.analysis.fitness_gate import evaluate_architecture_gate
from mesa.models import ArchitectureGateStatus, ArchitectureGateThresholds

ROOT = Path(__file__).parent / "fixtures"


def test_architecture_gate_fails_default_thresholds_for_structural_risk() -> None:
    result = analyze_services(
        [
            str(ROOT / "cycle" / "order-service"),
            str(ROOT / "cycle" / "payment-service"),
            str(ROOT / "hardcoded" / "billing-service"),
        ]
    )

    gate = evaluate_architecture_gate(result)

    assert gate.status == ArchitectureGateStatus.FAILED
    assert "critical_findings_exceeded" in gate.failed_rules
    assert "cyclic_dependency_detected" in gate.failed_rules
    assert "high_risk_service_coupling_detected" in gate.failed_rules
    assert gate.health_score is not None
    assert gate.threshold == 75.0


def test_architecture_gate_can_pass_with_relaxed_research_thresholds() -> None:
    result = analyze_services([str(ROOT / "clean" / "order-service")])
    thresholds = ArchitectureGateThresholds(
        minimum_health_score=0,
        maximum_critical_findings=10,
        allow_new_cyclic_dependencies=True,
        allow_governance_violations=True,
        allow_new_high_risk_coupling=True,
    )

    gate = evaluate_architecture_gate(result, thresholds=thresholds)

    assert gate.status == ArchitectureGateStatus.PASSED
    assert gate.failed_rules == []
    assert all(rule.passed for rule in gate.rules)


def test_architecture_gate_compares_new_risks_against_baseline() -> None:
    baseline = analyze_services([str(ROOT / "hardcoded" / "billing-service")])
    target = analyze_services(
        [
            str(ROOT / "cycle" / "order-service"),
            str(ROOT / "cycle" / "payment-service"),
            str(ROOT / "hardcoded" / "billing-service"),
        ]
    )
    thresholds = ArchitectureGateThresholds(minimum_health_score=0, maximum_critical_findings=10)

    gate = evaluate_architecture_gate(target, thresholds=thresholds, baseline=baseline)

    cycle_rule = next(rule for rule in gate.rules if rule.rule_id == "cyclic_dependency_detected")
    assert not cycle_rule.passed
    assert cycle_rule.observed_value >= 1


def test_empty_baseline_is_a_baseline_not_a_missing_one() -> None:
    """A base branch with no findings must report cycles as *new*."""
    target = analyze_services(
        [str(ROOT / "cycle" / "order-service"), str(ROOT / "cycle" / "payment-service")]
    )
    empty_baseline = analyze_services([str(ROOT / "clean" / "order-service")])
    assert empty_baseline.findings == []
    thresholds = ArchitectureGateThresholds(minimum_health_score=0, maximum_critical_findings=10)

    with_baseline = evaluate_architecture_gate(target, thresholds, baseline=empty_baseline)
    without_baseline = evaluate_architecture_gate(target, thresholds)

    def cycle_message(gate) -> str:
        return next(r.message for r in gate.rules if r.rule_id == "cyclic_dependency_detected")

    assert cycle_message(with_baseline) == "Detected 1 new cyclic dependency finding(s)."
    assert cycle_message(without_baseline) == "Detected 1 cyclic dependency finding(s)."


def test_existing_cycle_in_baseline_is_not_new() -> None:
    paths = [str(ROOT / "cycle" / "order-service"), str(ROOT / "cycle" / "payment-service")]
    baseline = analyze_services(paths)
    target = analyze_services(paths)
    thresholds = ArchitectureGateThresholds(minimum_health_score=0, maximum_critical_findings=10)

    gate = evaluate_architecture_gate(target, thresholds, baseline=baseline)

    assert "cyclic_dependency_detected" not in gate.failed_rules
    assert "high_risk_service_coupling_detected" not in gate.failed_rules


def _new_only(**overrides) -> ArchitectureGateThresholds:
    from mesa.models import ArchitectureGateMode

    return ArchitectureGateThresholds(mode=ArchitectureGateMode.NEW_ONLY, **overrides)


def test_new_only_mode_passes_existing_debt() -> None:
    """A repository that already has problems passes when a change adds none."""
    paths = [
        str(ROOT / "cycle" / "order-service"),
        str(ROOT / "cycle" / "payment-service"),
        str(ROOT / "hardcoded" / "billing-service"),
    ]
    baseline = analyze_services(paths)
    target = analyze_services(paths)
    assert evaluate_architecture_gate(target).status == ArchitectureGateStatus.FAILED

    gate = evaluate_architecture_gate(target, _new_only(), baseline=baseline)

    assert gate.status == ArchitectureGateStatus.PASSED
    assert gate.new_findings == [] and gate.fixed_findings == []
    assert gate.unchanged_count == len(target.findings)
    assert gate.health_delta == 0.0


def test_new_only_mode_fails_on_a_new_cycle_and_reports_fixed_ones() -> None:
    baseline = analyze_services([str(ROOT / "hardcoded" / "billing-service")])
    target = analyze_services(
        [str(ROOT / "cycle" / "order-service"), str(ROOT / "cycle" / "payment-service")]
    )

    gate = evaluate_architecture_gate(target, _new_only(max_health_drop=100), baseline=baseline)

    assert gate.status == ArchitectureGateStatus.FAILED
    assert "cyclic_dependency_detected" in gate.failed_rules
    assert "new_findings_at_or_above_severity" in gate.failed_rules
    assert {f.type.value for f in gate.new_findings} >= {"CYCLIC_DEPENDENCY"}
    assert len(gate.fixed_findings) == len(baseline.findings)


def test_new_only_severity_threshold() -> None:
    from mesa.models import Severity

    baseline = analyze_services([str(ROOT / "clean" / "order-service")])
    target = analyze_services([str(ROOT / "hardcoded" / "billing-service")])
    severities = {finding.severity for finding in target.findings}
    assert Severity.CRITICAL not in severities  # hard-coded URLs are at most HIGH here

    strict = evaluate_architecture_gate(
        target, _new_only(fail_on_new_severity=Severity.LOW, max_health_drop=100), baseline
    )
    lenient = evaluate_architecture_gate(
        target, _new_only(fail_on_new_severity=Severity.CRITICAL, max_health_drop=100), baseline
    )

    assert "new_findings_at_or_above_severity" in strict.failed_rules
    assert lenient.status == ArchitectureGateStatus.PASSED


def test_new_only_health_drop_limit() -> None:
    from mesa.models import Severity

    baseline = analyze_services([str(ROOT / "clean" / "order-service")])
    target = analyze_services([str(ROOT / "hardcoded" / "billing-service")])
    no_severity_rule = {"fail_on_new_severity": Severity.CRITICAL}

    tight = evaluate_architecture_gate(
        target, _new_only(max_health_drop=0, **no_severity_rule), baseline
    )
    loose = evaluate_architecture_gate(
        target, _new_only(max_health_drop=100, **no_severity_rule), baseline
    )

    assert tight.health_delta is not None and tight.health_delta < 0
    assert tight.failed_rules == ["health_score_drop"]
    assert loose.status == ArchitectureGateStatus.PASSED


def test_new_only_mode_needs_a_baseline() -> None:
    result = analyze_services([str(ROOT / "clean" / "order-service")])

    with pytest.raises(ValueError, match="baseline"):
        evaluate_architecture_gate(result, _new_only())


def test_absolute_mode_is_unchanged_and_the_default() -> None:
    result = analyze_services(
        [str(ROOT / "cycle" / "order-service"), str(ROOT / "cycle" / "payment-service")]
    )

    gate = evaluate_architecture_gate(result)

    assert gate.mode.value == "absolute"
    assert [rule.rule_id for rule in gate.rules] == [
        "minimum_health_score",
        "critical_findings_exceeded",
        "cyclic_dependency_detected",
        "governance_violation_detected",
        "high_risk_service_coupling_detected",
    ]
    assert gate.has_baseline is False and gate.health_delta is None
