from __future__ import annotations

from mesa.models import (
    AnalysisResult,
    ArchitectureFitnessGateResult,
    ArchitectureGateRuleResult,
    ArchitectureGateStatus,
    ArchitectureGateThresholds,
    Finding,
    FindingType,
    Severity,
)


HIGH_RISK_COUPLING_TYPES = {
    FindingType.CHATTY_SERVICE,
    FindingType.HARD_CODED_SERVICE_DEPENDENCY,
    FindingType.SHARED_DATABASE,
}


def evaluate_architecture_gate(
    result: AnalysisResult,
    thresholds: ArchitectureGateThresholds | None = None,
    baseline: AnalysisResult | None = None,
    baseline_scan_id: str | None = None,
) -> ArchitectureFitnessGateResult:
    """Evaluate a scan against CI-friendly architecture fitness rules."""
    active_thresholds = thresholds or ArchitectureGateThresholds()
    health_score = _system_health_score(result)
    rules = [
        _minimum_health_score_rule(health_score, active_thresholds),
        _critical_findings_rule(result.findings, active_thresholds),
        _cyclic_dependency_rule(result.findings, baseline.findings if baseline else [], active_thresholds),
        _governance_rule(result.findings, active_thresholds),
        _high_risk_coupling_rule(
            result.findings, baseline.findings if baseline else [], active_thresholds
        ),
    ]
    failed_rules = [rule.rule_id for rule in rules if not rule.passed]
    return ArchitectureFitnessGateResult(
        status=ArchitectureGateStatus.FAILED if failed_rules else ArchitectureGateStatus.PASSED,
        health_score=health_score,
        threshold=active_thresholds.minimum_health_score,
        failed_rules=failed_rules,
        rules=rules,
        thresholds=active_thresholds,
        baseline_scan_id=baseline_scan_id,
    )


def _minimum_health_score_rule(
    health_score: float | None, thresholds: ArchitectureGateThresholds
) -> ArchitectureGateRuleResult:
    passed = health_score is not None and health_score >= thresholds.minimum_health_score
    message = (
        f"System health score {health_score:.1f} meets the minimum "
        f"{thresholds.minimum_health_score:.1f}."
        if passed and health_score is not None
        else f"System health score is below the minimum {thresholds.minimum_health_score:.1f}."
        if health_score is not None
        else "System health score is unavailable."
    )
    return ArchitectureGateRuleResult(
        rule_id="minimum_health_score",
        passed=passed,
        message=message,
        observed_value=health_score,
        threshold=thresholds.minimum_health_score,
    )


def _critical_findings_rule(
    findings: list[Finding], thresholds: ArchitectureGateThresholds
) -> ArchitectureGateRuleResult:
    critical_findings = [finding for finding in findings if finding.severity == Severity.CRITICAL]
    passed = len(critical_findings) <= thresholds.maximum_critical_findings
    return ArchitectureGateRuleResult(
        rule_id="critical_findings_exceeded",
        passed=passed,
        message=(
            f"Critical finding count is {len(critical_findings)}; "
            f"maximum allowed is {thresholds.maximum_critical_findings}."
        ),
        observed_value=len(critical_findings),
        threshold=thresholds.maximum_critical_findings,
        related_findings=[finding.id for finding in critical_findings],
    )


def _cyclic_dependency_rule(
    findings: list[Finding], baseline_findings: list[Finding], thresholds: ArchitectureGateThresholds
) -> ArchitectureGateRuleResult:
    cycles = _findings_by_type(findings, FindingType.CYCLIC_DEPENDENCY)
    baseline_cycles = _finding_keys(_findings_by_type(baseline_findings, FindingType.CYCLIC_DEPENDENCY))
    new_cycles = [
        finding for finding in cycles if not baseline_findings or _finding_key(finding) not in baseline_cycles
    ]
    passed = thresholds.allow_new_cyclic_dependencies or not new_cycles
    return ArchitectureGateRuleResult(
        rule_id="cyclic_dependency_detected",
        passed=passed,
        message=(
            f"Detected {len(new_cycles)} new cyclic dependency finding(s)."
            if baseline_findings
            else f"Detected {len(new_cycles)} cyclic dependency finding(s)."
        ),
        observed_value=len(new_cycles),
        threshold=0 if not thresholds.allow_new_cyclic_dependencies else "allowed",
        related_findings=[finding.id for finding in new_cycles],
    )


def _governance_rule(
    findings: list[Finding], thresholds: ArchitectureGateThresholds
) -> ArchitectureGateRuleResult:
    violations = _findings_by_type(findings, FindingType.GOVERNANCE_POLICY_VIOLATION)
    passed = thresholds.allow_governance_violations or not violations
    return ArchitectureGateRuleResult(
        rule_id="governance_violation_detected",
        passed=passed,
        message=f"Detected {len(violations)} governance policy violation finding(s).",
        observed_value=len(violations),
        threshold=0 if not thresholds.allow_governance_violations else "allowed",
        related_findings=[finding.id for finding in violations],
    )


def _high_risk_coupling_rule(
    findings: list[Finding], baseline_findings: list[Finding], thresholds: ArchitectureGateThresholds
) -> ArchitectureGateRuleResult:
    coupling_findings = [
        finding
        for finding in findings
        if finding.type in HIGH_RISK_COUPLING_TYPES and finding.severity in {Severity.HIGH, Severity.CRITICAL}
    ]
    baseline_keys = _finding_keys(
        [
            finding
            for finding in baseline_findings
            if finding.type in HIGH_RISK_COUPLING_TYPES
            and finding.severity in {Severity.HIGH, Severity.CRITICAL}
        ]
    )
    new_coupling = [
        finding
        for finding in coupling_findings
        if not baseline_findings or _finding_key(finding) not in baseline_keys
    ]
    passed = thresholds.allow_new_high_risk_coupling or not new_coupling
    return ArchitectureGateRuleResult(
        rule_id="high_risk_service_coupling_detected",
        passed=passed,
        message=(
            f"Detected {len(new_coupling)} new high-risk service coupling finding(s)."
            if baseline_findings
            else f"Detected {len(new_coupling)} high-risk service coupling finding(s)."
        ),
        observed_value=len(new_coupling),
        threshold=0 if not thresholds.allow_new_high_risk_coupling else "allowed",
        related_findings=[finding.id for finding in new_coupling],
    )


def _system_health_score(result: AnalysisResult) -> float | None:
    system_score = result.summary.get("health_scores", {}).get("system")
    if not system_score:
        return None
    return round(float(system_score.get("score", 0.0)), 2)


def _findings_by_type(findings: list[Finding], finding_type: FindingType) -> list[Finding]:
    return [finding for finding in findings if finding.type == finding_type]


def _finding_keys(findings: list[Finding]) -> set[tuple[str, tuple[str, ...]]]:
    return {_finding_key(finding) for finding in findings}


def _finding_key(finding: Finding) -> tuple[str, tuple[str, ...]]:
    return (finding.type.value, tuple(sorted(finding.services)))
