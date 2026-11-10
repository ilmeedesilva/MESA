from __future__ import annotations

from mesa.fingerprint import new_findings
from mesa.models import (
    SEVERITY_RANK,
    AnalysisResult,
    ArchitectureFitnessGateResult,
    ArchitectureGateMode,
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
    """Evaluate a scan against CI-friendly architecture fitness rules.

    Absolute mode checks fixed thresholds on the whole scan. New-only mode
    needs a baseline and only fails on what changed since it: new findings at
    or above `fail_on_new_severity`, a health drop larger than
    `max_health_drop`, new cycles and new governance violations. A repository
    with existing debt therefore passes as long as a change does not add to it.
    """
    active_thresholds = thresholds or ArchitectureGateThresholds()
    mode = active_thresholds.mode
    if mode == ArchitectureGateMode.NEW_ONLY and baseline is None:
        raise ValueError("New-only mode needs a baseline scan to compare with.")
    health_score = _system_health_score(result)
    baseline_findings = baseline.findings if baseline is not None else None

    if mode == ArchitectureGateMode.NEW_ONLY:
        assert baseline is not None
        health_before = _system_health_score(baseline)
        rules = [
            _new_severity_rule(result.findings, baseline.findings, active_thresholds),
            _health_drop_rule(health_before, health_score, active_thresholds),
            _cyclic_dependency_rule(result.findings, baseline_findings, active_thresholds),
            _governance_rule(result.findings, active_thresholds, baseline_findings),
        ]
    else:
        rules = [
            _minimum_health_score_rule(health_score, active_thresholds),
            _critical_findings_rule(result.findings, active_thresholds),
            _cyclic_dependency_rule(result.findings, baseline_findings, active_thresholds),
            _governance_rule(result.findings, active_thresholds),
            _high_risk_coupling_rule(result.findings, baseline_findings, active_thresholds),
        ]
    failed_rules = [rule.rule_id for rule in rules if not rule.passed]
    gate = ArchitectureFitnessGateResult(
        status=ArchitectureGateStatus.FAILED if failed_rules else ArchitectureGateStatus.PASSED,
        health_score=health_score,
        threshold=active_thresholds.minimum_health_score,
        failed_rules=failed_rules,
        rules=rules,
        thresholds=active_thresholds,
        baseline_scan_id=baseline_scan_id,
        mode=mode,
        health_after=health_score,
    )
    if baseline is not None:
        added = new_findings(result.findings, baseline.findings)
        gate.has_baseline = True
        gate.new_findings = added
        gate.fixed_findings = new_findings(baseline.findings, result.findings)
        gate.unchanged_count = len(result.findings) - len(added)
        gate.health_before = _system_health_score(baseline)
        if gate.health_before is not None and health_score is not None:
            gate.health_delta = round(health_score - gate.health_before, 2)
    return gate


def _new_severity_rule(
    findings: list[Finding],
    baseline_findings: list[Finding],
    thresholds: ArchitectureGateThresholds,
) -> ArchitectureGateRuleResult:
    minimum = SEVERITY_RANK[thresholds.fail_on_new_severity]
    added = new_findings(findings, baseline_findings)
    blocking = [finding for finding in added if SEVERITY_RANK[finding.severity] >= minimum]
    level = thresholds.fail_on_new_severity.value
    return ArchitectureGateRuleResult(
        rule_id="new_findings_at_or_above_severity",
        passed=not blocking,
        message=(
            f"{len(added)} new finding(s); {len(blocking)} at {level} or above."
            if added
            else "No new findings."
        ),
        observed_value=len(blocking),
        threshold=level,
        related_findings=[finding.id for finding in blocking],
    )


def _health_drop_rule(
    health_before: float | None,
    health_after: float | None,
    thresholds: ArchitectureGateThresholds,
) -> ArchitectureGateRuleResult:
    if health_before is None or health_after is None:
        return ArchitectureGateRuleResult(
            rule_id="health_score_drop",
            passed=True,
            message="Health score change is unavailable.",
            threshold=thresholds.max_health_drop,
        )
    drop = round(health_before - health_after, 2)
    passed = drop <= thresholds.max_health_drop
    return ArchitectureGateRuleResult(
        rule_id="health_score_drop",
        passed=passed,
        message=(
            f"Health score {health_before:.1f} -> {health_after:.1f} "
            f"({health_after - health_before:+.1f}); allowed drop is "
            f"{thresholds.max_health_drop:.1f}."
        ),
        observed_value=drop,
        threshold=thresholds.max_health_drop,
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
    findings: list[Finding],
    baseline_findings: list[Finding] | None,
    thresholds: ArchitectureGateThresholds,
) -> ArchitectureGateRuleResult:
    """`baseline_findings` is None when there is no baseline. An empty list is a
    baseline with no findings, and then every cycle is reported as new."""
    cycles = _findings_by_type(findings, FindingType.CYCLIC_DEPENDENCY)
    new_cycles = (
        cycles
        if baseline_findings is None
        else new_findings(
            cycles, _findings_by_type(baseline_findings, FindingType.CYCLIC_DEPENDENCY)
        )
    )
    passed = thresholds.allow_new_cyclic_dependencies or not new_cycles
    return ArchitectureGateRuleResult(
        rule_id="cyclic_dependency_detected",
        passed=passed,
        message=(
            f"Detected {len(new_cycles)} new cyclic dependency finding(s)."
            if baseline_findings is not None
            else f"Detected {len(new_cycles)} cyclic dependency finding(s)."
        ),
        observed_value=len(new_cycles),
        threshold=0 if not thresholds.allow_new_cyclic_dependencies else "allowed",
        related_findings=[finding.id for finding in new_cycles],
    )


def _governance_rule(
    findings: list[Finding],
    thresholds: ArchitectureGateThresholds,
    baseline_findings: list[Finding] | None = None,
) -> ArchitectureGateRuleResult:
    """Without a baseline every violation counts (absolute mode); with one,
    only violations that are not in the baseline."""
    violations = _findings_by_type(findings, FindingType.GOVERNANCE_POLICY_VIOLATION)
    if baseline_findings is not None:
        violations = new_findings(
            violations,
            _findings_by_type(baseline_findings, FindingType.GOVERNANCE_POLICY_VIOLATION),
        )
    passed = thresholds.allow_governance_violations or not violations
    qualifier = "new " if baseline_findings is not None else ""
    return ArchitectureGateRuleResult(
        rule_id="governance_violation_detected",
        passed=passed,
        message=f"Detected {len(violations)} {qualifier}governance policy violation finding(s).",
        observed_value=len(violations),
        threshold=0 if not thresholds.allow_governance_violations else "allowed",
        related_findings=[finding.id for finding in violations],
    )


def _high_risk_coupling_rule(
    findings: list[Finding],
    baseline_findings: list[Finding] | None,
    thresholds: ArchitectureGateThresholds,
) -> ArchitectureGateRuleResult:
    coupling_findings = _high_risk_coupling(findings)
    new_coupling = (
        coupling_findings
        if baseline_findings is None
        else new_findings(coupling_findings, _high_risk_coupling(baseline_findings))
    )
    passed = thresholds.allow_new_high_risk_coupling or not new_coupling
    return ArchitectureGateRuleResult(
        rule_id="high_risk_service_coupling_detected",
        passed=passed,
        message=(
            f"Detected {len(new_coupling)} new high-risk service coupling finding(s)."
            if baseline_findings is not None
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


def _high_risk_coupling(findings: list[Finding]) -> list[Finding]:
    return [
        finding
        for finding in findings
        if finding.type in HIGH_RISK_COUPLING_TYPES
        and finding.severity in {Severity.HIGH, Severity.CRITICAL}
    ]
