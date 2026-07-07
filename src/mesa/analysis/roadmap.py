from __future__ import annotations

from collections import Counter, defaultdict
from statistics import mean
from typing import Any

from mesa.models import (
    AnalysisResult,
    Finding,
    FindingRecommendation,
    FindingType,
    RefactoringPlaybook,
    RefactoringPlaybookPhase,
    RemediationRoadmap,
    RoadmapAction,
    RoadmapBucket,
    RoadmapDependency,
    RoadmapPlanStep,
    Severity,
)

_SEVERITY_RANK = {
    Severity.LOW: 1,
    Severity.MEDIUM: 2,
    Severity.HIGH: 3,
    Severity.CRITICAL: 4,
}

_BUCKET_BY_TYPE = {
    FindingType.HARD_CODED_SERVICE_DEPENDENCY: RoadmapBucket.QUICK_WIN,
    FindingType.CHATTY_SERVICE: RoadmapBucket.MEDIUM_TERM,
    FindingType.GOVERNANCE_POLICY_VIOLATION: RoadmapBucket.MEDIUM_TERM,
    FindingType.CYCLIC_DEPENDENCY: RoadmapBucket.HIGH_EFFORT,
    FindingType.SHARED_DATABASE: RoadmapBucket.HIGH_EFFORT,
    FindingType.GOD_SERVICE: RoadmapBucket.HIGH_EFFORT,
}

_EXECUTION_BONUS = {
    RoadmapBucket.QUICK_WIN: 6.0,
    RoadmapBucket.MEDIUM_TERM: 3.0,
    RoadmapBucket.HIGH_EFFORT: 0.0,
}

_IMPACTED_DIMENSIONS = {
    FindingType.HARD_CODED_SERVICE_DEPENDENCY: ["hard_coded_dependency_risk", "deployment_independence"],
    FindingType.CHATTY_SERVICE: ["coupling", "api_complexity", "deployment_independence"],
    FindingType.CYCLIC_DEPENDENCY: ["cyclic_dependencies", "coupling", "deployment_independence"],
    FindingType.SHARED_DATABASE: ["shared_database_usage", "ownership_clarity", "deployment_independence"],
    FindingType.GOD_SERVICE: ["god_service_risk", "cohesion", "coupling", "ownership_clarity"],
    FindingType.GOVERNANCE_POLICY_VIOLATION: ["deployment_independence", "ownership_clarity"],
}


def build_remediation_roadmap(scan_id: str, result: AnalysisResult) -> RemediationRoadmap:
    findings = result.findings
    system_score, weak_dimensions = _system_health_context(result)
    if not findings:
        return RemediationRoadmap(
            scan_id=scan_id,
            generated_from_finding_count=0,
            system_health_score=system_score,
            summary="No remediation roadmap was generated because this scan does not contain active findings.",
        )

    service_scores = _service_score_map(result)
    centrality = _service_centrality(result)
    linked_findings = Counter(service for finding in findings for service in finding.services)
    actions = [
        _build_action(
            scan_id=scan_id,
            cluster_index=index,
            findings=cluster,
            service_scores=service_scores,
            centrality=centrality,
            linked_findings=linked_findings,
            system_score=system_score,
            weak_dimensions=weak_dimensions,
        )
        for index, cluster in enumerate(_cluster_findings(findings), start=1)
    ]

    dependencies = _derive_dependencies(actions)
    for action in actions:
        action.dependencies = [item.depends_on for item in dependencies if item.action_id == action.id]

    ordered_actions = _ordered_actions(actions, dependencies)
    for rank, action in enumerate(ordered_actions, start=1):
        action.priority_rank = rank

    return RemediationRoadmap(
        scan_id=scan_id,
        generated_from_finding_count=len(findings),
        system_health_score=system_score,
        summary=_roadmap_summary(findings, ordered_actions, system_score),
        quick_wins=[action for action in ordered_actions if action.bucket == RoadmapBucket.QUICK_WIN],
        medium_term_changes=[action for action in ordered_actions if action.bucket == RoadmapBucket.MEDIUM_TERM],
        high_effort_refactors=[action for action in ordered_actions if action.bucket == RoadmapBucket.HIGH_EFFORT],
        suggested_order=[
            RoadmapPlanStep(
                order=index,
                action_id=action.id,
                title=action.title,
                bucket=action.bucket,
                why_now=action.suggested_order_reason,
            )
            for index, action in enumerate(ordered_actions, start=1)
        ],
        dependencies=dependencies,
    )


def _cluster_findings(findings: list[Finding]) -> list[list[Finding]]:
    grouped: dict[tuple[Any, ...], list[Finding]] = defaultdict(list)
    for finding in findings:
        grouped[_cluster_key(finding)].append(finding)
    return [grouped[key] for key in sorted(grouped.keys(), key=lambda value: repr(value))]


def _cluster_key(finding: Finding) -> tuple[Any, ...]:
    if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY:
        return ("hardcoded", "global")
    if finding.type == FindingType.CHATTY_SERVICE:
        evidence = finding.evidence[0] if finding.evidence else {}
        caller = str(evidence.get("caller", finding.services[0] if finding.services else "unknown"))
        callee = str(evidence.get("callee", finding.services[-1] if finding.services else "unknown"))
        return ("chatty", caller, callee)
    if finding.type == FindingType.CYCLIC_DEPENDENCY:
        cycle = tuple(sorted(_cycle_services(finding)))
        return ("cycle",) + cycle
    if finding.type == FindingType.SHARED_DATABASE:
        database = _shared_database_key(finding)
        return ("shared_database", database)
    if finding.type == FindingType.GOD_SERVICE:
        service = finding.services[0] if finding.services else finding.id
        return ("god_service", service)
    if finding.type == FindingType.GOVERNANCE_POLICY_VIOLATION:
        return ("governance", _policy_name(finding).lower())
    return (finding.type.value,) + tuple(sorted(finding.services))


def _build_action(
    *,
    scan_id: str,
    cluster_index: int,
    findings: list[Finding],
    service_scores: dict[str, float],
    centrality: dict[str, float],
    linked_findings: Counter[str],
    system_score: float | None,
    weak_dimensions: list[str],
) -> RoadmapAction:
    primary_type = findings[0].type
    bucket = _BUCKET_BY_TYPE[primary_type]
    affected_services = sorted({service for finding in findings for service in finding.services})
    recommendations = [recommendation for finding in findings for recommendation in finding.recommendations[:1]]
    title, summary, rationale, suggested_order_reason = _action_text(
        primary_type=primary_type,
        findings=findings,
        services=affected_services,
        recommendations=recommendations,
    )
    impacted_dimensions = [
        dimension
        for dimension in _IMPACTED_DIMENSIONS.get(primary_type, [])
        if dimension in weak_dimensions
    ] or _IMPACTED_DIMENSIONS.get(primary_type, [])[:2]
    average_confidence = round(mean(finding.confidence for finding in findings), 2)
    max_severity = max(findings, key=lambda finding: _SEVERITY_RANK[finding.severity]).severity
    max_centrality = round(max((centrality.get(service, 0.0) for service in affected_services), default=0.0), 2)
    max_linked_findings = max((linked_findings.get(service, 0) for service in affected_services), default=len(findings))
    service_health = _service_health_pressure(affected_services, service_scores, system_score)
    priority_score = _priority_score(
        primary_type=primary_type,
        findings=findings,
        max_centrality=max_centrality,
        max_linked_findings=max_linked_findings,
        service_health_pressure=service_health,
    )
    expected_benefit = _expected_benefit(recommendations, primary_type)
    estimated_difficulty = _estimated_difficulty(recommendations, bucket)
    related_findings = [finding.id for finding in findings]

    return RoadmapAction(
        id=f"roadmap-{scan_id[:8]}-{cluster_index:02d}",
        title=title,
        bucket=bucket,
        priority_rank=cluster_index,
        priority_score=priority_score,
        summary=summary,
        rationale=rationale,
        expected_benefit=expected_benefit,
        suggested_order_reason=suggested_order_reason,
        estimated_difficulty=estimated_difficulty,
        affected_services=affected_services,
        related_findings=related_findings,
        related_finding_types=sorted({finding.type for finding in findings}, key=lambda item: item.value),
        metrics={
            "finding_count": len(findings),
            "max_severity": max_severity.value,
            "average_confidence": average_confidence,
            "service_centrality": max_centrality,
            "max_linked_findings": max_linked_findings,
            "service_health_pressure": round(service_health, 2),
            "impacted_dimensions": impacted_dimensions,
        },
        playbook=_build_playbook(
            primary_type=primary_type,
            findings=findings,
            services=affected_services,
            recommendations=recommendations,
            summary=summary,
            rationale=rationale,
            expected_benefit=expected_benefit,
            estimated_difficulty=estimated_difficulty,
            related_findings=related_findings,
        ),
    )


def _action_text(
    *,
    primary_type: FindingType,
    findings: list[Finding],
    services: list[str],
    recommendations: list[FindingRecommendation],
) -> tuple[str, str, str, str]:
    service_text = _service_text(services)
    if primary_type == FindingType.HARD_CODED_SERVICE_DEPENDENCY:
        occurrences = sum(
            max(int(evidence.get("duplicate_occurrences", 1)), 1)
            for finding in findings
            for evidence in finding.evidence
        )
        return (
            f"Externalize hard-coded endpoints in {len(services)} service{'s' if len(services) != 1 else ''}",
            f"Replace embedded hosts, URLs, or ports across {service_text} with deployment-managed configuration.",
            f"MESA found {len(findings)} hard-coded endpoint signals covering roughly {occurrences} repeated occurrences. "
            "Cleaning these first reduces environment drift and makes later refactors safer to execute.",
            "This is a low-effort quick win that removes operational coupling and clears noise before deeper structural work.",
        )
    if primary_type == FindingType.CHATTY_SERVICE:
        evidence = findings[0].evidence[0] if findings[0].evidence else {}
        caller = str(evidence.get("caller", services[0] if services else "caller"))
        callee = str(evidence.get("callee", services[-1] if services else "callee"))
        call_count = sum(int(finding.evidence[0].get("call_count", 0)) for finding in findings if finding.evidence)
        return (
            f"Reduce chatty traffic between {caller} and {callee}",
            f"Consolidate repeated synchronous calls between {caller} and {callee} into coarser APIs, events, or read models.",
            f"MESA counted {call_count} static call sites across this interaction path. The pattern increases latency sensitivity "
            "and pushes two services toward tighter runtime coupling.",
            "Address this after obvious configuration cleanups so the API boundary can be redesigned on stable client wiring.",
        )
    if primary_type == FindingType.CYCLIC_DEPENDENCY:
        cycle = " -> ".join(_cycle_services(findings[0]))
        return (
            f"Break the dependency cycle across {service_text}",
            f"Remove the bidirectional dependency loop that currently ties {service_text} into the same change path.",
            f"The detected cycle path is {cycle}. Cycles directly block deployment independence and often hide unclear ownership.",
            "Prioritize this structural refactor early because it affects multiple services and amplifies other risks when left in place.",
        )
    if primary_type == FindingType.SHARED_DATABASE:
        database = _shared_database_key(findings[0])
        database_label = database if len(database) <= 42 else f"{database[:39]}..."
        return (
            f"Remove shared database access for {service_text}",
            f"Assign one data owner for {database_label} and move other services behind APIs, events, or read models.",
            f"MESA found direct persistence coupling across {service_text}. Shared database access weakens ownership clarity and makes schema changes risky.",
            "Treat this as a major architectural refactor because it changes data ownership and usually needs staged migration work.",
        )
    if primary_type == FindingType.GOD_SERVICE:
        service = services[0] if services else "the hotspot service"
        return (
            f"Decompose the hotspot service {service}",
            f"Split {service} into clearer responsibility boundaries and reduce the amount of behavior concentrated in one deployable unit.",
            f"MESA marked {service} as an oversized hotspot linked to multiple architectural stress signals. "
            "Breaking surrounding coupling first will make the decomposition safer and easier to scope.",
            "Schedule this after related coupling and ownership fixes so the extraction plan is based on cleaner boundaries.",
        )

    policy_name = _policy_name(findings[0])
    return (
        f"Bring policy '{policy_name}' back into compliance",
        f"Use the related remediation work to satisfy the governance rule '{policy_name}' and re-run the scan to confirm compliance.",
        "This governance action captures an agreed architectural rule that is currently being violated. "
        "It should be closed only after the underlying structural causes are resolved.",
        "Use this as a verification checkpoint after the overlapping fixes complete, not as an isolated refactor.",
    )


def _expected_benefit(recommendations: list[FindingRecommendation], primary_type: FindingType) -> str:
    if recommendations:
        return recommendations[0].expected_impact
    fallback = {
        FindingType.HARD_CODED_SERVICE_DEPENDENCY: "Improves environment portability and reduces endpoint drift.",
        FindingType.CHATTY_SERVICE: "Reduces synchronous coupling and improves latency resilience.",
        FindingType.CYCLIC_DEPENDENCY: "Improves independent deployment and lowers cascading change risk.",
        FindingType.SHARED_DATABASE: "Improves ownership clarity and safer schema evolution.",
        FindingType.GOD_SERVICE: "Improves service maintainability and responsibility clarity.",
        FindingType.GOVERNANCE_POLICY_VIOLATION: "Brings the system back in line with agreed architecture rules.",
    }
    return fallback[primary_type]


def _build_playbook(
    *,
    primary_type: FindingType,
    findings: list[Finding],
    services: list[str],
    recommendations: list[FindingRecommendation],
    summary: str,
    rationale: str,
    expected_benefit: str,
    estimated_difficulty: str,
    related_findings: list[str],
) -> RefactoringPlaybook:
    service_text = _service_text(services)
    first_recommendation = recommendations[0] if recommendations else None
    recommended_strategy = _playbook_strategy(primary_type, findings, service_text)
    if first_recommendation and first_recommendation.refactoring_steps:
        recommended_strategy = (
            f"{recommended_strategy} Use the detector recommendation as the first implementation checklist: "
            f"{first_recommendation.refactoring_steps[0]}"
        )
    phases = _playbook_phases(primary_type, findings, service_text)
    return RefactoringPlaybook(
        problem_summary=summary,
        impact=f"{rationale} Expected benefit: {expected_benefit}",
        recommended_strategy=recommended_strategy,
        phases=phases,
        verification_checks=_playbook_verification(primary_type, services),
        rollback_plan=_playbook_rollback(primary_type),
        risks=_playbook_risks(primary_type),
        estimated_effort=_playbook_effort(primary_type, estimated_difficulty, len(findings), len(services)),
        related_services=services,
        related_findings=related_findings,
    )


def _playbook_strategy(primary_type: FindingType, findings: list[Finding], service_text: str) -> str:
    if primary_type == FindingType.HARD_CODED_SERVICE_DEPENDENCY:
        return (
            "Move endpoint values out of source code into environment-specific configuration, "
            "then route clients through a small typed configuration or service discovery adapter."
        )
    if primary_type == FindingType.CHATTY_SERVICE:
        return (
            "Redesign the interaction between the caller and callee around a coarser API, cached read model, "
            "or event-driven update so one user workflow does not require repeated synchronous hops."
        )
    if primary_type == FindingType.CYCLIC_DEPENDENCY:
        cycle = " -> ".join(_cycle_services(findings[0]))
        return (
            f"Choose one edge in the cycle ({cycle}) to remove, then replace it with an event, orchestration step, "
            "or ownership transfer that preserves behavior without bidirectional service knowledge."
        )
    if primary_type == FindingType.SHARED_DATABASE:
        database = _shared_database_key(findings[0])
        return (
            f"Assign a single owning service for {database}; move all other services behind owner APIs, events, "
            "or replicated read models before removing direct database credentials."
        )
    if primary_type == FindingType.GOD_SERVICE:
        return (
            f"Stabilize the boundaries around {service_text}, then extract cohesive capabilities in thin vertical slices "
            "instead of splitting by technical layers."
        )
    return (
        "Treat the governance violation as an executable architecture checkpoint: resolve the underlying finding, "
        "rerun the policy, and document any temporary exception with expiry."
    )


def _playbook_phases(
    primary_type: FindingType, findings: list[Finding], service_text: str
) -> list[RefactoringPlaybookPhase]:
    if primary_type == FindingType.HARD_CODED_SERVICE_DEPENDENCY:
        return [
            RefactoringPlaybookPhase(
                title="Phase 1 - Inventory and classify endpoint references",
                objective="Create a complete list of hard-coded hosts, ports, and URLs before changing behavior.",
                steps=[
                    "Group occurrences by target service, environment, and source file.",
                    "Separate production endpoints from test fixtures, examples, and local development defaults.",
                    "Identify owners for each client service that must receive replacement configuration.",
                ],
                verification_checks=[
                    "Every related finding maps to an owner and target configuration key.",
                    "False positives are marked before implementation begins.",
                ],
            ),
            RefactoringPlaybookPhase(
                title="Phase 2 - Externalize and standardize configuration",
                objective="Replace embedded endpoint values with deployment-managed configuration.",
                steps=[
                    "Introduce typed configuration keys or a service discovery lookup for each target.",
                    "Provide safe local defaults only in development-specific configuration files.",
                    "Update deployment manifests, compose files, or secret/config stores with environment values.",
                ],
                verification_checks=[
                    "Application startup fails clearly when required endpoint configuration is missing.",
                    "No production endpoint is still committed in source code.",
                ],
            ),
            RefactoringPlaybookPhase(
                title="Phase 3 - Prove portability",
                objective="Confirm the service can move between environments without source edits.",
                steps=[
                    "Run the affected services with at least two different endpoint configurations.",
                    "Add a regression check that scans for committed service URLs.",
                    "Document the approved configuration keys for future integrations.",
                ],
                verification_checks=[
                    "The MESA hard-coded dependency finding no longer appears after a rescan.",
                    "Integration tests pass with configuration injected at runtime.",
                ],
            ),
        ]
    if primary_type == FindingType.CHATTY_SERVICE:
        evidence = findings[0].evidence[0] if findings[0].evidence else {}
        caller = str(evidence.get("caller", "caller service"))
        callee = str(evidence.get("callee", "callee service"))
        return [
            RefactoringPlaybookPhase(
                title="Phase 1 - Map the user workflow behind the calls",
                objective=f"Understand why {caller} repeatedly calls {callee} before redesigning the API.",
                steps=[
                    "Trace the request path and group call sites by user action or batch job.",
                    "Identify which responses are required immediately and which can be cached or eventual.",
                    "Measure current latency, timeout, retry, and failure behavior for the interaction.",
                ],
                verification_checks=[
                    "The team can name the workflow that creates the repeated calls.",
                    "Critical synchronous data is separated from optional enrichment data.",
                ],
            ),
            RefactoringPlaybookPhase(
                title="Phase 2 - Introduce a coarser boundary",
                objective="Reduce the number of synchronous cross-service hops needed by one workflow.",
                steps=[
                    "Design one coarse endpoint, read model, batch endpoint, or domain event for the repeated data need.",
                    "Ship the new boundary beside the existing calls and migrate one caller path first.",
                    "Add contract tests so caller and callee can evolve without hidden coupling.",
                ],
                verification_checks=[
                    "The migrated path performs fewer cross-service calls than the baseline.",
                    "Timeout and retry behavior is explicit at the new boundary.",
                ],
            ),
            RefactoringPlaybookPhase(
                title="Phase 3 - Remove the noisy interaction path",
                objective="Retire duplicate call sites and keep only the simpler interaction model.",
                steps=[
                    "Migrate remaining caller paths and delete unused client methods.",
                    "Update API documentation and ownership notes for the new boundary.",
                    "Rescan the repository and compare call-count evidence with the original finding.",
                ],
                verification_checks=[
                    "MESA reports lower chatty-service evidence for this caller and callee.",
                    "Production metrics show lower latency or fewer downstream calls for the workflow.",
                ],
            ),
        ]
    if primary_type == FindingType.CYCLIC_DEPENDENCY:
        return [
            RefactoringPlaybookPhase(
                title="Phase 1 - Choose the weakest dependency edge",
                objective="Break the cycle at the edge with the lowest business ownership cost.",
                steps=[
                    "List each dependency edge in the detected cycle and the behavior it supports.",
                    "Choose the edge that can become an event, callback, orchestration step, or ownership transfer.",
                    "Define the source-of-truth service for the data or command crossing that edge.",
                ],
                verification_checks=[
                    "The target edge has a named replacement pattern and service owner.",
                    "No service in the cycle needs a simultaneous release for the first change.",
                ],
            ),
            RefactoringPlaybookPhase(
                title="Phase 2 - Replace the direct dependency",
                objective="Remove bidirectional knowledge without changing externally visible behavior.",
                steps=[
                    "Introduce the replacement event, orchestrator, or owned API behind a feature flag if possible.",
                    "Move one call path to the new interaction and observe consistency behavior.",
                    "Add contract or message-schema tests for the replacement boundary.",
                ],
                verification_checks=[
                    "The old edge can be disabled in a test environment without breaking the workflow.",
                    "Observability shows the replacement path is being used successfully.",
                ],
            ),
            RefactoringPlaybookPhase(
                title="Phase 3 - Delete the old edge and rescan",
                objective="Make the acyclic dependency direction permanent.",
                steps=[
                    "Remove unused client code, imports, deployment permissions, and configuration for the old edge.",
                    "Update architecture documentation to show the new dependency direction.",
                    "Run MESA again to confirm the cycle is gone.",
                ],
                verification_checks=[
                    "No cyclic dependency finding remains for these services.",
                    "Deployment order no longer requires the services in the cycle to move together.",
                ],
            ),
        ]
    if primary_type == FindingType.SHARED_DATABASE:
        database = _shared_database_key(findings[0])
        return [
            RefactoringPlaybookPhase(
                title="Phase 1 - Declare data ownership",
                objective=f"Choose one service to own writes and schema evolution for {database}.",
                steps=[
                    "Inventory which services read, write, migrate, or join against the shared database objects.",
                    "Select the owning service and classify every other service as read-only, write-dependent, or reporting.",
                    "Define the replacement access pattern for each non-owner service.",
                ],
                verification_checks=[
                    "There is exactly one named owner for schema changes.",
                    "Every non-owner access has an API, event, export, or read-model replacement path.",
                ],
            ),
            RefactoringPlaybookPhase(
                title="Phase 2 - Migrate consumers behind owner boundaries",
                objective="Move non-owner services away from direct database access in controlled slices.",
                steps=[
                    "Add owner APIs or published events for the highest-risk consumer first.",
                    "Use dual-read comparison or shadow traffic to validate behavior before cutting over.",
                    "Remove direct credentials from each migrated non-owner service.",
                ],
                verification_checks=[
                    "Migrated services no longer require direct database credentials.",
                    "Data parity checks pass between old and new access paths.",
                ],
            ),
            RefactoringPlaybookPhase(
                title="Phase 3 - Lock ownership and simplify operations",
                objective="Prevent shared database coupling from returning.",
                steps=[
                    "Delete obsolete queries, migrations, and connection configuration from non-owner services.",
                    "Restrict database permissions so only the owner can write or migrate owned tables.",
                    "Add a governance rule or CI check for shared database access.",
                ],
                verification_checks=[
                    "MESA no longer detects the shared database finding.",
                    "Database permissions match the declared ownership model.",
                ],
            ),
        ]
    if primary_type == FindingType.GOD_SERVICE:
        return [
            RefactoringPlaybookPhase(
                title="Phase 1 - Find cohesive responsibility slices",
                objective=f"Turn {service_text} from a vague hotspot into a set of extractable capabilities.",
                steps=[
                    "Group files, endpoints, jobs, and dependencies by business capability.",
                    "Identify the slices with high change frequency or high coupling to other services.",
                    "Resolve surrounding cycles, shared data, or chatty paths that would make extraction brittle.",
                ],
                verification_checks=[
                    "At least two candidate slices have clear owners, inputs, outputs, and data needs.",
                    "The first extraction target does not require a broad cross-system release.",
                ],
            ),
            RefactoringPlaybookPhase(
                title="Phase 2 - Modularize before distributing",
                objective="Prove the boundary inside the existing deployable before creating new operational complexity.",
                steps=[
                    "Create internal modules or packages with explicit interfaces for the chosen slice.",
                    "Add tests around the slice behavior and data contracts.",
                    "Move callers to the internal interface and remove direct cross-module access.",
                ],
                verification_checks=[
                    "The slice can be tested independently inside the current service.",
                    "Static dependencies now point through the new module interface.",
                ],
            ),
            RefactoringPlaybookPhase(
                title="Phase 3 - Extract only when the boundary is stable",
                objective="Create a new service or component only after the module boundary has proven useful.",
                steps=[
                    "Choose whether the slice should remain a module, become a worker, or become a separate service.",
                    "If extracting, move one vertical workflow with telemetry, rollback, and ownership in place.",
                    "Retire duplicate code and rescan service-size and coupling metrics.",
                ],
                verification_checks=[
                    "The original service has lower hotspot evidence after the change.",
                    "Operational ownership, dashboards, and runbooks exist for any extracted deployable.",
                ],
            ),
        ]
    return [
        RefactoringPlaybookPhase(
            title="Phase 1 - Validate the policy violation",
            objective="Confirm the governance rule is failing for a real architectural reason.",
            steps=[
                "Read the policy threshold and compare it with the current finding evidence.",
                "Decide whether the rule, the code, or both need adjustment.",
                "Assign an owner and due date for the policy remediation.",
            ],
            verification_checks=[
                "The policy failure has a linked finding, exception, or rule update proposal.",
                "False positives are documented before implementation work starts.",
            ],
        ),
        RefactoringPlaybookPhase(
            title="Phase 2 - Fix the underlying cause",
            objective="Resolve the architecture issue rather than only changing the policy result.",
            steps=[
                "Complete the dependent roadmap actions that overlap this policy.",
                "Keep evidence from the before and after scans for research/demo comparison.",
                "Update team guidance so future changes avoid the same violation.",
            ],
            verification_checks=[
                "The related structural finding is fixed or explicitly accepted.",
                "The policy document still expresses the intended architecture rule.",
            ],
        ),
        RefactoringPlaybookPhase(
            title="Phase 3 - Re-run governance and close the loop",
            objective="Turn the policy from a warning into an enforceable quality gate.",
            steps=[
                "Run a new MESA scan and compare the governance result with the baseline.",
                "Close temporary exceptions or attach a time-boxed waiver if the risk remains accepted.",
                "Add the policy check to CI or release review once stable.",
            ],
            verification_checks=[
                "The governance violation is gone or has a documented waiver with expiry.",
                "CI or release review can reproduce the same policy outcome.",
            ],
        ),
    ]


def _playbook_verification(primary_type: FindingType, services: list[str]) -> list[str]:
    checks = {
        FindingType.HARD_CODED_SERVICE_DEPENDENCY: [
            "Run the scanner and confirm hard-coded service URL findings are removed for the affected services.",
            "Run integration tests with endpoint values supplied by environment or deployment configuration.",
        ],
        FindingType.CHATTY_SERVICE: [
            "Compare before/after static call-count evidence for the caller and callee.",
            "Confirm production or test telemetry shows fewer synchronous downstream calls for the workflow.",
        ],
        FindingType.CYCLIC_DEPENDENCY: [
            "Run the scanner and confirm the detected cycle no longer appears.",
            "Deploy the services independently in a test environment without a coordinated release.",
        ],
        FindingType.SHARED_DATABASE: [
            "Confirm only the owning service retains direct database write or migration access.",
            "Run data parity checks between old direct reads and the replacement API, event, or read model.",
        ],
        FindingType.GOD_SERVICE: [
            "Compare hotspot metrics, dependency count, and finding count before and after the change.",
            "Confirm the extracted module or service has clear ownership and independent tests.",
        ],
        FindingType.GOVERNANCE_POLICY_VIOLATION: [
            "Run the governance rule again and record the new pass/fail result.",
            "Attach the after-scan evidence to the research evaluation record or release note.",
        ],
    }
    affected = f" for {_service_text(services)}" if services else ""
    return checks[primary_type] + [f"Review the after-scan with the owning team{affected} before closing the action."]


def _playbook_rollback(primary_type: FindingType) -> list[str]:
    return {
        FindingType.HARD_CODED_SERVICE_DEPENDENCY: [
            "Keep previous endpoint values available in deployment configuration during the first release.",
            "Rollback by restoring the previous config values, not by recommitting hard-coded URLs.",
        ],
        FindingType.CHATTY_SERVICE: [
            "Ship the coarse endpoint, read model, or event path alongside the old calls first.",
            "Rollback by routing the caller back to the old client path while preserving new telemetry.",
        ],
        FindingType.CYCLIC_DEPENDENCY: [
            "Guard the replacement interaction with a feature flag or routing toggle where possible.",
            "Rollback by re-enabling the old edge temporarily while keeping schema/message changes backward compatible.",
        ],
        FindingType.SHARED_DATABASE: [
            "Use staged migration with parity checks before removing old reads or credentials.",
            "Rollback by returning specific consumers to read-only direct access while investigating parity failures.",
        ],
        FindingType.GOD_SERVICE: [
            "Modularize inside the current deployable before extracting a separate service.",
            "Rollback an extraction by routing traffic back to the original module while retaining interface tests.",
        ],
        FindingType.GOVERNANCE_POLICY_VIOLATION: [
            "Use a time-boxed policy waiver only when the architectural risk is accepted by an owner.",
            "Rollback a policy threshold change by restoring the previous rule and documenting the exception.",
        ],
    }[primary_type]


def _playbook_risks(primary_type: FindingType) -> list[str]:
    return {
        FindingType.HARD_CODED_SERVICE_DEPENDENCY: [
            "Missing environment configuration can cause startup or runtime failures.",
            "Different services may adopt inconsistent configuration key names without a shared convention.",
        ],
        FindingType.CHATTY_SERVICE: [
            "A coarse endpoint can become too broad if it is not tied to a specific workflow.",
            "Read models or cached data may introduce freshness and consistency questions.",
        ],
        FindingType.CYCLIC_DEPENDENCY: [
            "Replacing a direct call with events can move complexity into eventual consistency handling.",
            "The cycle may reappear if ownership is not clarified after the edge is removed.",
        ],
        FindingType.SHARED_DATABASE: [
            "Data migration and parity defects can affect multiple services at once.",
            "Dual-write periods can create inconsistency if they are not tightly controlled.",
        ],
        FindingType.GOD_SERVICE: [
            "Premature extraction can create distributed complexity without reducing business complexity.",
            "The first slice may be too horizontal if boundaries are drawn around technical layers.",
        ],
        FindingType.GOVERNANCE_POLICY_VIOLATION: [
            "Policy thresholds can become performative if teams fix the rule instead of the architecture.",
            "Strict gates may block delivery unless waivers and ownership are clear.",
        ],
    }[primary_type]


def _playbook_effort(
    primary_type: FindingType, estimated_difficulty: str, finding_count: int, service_count: int
) -> str:
    if primary_type == FindingType.HARD_CODED_SERVICE_DEPENDENCY:
        base = "1-2 days"
    elif primary_type in {FindingType.CHATTY_SERVICE, FindingType.GOVERNANCE_POLICY_VIOLATION}:
        base = "3-7 days"
    elif primary_type == FindingType.GOD_SERVICE:
        base = "2-6 weeks"
    else:
        base = "1-4 weeks"
    scope_note = f"{finding_count} finding{'s' if finding_count != 1 else ''}, {service_count} service{'s' if service_count != 1 else ''}"
    return f"{base} ({estimated_difficulty}; scope: {scope_note})"


def _estimated_difficulty(
    recommendations: list[FindingRecommendation], bucket: RoadmapBucket
) -> str:
    if recommendations:
        return recommendations[0].estimated_difficulty
    return {
        RoadmapBucket.QUICK_WIN: "Low",
        RoadmapBucket.MEDIUM_TERM: "Medium",
        RoadmapBucket.HIGH_EFFORT: "High",
    }[bucket]


def _priority_score(
    *,
    primary_type: FindingType,
    findings: list[Finding],
    max_centrality: float,
    max_linked_findings: int,
    service_health_pressure: float,
) -> float:
    severity_component = (max(_SEVERITY_RANK[finding.severity] for finding in findings) / 4) * 40
    confidence_component = mean(finding.confidence for finding in findings) * 16
    centrality_component = max_centrality * 14
    linked_component = min(max_linked_findings, 5) / 5 * 10
    health_component = service_health_pressure * 14
    spread_component = min(len(findings), 4) / 4 * 4
    structural_bonus = 4.0 if primary_type in {
        FindingType.CYCLIC_DEPENDENCY,
        FindingType.SHARED_DATABASE,
        FindingType.GOD_SERVICE,
    } else 0.0
    return round(
        min(
            severity_component
            + confidence_component
            + centrality_component
            + linked_component
            + health_component
            + spread_component
            + structural_bonus,
            100.0,
        ),
        2,
    )


def _derive_dependencies(actions: list[RoadmapAction]) -> list[RoadmapDependency]:
    by_id = {action.id: action for action in actions}
    dependencies: list[RoadmapDependency] = []
    for action in actions:
        primary_type = _primary_type(action)
        for candidate in actions:
            if candidate.id == action.id:
                continue
            candidate_type = _primary_type(candidate)
            overlap = set(action.affected_services) & set(candidate.affected_services)
            if primary_type == FindingType.GOVERNANCE_POLICY_VIOLATION and candidate_type != FindingType.GOVERNANCE_POLICY_VIOLATION:
                if overlap or not action.affected_services:
                    dependencies.append(
                        RoadmapDependency(
                            action_id=action.id,
                            depends_on=candidate.id,
                            reason="Re-check the governance rule after the overlapping architectural fix is complete.",
                        )
                    )
            elif (
                primary_type == FindingType.GOD_SERVICE
                and candidate_type
                in {
                    FindingType.HARD_CODED_SERVICE_DEPENDENCY,
                    FindingType.CHATTY_SERVICE,
                    FindingType.CYCLIC_DEPENDENCY,
                    FindingType.SHARED_DATABASE,
                }
                and overlap
            ):
                dependencies.append(
                    RoadmapDependency(
                        action_id=action.id,
                        depends_on=candidate.id,
                        reason="Reduce surrounding coupling first so the decomposition target is clearer.",
                    )
                )
            elif (
                primary_type == FindingType.CHATTY_SERVICE
                and candidate_type == FindingType.HARD_CODED_SERVICE_DEPENDENCY
                and overlap
            ):
                dependencies.append(
                    RoadmapDependency(
                        action_id=action.id,
                        depends_on=candidate.id,
                        reason="Stabilize endpoint configuration before redesigning the interaction boundary.",
                    )
                )

    unique: dict[tuple[str, str], RoadmapDependency] = {}
    for dependency in dependencies:
        if dependency.action_id == dependency.depends_on:
            continue
        if dependency.depends_on not in by_id:
            continue
        unique[(dependency.action_id, dependency.depends_on)] = dependency
    return sorted(unique.values(), key=lambda item: (item.action_id, item.depends_on))


def _ordered_actions(
    actions: list[RoadmapAction], dependencies: list[RoadmapDependency]
) -> list[RoadmapAction]:
    pending = {action.id: action for action in actions}
    remaining = {
        action.id: {dependency.depends_on for dependency in dependencies if dependency.action_id == action.id}
        for action in actions
    }
    ordered: list[RoadmapAction] = []

    while pending:
        ready = [
            action
            for action_id, action in pending.items()
            if not remaining.get(action_id)
        ]
        if not ready:
            ready = list(pending.values())
        ready.sort(
            key=lambda action: (
                action.priority_score + _EXECUTION_BONUS[action.bucket],
                action.priority_score,
                -len(action.dependencies),
            ),
            reverse=True,
        )
        current = ready[0]
        ordered.append(current)
        pending.pop(current.id, None)
        for action_id in remaining:
            remaining[action_id].discard(current.id)

    return ordered


def _roadmap_summary(
    findings: list[Finding], ordered_actions: list[RoadmapAction], system_score: float | None
) -> str:
    top_action = ordered_actions[0]
    score_text = f" with a current system health score of {system_score:.1f}/100" if system_score is not None else ""
    return (
        f"MESA grouped {len(findings)} findings into {len(ordered_actions)} remediation actions{score_text}. "
        f"Start with '{top_action.title}', then follow the suggested order to combine quick wins and deeper structural fixes."
    )


def _service_score_map(result: AnalysisResult) -> dict[str, float]:
    service_scores = result.summary.get("health_scores", {}).get("service", [])
    return {
        str(score.get("target", "")): float(score.get("score", 0.0))
        for score in service_scores
        if score.get("target")
    }


def _system_health_context(result: AnalysisResult) -> tuple[float | None, list[str]]:
    system = result.summary.get("health_scores", {}).get("system")
    if not system:
        return None, []
    score = float(system.get("score", 0.0))
    breakdown = system.get("breakdown", {})
    weak_dimensions = [
        str(dimension)
        for dimension, value in breakdown.items()
        if float(value) < 70.0
    ]
    return score, weak_dimensions


def _service_centrality(result: AnalysisResult) -> dict[str, float]:
    service_ids = {
        str(node.get("id"))
        for node in result.graph.get("nodes", [])
        if node.get("type") == "service"
    }
    degree: Counter[str] = Counter()
    for edge in result.graph.get("edges", []):
        source = str(edge.get("source", ""))
        target = str(edge.get("target", ""))
        if source in service_ids:
            degree[source] += 1
        if target in service_ids:
            degree[target] += 1
    if not degree:
        return {service_id: 0.0 for service_id in service_ids}
    max_degree = max(degree.values())
    return {
        service_id: round(degree.get(service_id, 0) / max(max_degree, 1), 2)
        for service_id in service_ids
    }


def _service_health_pressure(
    services: list[str],
    service_scores: dict[str, float],
    system_score: float | None,
) -> float:
    if services:
        scores = [service_scores.get(service) for service in services if service_scores.get(service) is not None]
        if scores:
            return max(0.0, 1 - (mean(scores) / 100.0))
    if system_score is None:
        return 0.35
    return max(0.0, 1 - (system_score / 100.0))


def _service_text(services: list[str]) -> str:
    if not services:
        return "the affected services"
    if len(services) <= 3:
        return ", ".join(services)
    return f"{', '.join(services[:3])}, and {len(services) - 3} more"


def _cycle_services(finding: Finding) -> list[str]:
    for evidence in finding.evidence:
        cycle = evidence.get("cycle")
        if isinstance(cycle, list) and cycle:
            return [str(service) for service in cycle]
    return finding.services


def _shared_database_key(finding: Finding) -> str:
    for evidence in finding.evidence:
        database = evidence.get("database")
        if database:
            return str(database)
    return "shared database"


def _policy_name(finding: Finding) -> str:
    for evidence in finding.evidence:
        policy_name = evidence.get("policy_name")
        if policy_name:
            return str(policy_name)
    return "architecture policy"


def _primary_type(action: RoadmapAction) -> FindingType:
    return action.related_finding_types[0]
