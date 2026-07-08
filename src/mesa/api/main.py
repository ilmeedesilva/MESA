from __future__ import annotations

import json
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse

from mesa import __version__
from mesa.analysis import analyze_services
from mesa.analysis.evolution import compare_scan_results
from mesa.analysis.explainer import (
    ai_status,
    explain_with_grounded_context,
    grounded_response_for_request,
    stream_answer_text,
)
from mesa.analysis.fitness_gate import evaluate_architecture_gate
from mesa.analysis.governance import evaluate_policies, parse_policy_document
from mesa.analysis.research_records import export_records, record_create_from_scan
from mesa.analysis.roadmap import build_remediation_roadmap
from mesa.analysis.recommendations import enrich_findings_with_recommendations
from mesa.ingestion import prepare_repository, preview_repository, resolve_service_paths
from mesa.models import (
    AIExplainerStatus,
    AIExplainerRequest,
    AIExplainerResponse,
    ArchitectureFitnessGateRequest,
    ArchitectureFitnessGateResult,
    ArchitectureGateThresholds,
    AnalysisRequest,
    AnalysisResult,
    EvolutionReport,
    Finding,
    HealthScore,
    PolicyCreate,
    PolicyDocument,
    PolicyRecord,
    PersistedScanResult,
    ProjectCreate,
    ProjectRecord,
    ResearchEvaluationRecord,
    ResearchEvaluationRecordCreate,
    ResearchEvaluationRecordUpdate,
    RemediationRoadmap,
    RepoScanPreview,
    RepoScanPreviewRequest,
    RepoScanRunRequest,
    RunScanRequest,
    ScanRecord,
    SnapshotRecord,
)
from mesa.storage import (
    InMemoryPersistenceRepository,
    Neo4jArchitectureStore,
    PersistenceRepository,
    PostgresPersistenceRepository,
)

app = FastAPI(title="MESA API", version=__version__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_repository(request: Request) -> PersistenceRepository:
    if hasattr(request.app.state, "persistence_repository"):
        return request.app.state.persistence_repository

    if os.getenv("MESA_PERSISTENCE", "memory").lower() == "postgres":
        dsn = os.getenv("MESA_POSTGRES_DSN", "postgresql://mesa:mesa@localhost:5432/mesa")
        repository: PersistenceRepository = PostgresPersistenceRepository(dsn)
    else:
        repository = InMemoryPersistenceRepository()

    repository.initialize()
    request.app.state.persistence_repository = repository
    return repository


def neo4j_enabled() -> bool:
    return os.getenv("MESA_NEO4J_ENABLED", "false").lower() in {"1", "true", "yes", "on"}


def get_architecture_store(request: Request):
    if hasattr(request.app.state, "architecture_store"):
        return request.app.state.architecture_store
    if not neo4j_enabled():
        return None

    store = Neo4jArchitectureStore()
    store.initialize()
    request.app.state.architecture_store = store
    return store


def require_architecture_store(request: Request):
    store = get_architecture_store(request)
    if store is None:
        raise HTTPException(status_code=503, detail="Neo4j architecture graph is not enabled")
    return store


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.post("/analyze", response_model=AnalysisResult)
def analyze(request: AnalysisRequest) -> AnalysisResult:
    return analyze_services(request.service_paths, request.chatty_threshold)


@app.post("/repo-scans/preview", response_model=RepoScanPreview)
def preview_repo_scan(payload: RepoScanPreviewRequest) -> RepoScanPreview:
    try:
        return preview_repository(payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/research-records", response_model=list[ResearchEvaluationRecord])
def list_research_records(request: Request) -> list[ResearchEvaluationRecord]:
    return get_repository(request).list_research_records()


@app.post("/research-records", response_model=ResearchEvaluationRecord, status_code=201)
def create_research_record(
    payload: ResearchEvaluationRecordCreate, request: Request
) -> ResearchEvaluationRecord:
    return get_repository(request).create_research_record(payload)


@app.get("/research-records/export")
def export_research_records(request: Request, format: str = "csv"):
    export_format = format.lower()
    repository = get_repository(request)
    records = repository.list_research_records()
    try:
        content = export_records(records, export_format)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if export_format == "json":
        return json.loads(content)
    media_type = "text/csv" if export_format == "csv" else "text/markdown"
    filename = f"mesa-research-records.{ 'csv' if export_format == 'csv' else 'md' }"
    return PlainTextResponse(
        content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/research-records/{record_id}", response_model=ResearchEvaluationRecord)
def get_research_record(record_id: str, request: Request) -> ResearchEvaluationRecord:
    record = get_repository(request).get_research_record(record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Research record not found")
    return record


@app.put("/research-records/{record_id}", response_model=ResearchEvaluationRecord)
def update_research_record(
    record_id: str, payload: ResearchEvaluationRecordUpdate, request: Request
) -> ResearchEvaluationRecord:
    record = get_repository(request).update_research_record(record_id, payload)
    if record is None:
        raise HTTPException(status_code=404, detail="Research record not found")
    return record


@app.delete("/research-records/{record_id}", status_code=204)
def delete_research_record(record_id: str, request: Request) -> None:
    deleted = get_repository(request).delete_research_record(record_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Research record not found")


@app.post("/research-records/from-scan/{scan_id}", response_model=ResearchEvaluationRecord, status_code=201)
def create_research_record_from_scan(scan_id: str, request: Request) -> ResearchEvaluationRecord:
    repository = get_repository(request)
    scan = repository.get_scan(scan_id)
    result = repository.get_scan_result(scan_id)
    if scan is None or result is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return repository.create_research_record(record_create_from_scan(scan, result))


@app.post("/projects", response_model=ProjectRecord, status_code=201)
def create_project(payload: ProjectCreate, request: Request) -> ProjectRecord:
    return get_repository(request).create_project(payload)


@app.get("/projects/{project_id}", response_model=ProjectRecord)
def get_project(project_id: str, request: Request) -> ProjectRecord:
    project = get_repository(request).get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project




@app.get("/projects/{project_id}/policies", response_model=list[PolicyRecord])
def list_project_policies(project_id: str, request: Request) -> list[PolicyRecord]:
    repository = get_repository(request)
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return repository.list_policies(project_id)


@app.post("/projects/{project_id}/policies", response_model=PolicyRecord, status_code=201)
def create_project_policy(project_id: str, payload: PolicyCreate, request: Request) -> PolicyRecord:
    repository = get_repository(request)
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return repository.create_policy(project_id, payload)


@app.put("/projects/{project_id}/policies/{policy_id}", response_model=PolicyRecord)
def update_project_policy(
    project_id: str, policy_id: str, payload: PolicyCreate, request: Request
) -> PolicyRecord:
    repository = get_repository(request)
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    policy = repository.update_policy(project_id, policy_id, payload)
    if policy is None:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@app.post("/projects/{project_id}/policies/import", response_model=list[PolicyRecord])
def import_project_policies(
    project_id: str, payload: PolicyDocument, request: Request
) -> list[PolicyRecord]:
    repository = get_repository(request)
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        policies = parse_policy_document(payload.content)
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return repository.upsert_policies(project_id, policies)


@app.post("/projects/{project_id}/scans", response_model=PersistedScanResult, status_code=201)
def run_project_scan(project_id: str, payload: RunScanRequest, request: Request) -> PersistedScanResult:
    repository = get_repository(request)
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    result = analyze_services(payload.service_paths, payload.chatty_threshold)
    policies = repository.list_policies(project_id)
    policy_findings = evaluate_policies(result, policies)
    if policy_findings:
        result.findings.extend(policy_findings)
        result.findings = enrich_findings_with_recommendations(result.findings)
        _refresh_finding_summary(result)
    scan = repository.save_scan_result(project_id, result)
    architecture_store = get_architecture_store(request)
    if architecture_store is not None:
        architecture_store.save_scan_graph(project_id, scan.id, result)
    return PersistedScanResult(scan=scan, result=result)


@app.post("/projects/{project_id}/repo-scans", response_model=PersistedScanResult, status_code=201)
def run_project_repo_scan(
    project_id: str,
    payload: RepoScanRunRequest,
    request: Request,
) -> PersistedScanResult:
    repository = get_repository(request)
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        prepared = prepare_repository(payload)
        service_paths = resolve_service_paths(prepared, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    result = analyze_services(service_paths, payload.chatty_threshold)
    policies = repository.list_policies(project_id)
    policy_findings = evaluate_policies(result, policies)
    if policy_findings:
        result.findings.extend(policy_findings)
        result.findings = enrich_findings_with_recommendations(result.findings)
        _refresh_finding_summary(result)
    result.summary["repository_source"] = prepared.metadata.model_dump(mode="json")
    scan = repository.save_scan_result(project_id, result, source_metadata=prepared.metadata)
    architecture_store = get_architecture_store(request)
    if architecture_store is not None:
        architecture_store.save_scan_graph(project_id, scan.id, result)
    return PersistedScanResult(scan=scan, result=result)


@app.get("/projects/{project_id}/scans", response_model=list[ScanRecord])
def get_scan_history(project_id: str, request: Request) -> list[ScanRecord]:
    repository = get_repository(request)
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return repository.list_scans(project_id)




@app.get("/projects/{project_id}/snapshots", response_model=list[SnapshotRecord])
def get_project_snapshots(project_id: str, request: Request) -> list[SnapshotRecord]:
    repository = get_repository(request)
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return repository.list_snapshots(project_id)


@app.get("/projects/{project_id}/evolution", response_model=list[EvolutionReport])
def get_project_evolution_timeline(project_id: str, request: Request) -> list[EvolutionReport]:
    repository = get_repository(request)
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")

    scans = list(reversed(repository.list_scans(project_id)))
    reports: list[EvolutionReport] = []
    for previous, current in zip(scans, scans[1:]):
        previous_result = repository.get_scan_result(previous.id)
        current_result = repository.get_scan_result(current.id)
        if previous_result is None or current_result is None:
            continue
        reports.append(
            compare_scan_results(project_id, previous.id, previous_result, current.id, current_result)
        )
    return reports


@app.get("/projects/{project_id}/evolution/compare", response_model=EvolutionReport)
def compare_project_snapshots(
    project_id: str,
    base_scan_id: str,
    target_scan_id: str,
    request: Request,
) -> EvolutionReport:
    repository = get_repository(request)
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")

    base_scan = repository.get_scan(base_scan_id)
    target_scan = repository.get_scan(target_scan_id)
    if base_scan is None or target_scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    if base_scan.project_id != project_id or target_scan.project_id != project_id:
        raise HTTPException(status_code=404, detail="Scan not found for project")

    base_result = repository.get_scan_result(base_scan_id)
    target_result = repository.get_scan_result(target_scan_id)
    if base_result is None or target_result is None:
        raise HTTPException(status_code=404, detail="Scan report not found")
    return compare_scan_results(project_id, base_scan_id, base_result, target_scan_id, target_result)


@app.get("/scans/{scan_id}", response_model=PersistedScanResult)
def get_scan_result(scan_id: str, request: Request) -> PersistedScanResult:
    repository = get_repository(request)
    scan = repository.get_scan(scan_id)
    result = repository.get_scan_result(scan_id)
    if scan is None or result is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return PersistedScanResult(scan=scan, result=result)


@app.get("/scans/{scan_id}/findings", response_model=list[Finding])
def get_scan_findings(scan_id: str, request: Request) -> list[Finding]:
    repository = get_repository(request)
    if repository.get_scan(scan_id) is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return repository.list_findings(scan_id)


@app.get("/scans/{scan_id}/scores", response_model=list[HealthScore])
def get_scan_scores(scan_id: str, request: Request) -> list[HealthScore]:
    repository = get_repository(request)
    if repository.get_scan(scan_id) is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return repository.list_scores(scan_id)


@app.get("/scans/{scan_id}/roadmap", response_model=RemediationRoadmap)
def get_scan_remediation_roadmap(scan_id: str, request: Request) -> RemediationRoadmap:
    repository = get_repository(request)
    if repository.get_scan(scan_id) is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    result = repository.get_scan_result(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Scan report not found")
    return build_remediation_roadmap(scan_id, result)


@app.get("/scans/{scan_id}/gate", response_model=ArchitectureFitnessGateResult)
def get_scan_architecture_gate(
    scan_id: str,
    request: Request,
    minimum_health_score: float = 75.0,
    maximum_critical_findings: int = 0,
    baseline_scan_id: str | None = None,
) -> ArchitectureFitnessGateResult:
    thresholds = ArchitectureGateThresholds(
        minimum_health_score=minimum_health_score,
        maximum_critical_findings=maximum_critical_findings,
    )
    return _evaluate_scan_gate(scan_id, request, thresholds, baseline_scan_id)


@app.post("/scans/{scan_id}/gate", response_model=ArchitectureFitnessGateResult)
def post_scan_architecture_gate(
    scan_id: str, payload: ArchitectureFitnessGateRequest, request: Request
) -> ArchitectureFitnessGateResult:
    return _evaluate_scan_gate(scan_id, request, payload.thresholds, payload.baseline_scan_id)


@app.post("/ai/explainer", response_model=AIExplainerResponse)
def explain_scan_results(payload: AIExplainerRequest, request: Request) -> AIExplainerResponse:
    result, scores, policies, comparison = _load_ai_context(payload, request)
    return explain_with_grounded_context(
        payload,
        result=result,
        scores=scores,
        policies=policies,
        comparison=comparison,
    )


@app.get("/ai/explainer/status", response_model=AIExplainerStatus)
def get_ai_explainer_status(probe: bool = True) -> AIExplainerStatus:
    return ai_status(probe=probe)


@app.post("/ai/explainer/stream")
def explain_scan_results_stream(payload: AIExplainerRequest, request: Request) -> StreamingResponse:
    result, scores, policies, comparison = _load_ai_context(payload, request)
    grounded_response = grounded_response_for_request(
        payload,
        intent=payload.intent if payload.intent.value != "AUTO" else None,
        result=result,
        scores=scores,
        policies=policies,
        comparison=comparison,
    )

    def event_stream():
        final_response, chunks = stream_answer_text(payload, grounded_response)
        for chunk in chunks:
            yield _sse_event("delta", {"text": chunk})
        yield _sse_event("done", final_response.model_dump(mode="json"))

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/scans/{scan_id}/graph")
def get_scan_architecture_graph(scan_id: str, request: Request) -> dict:
    repository = get_repository(request)
    if repository.get_scan(scan_id) is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return require_architecture_store(request).get_architecture_graph(scan_id)


@app.get("/scans/{scan_id}/graph/paths")
def get_scan_dependency_paths(
    scan_id: str, source: str, target: str, request: Request, max_depth: int = 4
) -> list[dict]:
    repository = get_repository(request)
    if repository.get_scan(scan_id) is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return require_architecture_store(request).find_dependency_paths(scan_id, source, target, max_depth)


@app.get("/scans/{scan_id}/graph/cycles")
def get_scan_cycles(scan_id: str, request: Request, max_depth: int = 6) -> list[dict]:
    repository = get_repository(request)
    if repository.get_scan(scan_id) is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return require_architecture_store(request).find_cycles(scan_id, max_depth)


@app.get("/scans/{scan_id}/graph/centrality")
def get_scan_service_centrality(scan_id: str, request: Request) -> list[dict]:
    repository = get_repository(request)
    if repository.get_scan(scan_id) is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return require_architecture_store(request).get_service_centrality(scan_id)


@app.get("/scans/{scan_id}/graph/shared-databases")
def get_scan_shared_databases(scan_id: str, request: Request) -> list[dict]:
    repository = get_repository(request)
    if repository.get_scan(scan_id) is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return require_architecture_store(request).find_shared_database_relationships(scan_id)


@app.get("/scans/{scan_id}/graph/high-risk-clusters")
def get_scan_high_risk_clusters(
    scan_id: str, request: Request, degree_threshold: int = 3
) -> list[dict]:
    repository = get_repository(request)
    if repository.get_scan(scan_id) is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return require_architecture_store(request).find_high_risk_dependency_clusters(
        scan_id, degree_threshold
    )


def _refresh_finding_summary(result: AnalysisResult) -> None:
    result.summary["finding_count"] = len(result.findings)
    result.summary["findings_by_type"] = _count_by(result.findings, "type")
    result.summary["findings_by_severity"] = _count_by(result.findings, "severity")


def _count_by(items: list, attr: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        value = getattr(item, attr)
        key = value.value if hasattr(value, "value") else str(value)
        counts[key] = counts.get(key, 0) + 1
    return counts


def _evaluate_scan_gate(
    scan_id: str,
    request: Request,
    thresholds: ArchitectureGateThresholds,
    baseline_scan_id: str | None,
) -> ArchitectureFitnessGateResult:
    repository = get_repository(request)
    if repository.get_scan(scan_id) is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    result = repository.get_scan_result(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Scan report not found")

    baseline = None
    if baseline_scan_id:
        if repository.get_scan(baseline_scan_id) is None:
            raise HTTPException(status_code=404, detail="Baseline scan not found")
        baseline = repository.get_scan_result(baseline_scan_id)
        if baseline is None:
            raise HTTPException(status_code=404, detail="Baseline scan report not found")

    return evaluate_architecture_gate(
        result,
        thresholds=thresholds,
        baseline=baseline,
        baseline_scan_id=baseline_scan_id,
    )


def _load_ai_context(
    payload: AIExplainerRequest, request: Request
) -> tuple[AnalysisResult | None, list[HealthScore], list[PolicyRecord], EvolutionReport | None]:
    repository = get_repository(request)

    scan_id = payload.scan_id or payload.target_scan_id
    result: AnalysisResult | None = None
    scores: list[HealthScore] = []
    project_id = payload.project_id

    if scan_id:
        scan = repository.get_scan(scan_id)
        if scan is None:
            raise HTTPException(status_code=404, detail="Scan not found")
        result = repository.get_scan_result(scan_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Scan report not found")
        scores = repository.list_scores(scan_id)
        project_id = project_id or scan.project_id

    policies = []
    if project_id:
        project = repository.get_project(project_id)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        policies = repository.list_policies(project_id)

    comparison = None
    if payload.base_scan_id and payload.target_scan_id:
        base_scan = repository.get_scan(payload.base_scan_id)
        target_scan = repository.get_scan(payload.target_scan_id)
        if base_scan is None or target_scan is None:
            raise HTTPException(status_code=404, detail="Comparison scan not found")
        base_result = repository.get_scan_result(payload.base_scan_id)
        target_result = repository.get_scan_result(payload.target_scan_id)
        if base_result is None or target_result is None:
            raise HTTPException(status_code=404, detail="Comparison scan report not found")
        comparison = compare_scan_results(
            project_id or target_scan.project_id,
            payload.base_scan_id,
            base_result,
            payload.target_scan_id,
            target_result,
        )
        if payload.target_scan_id == scan_id:
            result = target_result
            scores = repository.list_scores(payload.target_scan_id)

    return result, scores, policies, comparison


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
