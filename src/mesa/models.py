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


class AnalysisRequest(BaseModel):
    service_paths: list[str]
    chatty_threshold: int = 3


class AnalysisResult(BaseModel):
    services: list[ServiceFacts]
    findings: list[Finding]
    graph: dict[str, Any]
    summary: dict[str, Any]


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


class ScanRecord(BaseModel):
    id: str
    project_id: str
    status: str
    service_count: int = 0
    finding_count: int = 0
    created_at: str | None = None
    completed_at: str | None = None


class PersistedScanResult(BaseModel):
    scan: ScanRecord
    result: AnalysisResult


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

