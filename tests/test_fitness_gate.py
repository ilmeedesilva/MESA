from pathlib import Path

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
