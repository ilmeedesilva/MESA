from __future__ import annotations

from enum import Enum
from pathlib import Path
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class FindingType(str, Enum):
    CHATTY_SERVICE = "CHATTY_SERVICE"
    CYCLIC_DEPENDENCY = "CYCLIC_DEPENDENCY"
    SHARED_DATABASE = "SHARED_DATABASE"
    HARD_CODED_SERVICE_DEPENDENCY = "HARD_CODED_SERVICE_DEPENDENCY"
    GOD_SERVICE = "GOD_SERVICE"
    GOVERNANCE_POLICY_VIOLATION = "GOVERNANCE_POLICY_VIOLATION"


class SourceLocation(BaseModel):
    file_path: str
    line_number: int | None = None


class Endpoint(BaseModel):
    service_name: str
    method: str
    path: str
    source: SourceLocation


class ServiceCall(BaseModel):
    caller: str
    target_hint: str
    url: str
    method: str = "UNKNOWN"
    source: SourceLocation


class DatabaseConnection(BaseModel):
    service_name: str
    raw: str
    db_type: str = "unknown"
    host: str | None = None
    database: str | None = None
    source: SourceLocation

    @property
    def key(self) -> str:
        host = (self.host or "localhost").lower()
        database = (self.database or "").lower()
        return f"{self.db_type.lower()}://{host}/{database}"


class HardCodedDependency(BaseModel):
    service_name: str
    value: str
    host: str
    port: int | None = None
    scheme: str | None = None
    file_type: str
    context: str
    reason: str
    source: SourceLocation


class LibraryUsage(BaseModel):
    service_name: str
    name: str
    version: str | None = None
    source: SourceLocation


class EnvironmentVariable(BaseModel):
    service_name: str
    name: str
    value_hint: str | None = None
    source: SourceLocation


class MessageBrokerConnection(BaseModel):
    service_name: str
    raw: str
    broker_type: str
    host: str | None = None
    source: SourceLocation


class ServiceFacts(BaseModel):
    name: str
    root_path: str
    language: str = "unknown"
    endpoints: list[Endpoint] = Field(default_factory=list)
    calls: list[ServiceCall] = Field(default_factory=list)
    databases: list[DatabaseConnection] = Field(default_factory=list)
    libraries: list[LibraryUsage] = Field(default_factory=list)
    environment_variables: list[EnvironmentVariable] = Field(default_factory=list)
    message_brokers: list[MessageBrokerConnection] = Field(default_factory=list)
    hard_coded_dependencies: list[HardCodedDependency] = Field(default_factory=list)
    file_count: int = 0
    domain_keywords: list[str] = Field(default_factory=list)


class HealthScore(BaseModel):
    scope: str
    target: str
    score: float = Field(ge=0.0, le=100.0)
    grade: str
    breakdown: dict[str, float]
    explanation: str
    recommendations: list[str] = Field(default_factory=list)


class FindingRecommendation(BaseModel):
    root_cause: str
    architectural_consequence: str
    affected_services: list[str] = Field(default_factory=list)
    affected_files: list[str] = Field(default_factory=list)
    refactoring_steps: list[str] = Field(default_factory=list)
    expected_impact: str
    priority: str
    estimated_difficulty: str
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    source: str = "rule-based"


class EvidenceChainItem(BaseModel):
    step: str
    description: str
    source: SourceLocation | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class Finding(BaseModel):
    id: str
    type: FindingType
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0)
    services: list[str]
    description: str
    evidence: list[dict[str, Any]]
    recommendation: str
    recommendations: list[FindingRecommendation] = Field(default_factory=list)
    detector_name: str = "Unknown detector"
    rule_id: str = "unknown-rule"
    evidence_chain: list[EvidenceChainItem] = Field(default_factory=list)
    confidence_reason: str = ""
    limitations: list[str] = Field(default_factory=list)
    source_files: list[str] = Field(default_factory=list)
    related_services: list[str] = Field(default_factory=list)
    why_valid: str = ""


class AnalysisRequest(BaseModel):
    service_paths: list[str]
    chatty_threshold: int = 3


class RepoSourceType(str, Enum):
    LOCAL_PATH = "LOCAL_PATH"
    ARCHIVE_PATH = "ARCHIVE_PATH"
    GITHUB_URL = "GITHUB_URL"


class RepoSourceMetadata(BaseModel):
    source_type: RepoSourceType
    source_label: str
    source_path: str | None = None
    repo_url: str | None = None
    repo_provider: str | None = None
    repo_ref: str | None = None
    commit_sha: str | None = None
    workspace_path: str | None = None


class RepoScanPreviewRequest(BaseModel):
    source_type: RepoSourceType
    location: str
    ref: str | None = None
    subdirectory: str | None = None


class ServiceDiscoveryCandidate(BaseModel):
    service_name: str
    relative_path: str
    absolute_path: str
    language: str = "unknown"
    confidence: float = Field(ge=0.0, le=1.0)
    selected_by_default: bool = True
    reasons: list[str] = Field(default_factory=list)
    manifests: list[str] = Field(default_factory=list)
    entrypoints: list[str] = Field(default_factory=list)
    signal_counts: dict[str, int] = Field(default_factory=dict)


class RepoScanPreview(BaseModel):
    source: RepoSourceMetadata
    root_path: str
    top_level_entries: list[str] = Field(default_factory=list)
    file_count: int = 0
    manifest_counts: dict[str, int] = Field(default_factory=dict)
    candidate_service_paths: list[str] = Field(default_factory=list)
    discovered_services: list[ServiceDiscoveryCandidate] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class AnalysisResult(BaseModel):
    services: list[ServiceFacts]
    findings: list[Finding]
    graph: dict[str, Any]
    summary: dict[str, Any]


class ArchitectureGateStatus(str, Enum):
    PASSED = "passed"
    FAILED = "failed"


class ArchitectureGateThresholds(BaseModel):
    minimum_health_score: float = Field(default=75.0, ge=0.0, le=100.0)
    maximum_critical_findings: int = Field(default=0, ge=0)
    allow_new_cyclic_dependencies: bool = False
    allow_governance_violations: bool = False
    allow_new_high_risk_coupling: bool = False


class ArchitectureGateRuleResult(BaseModel):
    rule_id: str
    passed: bool
    message: str
    observed_value: Any = None
    threshold: Any = None
    related_findings: list[str] = Field(default_factory=list)


class ArchitectureFitnessGateResult(BaseModel):
    status: ArchitectureGateStatus
    health_score: float | None = None
    threshold: float
    failed_rules: list[str] = Field(default_factory=list)
    rules: list[ArchitectureGateRuleResult] = Field(default_factory=list)
    thresholds: ArchitectureGateThresholds = Field(default_factory=ArchitectureGateThresholds)
    baseline_scan_id: str | None = None
    source: str = "mesa-architecture-fitness-gate"


class ArchitectureFitnessGateRequest(BaseModel):
    thresholds: ArchitectureGateThresholds = Field(default_factory=ArchitectureGateThresholds)
    baseline_scan_id: str | None = None


class AIExplainerIntent(str, Enum):
    AUTO = "AUTO"
    SCAN_SUMMARY = "SCAN_SUMMARY"
    FINDING_EXPLANATION = "FINDING_EXPLANATION"
    PRIORITIZE_FIXES = "PRIORITIZE_FIXES"
    HEALTH_SCORE_EXPLANATION = "HEALTH_SCORE_EXPLANATION"
    COMPARE_SCANS = "COMPARE_SCANS"
    GOVERNANCE_POLICY_HELP = "GOVERNANCE_POLICY_HELP"
    POLICY_WRITING_ASSISTANCE = "POLICY_WRITING_ASSISTANCE"
    DOC_QA = "DOC_QA"


class AIExplainerConfidence(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


class AIExplainerEvidence(BaseModel):
    kind: str
    label: str
    pointer: str
    snippet: str


class AIExplainerRequest(BaseModel):
    intent: AIExplainerIntent = AIExplainerIntent.AUTO
    question: str = ""
    project_id: str | None = None
    scan_id: str | None = None
    finding_id: str | None = None
    score_target: str | None = None
    service_name: str | None = None
    base_scan_id: str | None = None
    target_scan_id: str | None = None
    doc_query: str | None = None


class AIExplainerResponse(BaseModel):
    intent: AIExplainerIntent
    title: str
    answer: str
    evidence: list[AIExplainerEvidence] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    policy_document: str | None = None
    confidence: AIExplainerConfidence = AIExplainerConfidence.MODERATE
    grounded: bool = True
    source: str = "mesa-grounded-explainer"


class AIConnectionState(str, Enum):
    GROUNDED_ONLY = "GROUNDED_ONLY"
    MISSING_API_KEY = "MISSING_API_KEY"
    PLACEHOLDER_API_KEY = "PLACEHOLDER_API_KEY"
    INVALID_API_KEY = "INVALID_API_KEY"
    MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"
    ACCESS_DENIED = "ACCESS_DENIED"
    CONNECTION_ERROR = "CONNECTION_ERROR"
    READY = "READY"


class AIExplainerStatus(BaseModel):
    mode: str
    state: AIConnectionState
    live_enabled: bool
    api_key_configured: bool
    api_key_hint: str | None = None
    model: str
    base_url: str
    message: str


class RoadmapBucket(str, Enum):
    QUICK_WIN = "quick_win"
    MEDIUM_TERM = "medium_term"
    HIGH_EFFORT = "high_effort"


class RefactoringPlaybookPhase(BaseModel):
    title: str
    objective: str
    steps: list[str] = Field(default_factory=list)
    verification_checks: list[str] = Field(default_factory=list)


class RefactoringPlaybook(BaseModel):
    problem_summary: str
    impact: str
    recommended_strategy: str
    phases: list[RefactoringPlaybookPhase] = Field(default_factory=list)
    verification_checks: list[str] = Field(default_factory=list)
    rollback_plan: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    estimated_effort: str
    related_services: list[str] = Field(default_factory=list)
    related_findings: list[str] = Field(default_factory=list)
    source: str = "mesa-rule-based-playbook"


class RoadmapAction(BaseModel):
    id: str
    title: str
    bucket: RoadmapBucket
    priority_rank: int = Field(ge=1)
    priority_score: float = Field(ge=0.0, le=100.0)
    summary: str
    rationale: str
    expected_benefit: str
    suggested_order_reason: str
    estimated_difficulty: str
    affected_services: list[str] = Field(default_factory=list)
    related_findings: list[str] = Field(default_factory=list)
    related_finding_types: list[FindingType] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    playbook: RefactoringPlaybook | None = None


class RoadmapDependency(BaseModel):
    action_id: str
    depends_on: str
    reason: str


class RoadmapPlanStep(BaseModel):
    order: int = Field(ge=1)
    action_id: str
    title: str
    bucket: RoadmapBucket
    why_now: str


class RemediationRoadmap(BaseModel):
    scan_id: str
    generated_from_finding_count: int = 0
    system_health_score: float | None = Field(default=None, ge=0.0, le=100.0)
    summary: str
    quick_wins: list[RoadmapAction] = Field(default_factory=list)
    medium_term_changes: list[RoadmapAction] = Field(default_factory=list)
    high_effort_refactors: list[RoadmapAction] = Field(default_factory=list)
    suggested_order: list[RoadmapPlanStep] = Field(default_factory=list)
    dependencies: list[RoadmapDependency] = Field(default_factory=list)


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    root_path: str | None = None


class ProjectRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str | None = None
    root_path: str | None = None
    created_at: str | None = None


class ProjectSetup(BaseModel):
    source_type: RepoSourceType | None = None
    source_location: str | None = None
    source_ref: str | None = None
    selected_service_paths: list[str] = Field(default_factory=list)
    manual_service_paths: list[str] = Field(default_factory=list)
    chatty_threshold: int = 3
    created_at: str | None = None
    updated_at: str | None = None


class PolicyCreate(BaseModel):
    id: str | None = None
    name: str
    rule: str
    severity: Severity = Severity.HIGH
    description: str | None = None
    enabled: bool = True


class PolicyDocument(BaseModel):
    content: str


class PolicyRecord(BaseModel):
    id: str
    project_id: str
    name: str
    rule: str
    severity: Severity
    description: str | None = None
    enabled: bool = True
    created_at: str | None = None
    updated_at: str | None = None


class RunScanRequest(BaseModel):
    service_paths: list[str]
    chatty_threshold: int = 3


class RepoScanRunRequest(RepoScanPreviewRequest):
    service_paths: list[str] = Field(default_factory=list)
    chatty_threshold: int = 3


class ResearchEvaluationRecordBase(BaseModel):
    scan_id: str | None = None
    repo_name: str
    repo_url: str | None = None
    commit_ref: str | None = None
    scan_date: str | None = None
    project_type: str | None = None
    expected_services: int | None = Field(default=None, ge=0)
    detected_services: int = Field(default=0, ge=0)
    expected_patterns: str | None = None
    detected_patterns: str | None = None
    total_findings: int = Field(default=0, ge=0)
    critical_findings: int = Field(default=0, ge=0)
    high_findings: int = Field(default=0, ge=0)
    medium_findings: int = Field(default=0, ge=0)
    low_findings: int = Field(default=0, ge=0)
    true_positives: int | None = Field(default=None, ge=0)
    false_positives: int | None = Field(default=None, ge=0)
    false_negatives: int | None = Field(default=None, ge=0)
    notes: str | None = None
    limitations: str | None = None
    research_relevance: str | None = None
    suitable_for_report: bool = False


class ResearchEvaluationAccuracyMode(str, Enum):
    GROUND_TRUTH = "GROUND_TRUTH"
    MANUAL_VALIDATION_REQUIRED = "MANUAL_VALIDATION_REQUIRED"


class ResearchEvaluationRecordCreate(ResearchEvaluationRecordBase):
    pass


class ResearchEvaluationRecordUpdate(ResearchEvaluationRecordBase):
    repo_name: str | None = None
    detected_services: int | None = Field(default=None, ge=0)
    total_findings: int | None = Field(default=None, ge=0)
    critical_findings: int | None = Field(default=None, ge=0)
    high_findings: int | None = Field(default=None, ge=0)
    medium_findings: int | None = Field(default=None, ge=0)
    low_findings: int | None = Field(default=None, ge=0)


class ResearchEvaluationRecord(ResearchEvaluationRecordBase):
    id: str
    precision: float | None = None
    recall: float | None = None
    f1_score: float | None = None
    created_at: str | None = None
    updated_at: str | None = None


class ResearchEvaluationDraft(ResearchEvaluationRecordBase):
    project_id: str
    accuracy_mode: ResearchEvaluationAccuracyMode = ResearchEvaluationAccuracyMode.MANUAL_VALIDATION_REQUIRED
    matched_benchmark_id: str | None = None
    matched_benchmark_name: str | None = None
    precision: float | None = None
    recall: float | None = None
    f1_score: float | None = None


class ScanRecord(BaseModel):
    id: str
    project_id: str
    status: str
    service_count: int = 0
    finding_count: int = 0
    source_type: RepoSourceType | None = None
    source_label: str | None = None
    repo_url: str | None = None
    repo_provider: str | None = None
    repo_ref: str | None = None
    commit_sha: str | None = None
    created_at: str | None = None
    completed_at: str | None = None


class PersistedScanResult(BaseModel):
    scan: ScanRecord
    result: AnalysisResult


class ScanJobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ScanJobRecord(BaseModel):
    id: str
    project_id: str
    status: ScanJobStatus = ScanJobStatus.QUEUED
    scan_id: str | None = None
    error_message: str | None = None
    created_at: str | None = None
    started_at: str | None = None
    completed_at: str | None = None


class SnapshotRecord(BaseModel):
    id: str
    project_id: str
    scan_id: str
    graph: dict[str, Any]
    created_at: str | None = None


class EvolutionReport(BaseModel):
    project_id: str
    base_scan_id: str
    target_scan_id: str
    architecture_change_summary: dict[str, Any]
    risk_trend: dict[str, Any]
    score_trend: dict[str, Any]
    service_level_changes: list[dict[str, Any]]
    new_dependencies: list[dict[str, Any]]
    removed_dependencies: list[dict[str, Any]]
    new_cycles: list[dict[str, Any]]
    removed_cycles: list[dict[str, Any]]
    recommendations: list[str] = Field(default_factory=list)


def service_name_from_path(path: str | Path) -> str:
    return Path(path).resolve().name
