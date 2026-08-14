from __future__ import annotations

import json
import operator
import re
from typing import Any

import yaml

from mesa.detectors.evidence import evidence_chain_item
from mesa.models import AnalysisResult, Finding, FindingType, PolicyCreate, PolicyRecord, Severity

_RULE_PATTERN = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*(==|!=|<=|>=|<|>)\s*(.+)$")
_OPERATORS = {
    "==": operator.eq,
    "!=": operator.ne,
    "<=": operator.le,
    ">=": operator.ge,
    "<": operator.lt,
    ">": operator.gt,
}
_SERVICE_SCOPED_METRICS = {"outbound_dependencies", "inbound_dependencies"}


def parse_policy_document(content: str) -> list[PolicyCreate]:
    """Parse governance policies from YAML or JSON."""
    try:
        parsed = yaml.safe_load(content)
    except yaml.YAMLError:
        parsed = json.loads(content)
    if parsed is None:
        return []
    policies = parsed.get("policies", parsed) if isinstance(parsed, dict) else parsed
    if not isinstance(policies, list):
        raise ValueError("Policy document must contain a policies list")
    normalized = []
    for policy in policies:
        if isinstance(policy, dict) and "severity" in policy and isinstance(policy["severity"], str):
            policy = {**policy, "severity": policy["severity"].upper()}
        normalized.append(PolicyCreate.model_validate(policy))
    return normalized


def evaluate_policies(result: AnalysisResult, policies: list[PolicyRecord]) -> list[Finding]:
    findings: list[Finding] = []
    global_metrics = _global_metrics(result)
    service_metrics = _service_metrics(result)

    for policy in policies:
        if not policy.enabled:
            continue
        metric, op, expected = _parse_rule(policy.rule)
        if metric in _SERVICE_SCOPED_METRICS:
            findings.extend(_evaluate_service_policy(policy, metric, op, expected, service_metrics))
        else:
            actual = global_metrics.get(metric)
            if actual is None:
                findings.append(_unsupported_policy_finding(policy, metric))
            elif not _OPERATORS[op](actual, expected):
                findings.append(_policy_finding(policy, metric, op, expected, actual, services=[]))
    return findings


def _evaluate_service_policy(
    policy: PolicyRecord,
    metric: str,
    op: str,
    expected: Any,
    service_metrics: dict[str, dict[str, Any]],
) -> list[Finding]:
    findings = []
    for service, metrics in sorted(service_metrics.items()):
        actual = metrics.get(metric, 0)
        if not _OPERATORS[op](actual, expected):
            findings.append(_policy_finding(policy, metric, op, expected, actual, services=[service]))
    return findings


def _global_metrics(result: AnalysisResult) -> dict[str, Any]:
    findings_by_type = result.summary.get("findings_by_type", {})
    endpoints = [endpoint for service in result.services for endpoint in service.endpoints]
    versioned_endpoints = [endpoint for endpoint in endpoints if re.search(r"/v\d+(?:/|$)", endpoint.path)]
    libraries_by_name: dict[str, set[str]] = {}
    for service in result.services:
        for library in service.libraries:
            libraries_by_name.setdefault(library.name.lower(), set()).add(service.name)
    shared_library_count = sum(1 for users in libraries_by_name.values() if len(users) > 1)
    return {
        "dependency_cycle_count": int(findings_by_type.get(FindingType.CYCLIC_DEPENDENCY.value, 0)),
        "shared_database_violation_count": int(findings_by_type.get(FindingType.SHARED_DATABASE.value, 0)),
        "hard_coded_service_url_count": int(findings_by_type.get(FindingType.HARD_CODED_SERVICE_DEPENDENCY.value, 0)),
        "god_service_count": int(findings_by_type.get(FindingType.GOD_SERVICE.value, 0)),
        "finding_count": len(result.findings),
        "service_count": len(result.services),
        "api_versioning_required": len(endpoints) == 0 or len(versioned_endpoints) == len(endpoints),
        "unapproved_shared_library_count": shared_library_count,
    }


def _service_metrics(result: AnalysisResult) -> dict[str, dict[str, Any]]:
    services = {service.name: {"outbound_dependencies": 0, "inbound_dependencies": 0} for service in result.services}
    outbound: dict[str, set[str]] = {service: set() for service in services}
    inbound: dict[str, set[str]] = {service: set() for service in services}
    service_names = set(services)
    for edge in result.graph.get("edges", []):
        source = str(edge.get("source", ""))
        target = str(edge.get("target", ""))
        if source in service_names and target in service_names and source != target:
            outbound[source].add(target)
            inbound[target].add(source)
    for service in services:
        services[service]["outbound_dependencies"] = len(outbound[service])
        services[service]["inbound_dependencies"] = len(inbound[service])
    return services


def _parse_rule(rule: str) -> tuple[str, str, Any]:
    match = _RULE_PATTERN.match(rule.strip())
    if not match:
        raise ValueError(f"Unsupported policy rule: {rule}")
    metric, op, raw_expected = match.groups()
    return metric, op, _parse_value(raw_expected.strip())


def _parse_value(value: str) -> Any:
    lowered = value.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return value.strip("\"'")


def _policy_finding(
    policy: PolicyRecord,
    metric: str,
    op: str,
    expected: Any,
    actual: Any,
    services: list[str],
) -> Finding:
    scope = ", ".join(services) if services else "system"
    return Finding(
        id=f"MESA-GOV-{_safe_policy_id(policy.id)}-{metric}-{scope}"[:80],
        type=FindingType.GOVERNANCE_POLICY_VIOLATION,
        severity=policy.severity,
        confidence=0.96,
        services=services,
        description=(
            f"Governance policy '{policy.name}' failed for {scope}: "
            f"{metric} was {actual}, expected rule '{metric} {op} {expected}'."
        ),
        evidence=[
            {
                "policy_id": policy.id,
                "policy_name": policy.name,
                "rule": policy.rule,
                "metric": metric,
                "operator": op,
                "expected": expected,
                "actual": actual,
                "scope": scope,
                "description": policy.description,
            }
        ],
        recommendation=(
            "Bring the architecture back within the configured governance policy, then re-run "
            "MESA to verify the policy violation is resolved."
        ),
        detector_name="GovernancePolicyEngine",
        rule_id=f"governance-policy.{metric}",
        evidence_chain=[
            evidence_chain_item(
                "parse_policy_rule",
                f"Parsed governance policy rule '{metric} {op} {expected}'.",
                data={"policy_id": policy.id, "policy_name": policy.name},
            ),
            evidence_chain_item(
                "evaluate_metric",
                f"Compared actual value {actual} against expected rule {metric} {op} {expected}.",
                data={
                    "metric": metric,
                    "operator": op,
                    "expected": expected,
                    "actual": actual,
                    "scope": scope,
                },
            ),
        ],
        confidence_reason=(
            "Confidence is very high because the violation is produced by a deterministic "
            "comparison between a configured policy rule and a measured MESA metric."
        ),
        limitations=[
            "A policy violation may indicate that the policy threshold needs adjustment for this project context.",
            "The engine reports rule failure; it does not decide whether the architecture exception is acceptable.",
        ],
        source_files=[],
        related_services=services,
        why_valid=(
            f"The configured policy '{policy.name}' expected {metric} {op} {expected}, "
            f"but MESA measured {actual} for {scope}."
        ),
    )


def _unsupported_policy_finding(policy: PolicyRecord, metric: str) -> Finding:
    return Finding(
        id=f"MESA-GOV-{_safe_policy_id(policy.id)}-unsupported"[:80],
        type=FindingType.GOVERNANCE_POLICY_VIOLATION,
        severity=Severity.MEDIUM,
        confidence=0.8,
        services=[],
        description=f"Governance policy '{policy.name}' uses unsupported metric '{metric}'.",
        evidence=[{"policy_id": policy.id, "rule": policy.rule, "metric": metric}],
        recommendation="Update the policy to use a supported MESA governance metric.",
        detector_name="GovernancePolicyEngine",
        rule_id="governance-policy.unsupported-metric",
        evidence_chain=[
            evidence_chain_item(
                "parse_policy_rule",
                f"Parsed governance policy rule '{policy.rule}'.",
                data={"policy_id": policy.id, "policy_name": policy.name},
            ),
            evidence_chain_item(
                "validate_metric",
                f"Metric '{metric}' is not supported by the current governance engine.",
                data={"metric": metric},
            ),
        ],
        confidence_reason=(
            "Confidence is based on deterministic policy parsing and supported metric validation."
        ),
        limitations=[
            "This finding identifies unsupported policy syntax rather than an architecture defect.",
        ],
        source_files=[],
        related_services=[],
        why_valid=(
            f"The policy '{policy.name}' references unsupported metric '{metric}', so MESA "
            "cannot evaluate the intended governance rule."
        ),
    )


def _safe_policy_id(policy_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "-", policy_id).strip("-") or "policy"
