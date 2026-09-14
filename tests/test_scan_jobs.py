from pathlib import Path

from fastapi.testclient import TestClient

from mesa.api.main import app
from mesa.storage import InMemoryPersistenceRepository

ROOT = Path(__file__).parent / "fixtures"


def test_async_repo_scan_job_completes_and_produces_a_scan() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Async Scan Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    job_response = client.post(
        f"/projects/{project_id}/repo-scans/async",
        json={
            "source_type": "LOCAL_PATH",
            "location": str(ROOT / "chatty"),
            "service_paths": ["order-service", "user-service"],
        },
    )
    assert job_response.status_code == 202
    job = job_response.json()
    assert job["project_id"] == project_id
    assert job["status"] in {"QUEUED", "RUNNING", "COMPLETED"}

    status_response = client.get(f"/scan-jobs/{job['id']}")
    assert status_response.status_code == 200
    completed_job = status_response.json()
    assert completed_job["status"] == "COMPLETED"
    assert completed_job["scan_id"]
    assert completed_job["error_message"] is None
    assert completed_job["started_at"]
    assert completed_job["completed_at"]

    scan_response = client.get(f"/scans/{completed_job['scan_id']}")
    assert scan_response.status_code == 200
    assert scan_response.json()["scan"]["source_type"] == "LOCAL_PATH"

    del app.state.persistence_repository


def test_async_repo_scan_job_records_failure_without_raising() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Async Failure Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    job_response = client.post(
        f"/projects/{project_id}/repo-scans/async",
        json={
            "source_type": "LOCAL_PATH",
            "location": str(ROOT / "chatty" / "does-not-exist"),
            "service_paths": ["order-service"],
        },
    )
    assert job_response.status_code == 202
    job_id = job_response.json()["id"]

    status_response = client.get(f"/scan-jobs/{job_id}")
    assert status_response.status_code == 200
    failed_job = status_response.json()
    assert failed_job["status"] == "FAILED"
    assert failed_job["scan_id"] is None
    assert failed_job["error_message"]

    del app.state.persistence_repository


def test_async_repo_scan_returns_404_for_unknown_project() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    response = client.post(
        "/projects/does-not-exist/repo-scans/async",
        json={"source_type": "LOCAL_PATH", "location": str(ROOT / "chatty")},
    )
    assert response.status_code == 404

    del app.state.persistence_repository


def test_get_scan_job_returns_404_for_unknown_job() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    response = client.get("/scan-jobs/does-not-exist")
    assert response.status_code == 404

    del app.state.persistence_repository
