from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from mesa import __version__
from mesa.analysis import analyze_services
from mesa.models import (
    AnalysisRequest,
    AnalysisResult,
    Finding,
    PersistedScanResult,
    ProjectCreate,
    ProjectRecord,
    RunScanRequest,
    ScanRecord,
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


@app.post("/projects", response_model=ProjectRecord, status_code=201)
def create_project(payload: ProjectCreate, request: Request) -> ProjectRecord:
    return get_repository(request).create_project(payload)


@app.get("/projects/{project_id}", response_model=ProjectRecord)
def get_project(project_id: str, request: Request) -> ProjectRecord:
    project = get_repository(request).get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.post("/projects/{project_id}/scans", response_model=PersistedScanResult, status_code=201)
def run_project_scan(project_id: str, payload: RunScanRequest, request: Request) -> PersistedScanResult:
    repository = get_repository(request)
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    result = analyze_services(payload.service_paths, payload.chatty_threshold)
    scan = repository.save_scan_result(project_id, result)
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
