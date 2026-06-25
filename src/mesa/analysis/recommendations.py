from __future__ import annotations

import os
from typing import Any

from mesa.models import Finding, FindingRecommendation, FindingType, Severity

_PRIORITY_BY_SEVERITY = {
    Severity.CRITICAL: "Immediate",
    Severity.HIGH: "High",
    Severity.MEDIUM: "Medium",
    Severity.LOW: "Low",
}

_DIFFICULTY_BY_TYPE = {
    FindingType.CHATTY_SERVICE: "Medium",
    FindingType.CYCLIC_DEPENDENCY: "High",
    FindingType.SHARED_DATABASE: "High",
    FindingType.HARD_CODED_SERVICE_DEPENDENCY: "Low",
    FindingType.GOD_SERVICE: "High",
    FindingType.GOVERNANCE_POLICY_VIOLATION: "Medium",
}


def enrich_findings_with_recommendations(findings: list[Finding]) -> list[Finding]:
    """Attach evidence-grounded structured recommendations to every finding."""
    enriched = []
    for finding in findings:
        recommendations = rule_based_recommendations(finding)
        recommendations = _llm_refine_if_enabled(finding, recommendations)
        finding.recommendations = recommendations
        enriched.append(finding)
    return enriched


def rule_based_recommendations(finding: Finding) -> list[FindingRecommendation]:
    evidence = _evidence_summary(finding)
    affected_files = _affected_files(finding.evidence)
    priority = _PRIORITY_BY_SEVERITY[finding.severity]
    difficulty = _DIFFICULTY_BY_TYPE[finding.type]

    if finding.type == FindingType.CHATTY_SERVICE:
        return [
            FindingRecommendation(
                root_cause=(
                    "Multiple static call sites indicate the caller may be using a fine-grained API "
                    "or repeatedly requesting data that could be consolidated."
                ),
                architectural_consequence=(
                    "The services become latency-sensitive and harder to scale independently because "
                    "one workflow depends on repeated cross-service calls."
                ),
                affected_services=finding.services,
                affected_files=affected_files,
                refactoring_steps=[
                    "Review the listed call sites and group them by use case.",
                    "Replace repeated fine-grained calls with a coarser endpoint or query/read model.",
                    "Consider publishing events when the target service owns data needed repeatedly by the caller.",
                    "Re-run MESA and verify the static call count falls below the chatty threshold.",
                ],
                expected_impact="Lower coupling, fewer synchronous hops, and improved scalability under load.",
                priority=priority,
                estimated_difficulty=difficulty,
                evidence=evidence,
            )
        ]

    if finding.type == FindingType.CYCLIC_DEPENDENCY:
        return [
            FindingRecommendation(
                root_cause=(
                    "The affected services depend on each other directly, usually because ownership of "
                    "a workflow or domain concept is split across service boundaries."
                ),
                architectural_consequence=(
                    "The cycle blocks independent deployment, increases change coordination, and can turn "
                    "microservices into a distributed monolith."
                ),
                affected_services=finding.services,
                affected_files=affected_files,
                refactoring_steps=[
                    "Identify the dependency edge in the cycle with the weakest ownership justification.",
                    "Reverse that dependency, replace it with an event, or introduce an orchestration/application service.",
                    "Move shared domain logic into the service that owns the lifecycle of the data or workflow.",
                    "Re-run cycle detection and confirm the cycle is removed.",
                ],
                expected_impact="Improves deployment independence and reduces cascading change risk.",
                priority=priority,
                estimated_difficulty=difficulty,
                evidence=evidence,
            )
        ]

    if finding.type == FindingType.SHARED_DATABASE:
        return [
            FindingRecommendation(
                root_cause=(
                    "Multiple services statically reference the same database, which means data ownership "
                    "is not isolated behind a single service boundary."
                ),
                architectural_consequence=(
                    "Schema changes can break multiple services, deployments become coupled, and teams may "
                    "bypass service APIs to share state."
                ),
                affected_services=finding.services,
                affected_files=affected_files,
                refactoring_steps=[
                    "Choose one service as the authoritative owner for the shared data.",
                    "Move direct database access from non-owner services behind owner APIs or domain events.",
                    "Introduce read models only when consumers need query-optimized replicated data.",
                    "Validate that only the owner service keeps the database connection evidence.",
                ],
                expected_impact="Clearer data ownership, safer schema evolution, and improved deployment autonomy.",
                priority=priority,
                estimated_difficulty=difficulty,
                evidence=evidence,
            )
        ]

    if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY:
        return [
            FindingRecommendation(
                root_cause=(
                    "A concrete host, URL, IP address, or port is embedded in source/config evidence instead "
                    "of being resolved through environment configuration or service discovery."
                ),
                architectural_consequence=(
                    "Deployments become environment-specific, endpoint changes require code/config edits, and "
                    "resilience patterns are harder to centralize."
                ),
                affected_services=finding.services,
                affected_files=affected_files,
                refactoring_steps=[
                    "Move the endpoint value into environment-specific configuration or secrets.",
                    "Centralize client creation behind a typed adapter or service discovery abstraction.",
                    "Replace private IPs and localhost references with deployment-provided service names.",
                    "Add a regression test or configuration check to prevent the endpoint returning to source code.",
                ],
                expected_impact="Improves portability across environments and lowers operational coupling.",
                priority=priority,
                estimated_difficulty=difficulty,
                evidence=evidence,
            )
        ]

    if finding.type == FindingType.GOVERNANCE_POLICY_VIOLATION:
        policy_name = finding.evidence[0].get("policy_name", "architecture policy") if finding.evidence else "architecture policy"
        return [
            FindingRecommendation(
                root_cause=(
                    f"The current architecture violates the configured governance policy '{policy_name}'."
                ),
                architectural_consequence=(
                    "The system is drifting away from an explicitly agreed architecture constraint, "
                    "which can weaken deployment independence, maintainability, or ownership clarity."
                ),
                affected_services=finding.services,
                affected_files=affected_files,
                refactoring_steps=[
                    "Inspect the policy evidence and confirm whether the configured threshold is still valid.",
                    "Identify the services or system metric that caused the violation.",
                    "Refactor dependencies, APIs, configuration, or ownership boundaries until the metric satisfies the rule.",
                    "Re-run MESA and verify the governance finding is removed.",
                ],
                expected_impact="Keeps the architecture aligned with project-specific governance constraints.",
                priority=priority,
                estimated_difficulty=difficulty,
                evidence=evidence,
            )
        ]

    if finding.type == FindingType.GOD_SERVICE:
        domains = _domain_keywords(finding.evidence)
        first_step = (
            f"Group capabilities around candidate domains: {', '.join(domains)}."
            if domains
            else "Group endpoints, files, and responsibilities by cohesive business capability."
        )
        return [
            FindingRecommendation(
                root_cause=(
                    "The service has accumulated too many responsibilities, dependencies, APIs, files, "
                    "domain concepts, or linked findings."
                ),
                architectural_consequence=(
                    "The service becomes a bottleneck for change, scales unevenly, and can centralize too much "
                    "system behavior into one deployable unit."
                ),
                affected_services=finding.services,
                affected_files=affected_files,
                refactoring_steps=[
                    first_step,
                    "Identify the highest-contribution metrics in the evidence and address those first.",
                    "Extract stable cohesive capabilities into separate modules or services only when ownership is clear.",
                    "Move read-heavy responsibilities behind query models and reduce unnecessary outbound dependencies.",
                    "Re-run MESA and confirm the God Service score decreases.",
                ],
                expected_impact="Improves maintainability, service ownership clarity, and independent scalability.",
                priority=priority,
                estimated_difficulty=difficulty,
                evidence=evidence,
            )
        ]

    return [
        FindingRecommendation(
            root_cause="MESA detected an architectural risk from static evidence.",
            architectural_consequence="The affected services may become harder to maintain or deploy independently.",
            affected_services=finding.services,
            affected_files=affected_files,
            refactoring_steps=[finding.recommendation],
            expected_impact="Reduces architectural risk when validated and remediated.",
            priority=priority,
            estimated_difficulty=difficulty,
            evidence=evidence,
        )
    ]


def _llm_refine_if_enabled(
    finding: Finding, recommendations: list[FindingRecommendation]
) -> list[FindingRecommendation]:
    """Optional LangGraph/LangChain hook; returns rule-based guidance unless explicitly enabled."""
    if os.getenv("MESA_LLM_RECOMMENDATIONS", "false").lower() not in {"1", "true", "yes", "on"}:
        return recommendations
    if not finding.evidence:
        return recommendations
    try:
        from langchain_core.prompts import ChatPromptTemplate  # type: ignore
        from langgraph.graph import END, StateGraph  # type: ignore
    except Exception:
        return recommendations

    # Phase 9 keeps the LLM integration optional and conservative. Import success proves the
    # project can host a LangGraph/LangChain workflow, but provider calls are intentionally not
    # made unless a future provider adapter is configured with credentials and model policy.
    _ = ChatPromptTemplate
    _ = END
    _ = StateGraph
    return [recommendation.model_copy(update={"source": "rule-based-llm-ready"}) for recommendation in recommendations]


def _affected_files(evidence: list[dict[str, Any]]) -> list[str]:
    files: set[str] = set()
    for item in _walk_dicts(evidence):
        file_path = item.get("file_path")
        if isinstance(file_path, str) and file_path:
            line_number = item.get("line_number")
            files.add(f"{file_path}:{line_number}" if line_number else file_path)
        source = item.get("source")
        if isinstance(source, dict):
            file_path = source.get("file_path")
            if isinstance(file_path, str) and file_path:
                line_number = source.get("line_number")
                files.add(f"{file_path}:{line_number}" if line_number else file_path)
    return sorted(files)


def _evidence_summary(finding: Finding) -> list[dict[str, Any]]:
    summary = []
    for index, item in enumerate(finding.evidence[:5], start=1):
        summary.append({"index": index, "finding_id": finding.id, "evidence": item})
    return summary


def _domain_keywords(evidence: list[dict[str, Any]]) -> list[str]:
    for item in _walk_dicts(evidence):
        metrics = item.get("metrics")
        if isinstance(metrics, dict) and isinstance(metrics.get("domain_keywords"), list):
            return [str(keyword) for keyword in metrics["domain_keywords"][:6]]
    return []


def _walk_dicts(value: Any):
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            yield from _walk_dicts(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from _walk_dicts(nested)
