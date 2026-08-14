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
