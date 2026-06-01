from pathlib import Path

from fastapi.testclient import TestClient

from mesa.api.main import app
from mesa.storage import InMemoryPersistenceRepository

ROOT = Path(__file__).parent / "fixtures"


def test_health() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_analyze_endpoint() -> None:
    client = TestClient(app)
    response = client.post(
        "/analyze",
        json={
            "service_paths": [
                str(ROOT / "chatty" / "order-service"),
                str(ROOT / "chatty" / "user-service"),
            ]
        },
    )
    assert response.status_code == 200
    assert response.json()["summary"]["finding_count"] >= 1



def test_project_scan_persistence_endpoints() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Fixture Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    scan_response = client.post(
        f"/projects/{project_id}/scans",
        json={
            "service_paths": [
                str(ROOT / "chatty" / "order-service"),
                str(ROOT / "chatty" / "user-service"),
            ]
        },
    )
    assert scan_response.status_code == 201
    scan_id = scan_response.json()["scan"]["id"]

    history_response = client.get(f"/projects/{project_id}/scans")
    assert history_response.status_code == 200
    assert history_response.json()[0]["id"] == scan_id

    result_response = client.get(f"/scans/{scan_id}")
    assert result_response.status_code == 200
    assert result_response.json()["result"]["summary"]["finding_count"] == 1

    findings_response = client.get(f"/scans/{scan_id}/findings")
    assert findings_response.status_code == 200
    assert findings_response.json()[0]["type"] == "CHATTY_SERVICE"

    del app.state.persistence_repository


class FakeArchitectureStore:
    def __init__(self) -> None:
        self.saved: list[tuple[str, str, object]] = []

    def save_scan_graph(self, project_id: str, scan_id: str, result) -> None:
        self.saved.append((project_id, scan_id, result))

    def get_architecture_graph(self, scan_id: str) -> dict:
        return {
            "nodes": [{"properties": {"scan_id": scan_id, "name": "order-service"}}],
            "relationships": [],
        }

    def find_dependency_paths(
        self, scan_id: str, source: str, target: str, max_depth: int = 4
    ) -> list[dict]:
        return [{"services": [source, target], "length": 1, "scan_id": scan_id}]

    def find_cycles(self, scan_id: str, max_depth: int = 6) -> list[dict]:
        return [{"cycle": ["order-service", "payment-service"], "length": 2}]

    def get_service_centrality(self, scan_id: str) -> list[dict]:
        return [{"service": "order-service", "degree_centrality": 1}]

    def find_shared_database_relationships(self, scan_id: str) -> list[dict]:
        return []

    def find_high_risk_dependency_clusters(
        self, scan_id: str, degree_threshold: int = 3
    ) -> list[dict]:
        return [{"service": "order-service", "risk_reason": "dependency_hotspot"}]


def test_project_scan_writes_architecture_graph_and_exposes_queries() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    fake_store = FakeArchitectureStore()
    app.state.architecture_store = fake_store
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Graph Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    scan_response = client.post(
        f"/projects/{project_id}/scans",
        json={
            "service_paths": [
                str(ROOT / "chatty" / "order-service"),
                str(ROOT / "chatty" / "user-service"),
            ]
        },
    )
    assert scan_response.status_code == 201
    scan_id = scan_response.json()["scan"]["id"]
    assert fake_store.saved[0][0] == project_id
    assert fake_store.saved[0][1] == scan_id

    graph_response = client.get(f"/scans/{scan_id}/graph")
    assert graph_response.status_code == 200
    assert graph_response.json()["nodes"][0]["properties"]["scan_id"] == scan_id

    paths_response = client.get(
        f"/scans/{scan_id}/graph/paths",
        params={"source": "order-service", "target": "user-service"},
    )
    assert paths_response.status_code == 200
    assert paths_response.json()[0]["services"] == ["order-service", "user-service"]

    cycles_response = client.get(f"/scans/{scan_id}/graph/cycles")
    assert cycles_response.status_code == 200
    assert cycles_response.json()[0]["length"] == 2

    centrality_response = client.get(f"/scans/{scan_id}/graph/centrality")
    assert centrality_response.status_code == 200
    assert centrality_response.json()[0]["service"] == "order-service"

    shared_response = client.get(f"/scans/{scan_id}/graph/shared-databases")
    assert shared_response.status_code == 200

    clusters_response = client.get(f"/scans/{scan_id}/graph/high-risk-clusters")
    assert clusters_response.status_code == 200
    assert clusters_response.json()[0]["risk_reason"] == "dependency_hotspot"

    del app.state.persistence_repository
    del app.state.architecture_store

