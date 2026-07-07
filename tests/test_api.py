from pathlib import Path
import shutil

from fastapi.testclient import TestClient

from mesa.api.main import app
from mesa.analysis import explainer as explainer_module
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
    finding = response.json()["findings"][0]
    assert finding["detector_name"]
    assert finding["rule_id"]
    assert finding["evidence_chain"]
    assert finding["confidence_reason"]
    assert finding["limitations"]
    assert finding["why_valid"]


def test_repo_scan_preview_for_local_path() -> None:
    client = TestClient(app)
    response = client.post(
        "/repo-scans/preview",
        json={
            "source_type": "LOCAL_PATH",
            "location": str(ROOT / "chatty"),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"]["source_type"] == "LOCAL_PATH"
    assert "order-service" in payload["top_level_entries"]
    assert "order-service" in payload["candidate_service_paths"]
    assert payload["discovered_services"][0]["confidence"] > 0
    assert payload["discovered_services"][0]["reasons"]
    assert payload["file_count"] >= 2


def test_project_repo_scan_from_local_path_persists_source_metadata() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Repo Scan Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    scan_response = client.post(
        f"/projects/{project_id}/repo-scans",
        json={
            "source_type": "LOCAL_PATH",
            "location": str(ROOT / "chatty"),
            "service_paths": ["order-service", "user-service"],
        },
    )
    assert scan_response.status_code == 201
    payload = scan_response.json()
    assert payload["scan"]["source_type"] == "LOCAL_PATH"
    assert payload["scan"]["source_label"] == "chatty"
    assert payload["result"]["summary"]["repository_source"]["source_type"] == "LOCAL_PATH"
    assert payload["result"]["summary"]["finding_count"] >= 1

    del app.state.persistence_repository


def test_project_repo_scan_supports_archive_sources(tmp_path) -> None:
    archive_source = tmp_path / "chatty"
    shutil.copytree(ROOT / "chatty", archive_source)
    archive_base = tmp_path / "chatty-archive"
    archive_path = Path(shutil.make_archive(str(archive_base), "zip", archive_source))

    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Archive Repo Scan"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    preview_response = client.post(
        "/repo-scans/preview",
        json={
            "source_type": "ARCHIVE_PATH",
            "location": str(archive_path),
        },
    )
    assert preview_response.status_code == 200
    assert preview_response.json()["source"]["source_type"] == "ARCHIVE_PATH"

    scan_response = client.post(
        f"/projects/{project_id}/repo-scans",
        json={
            "source_type": "ARCHIVE_PATH",
            "location": str(archive_path),
            "service_paths": ["order-service", "user-service"],
        },
    )
    assert scan_response.status_code == 201
    assert scan_response.json()["scan"]["source_type"] == "ARCHIVE_PATH"

    del app.state.persistence_repository



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
    assert result_response.json()["result"]["summary"]["finding_count"] >= 1

    findings_response = client.get(f"/scans/{scan_id}/findings")
    assert findings_response.status_code == 200
    finding_types = {finding["type"] for finding in findings_response.json()}
    assert "CHATTY_SERVICE" in finding_types
    assert "HARD_CODED_SERVICE_DEPENDENCY" in finding_types

    scores_response = client.get(f"/scans/{scan_id}/scores")
    assert scores_response.status_code == 200
    scores = scores_response.json()
    assert any(score["scope"] == "system" for score in scores)
    assert any(score["scope"] == "service" for score in scores)
    assert all(0 <= score["score"] <= 100 for score in scores)

    roadmap_response = client.get(f"/scans/{scan_id}/roadmap")
    assert roadmap_response.status_code == 200
    roadmap = roadmap_response.json()
    assert roadmap["generated_from_finding_count"] >= 1
    assert roadmap["summary"]
    assert roadmap["suggested_order"]

    del app.state.persistence_repository


def test_research_evaluation_records_crud_from_scan_and_exports() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Research Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    scan_response = client.post(
        f"/projects/{project_id}/repo-scans",
        json={
            "source_type": "LOCAL_PATH",
            "location": str(ROOT / "real-repo" / "shop"),
            "service_paths": ["frontend-service", "catalog-service", "inventory-api"],
        },
    )
    assert scan_response.status_code == 201
    scan_id = scan_response.json()["scan"]["id"]

    create_response = client.post(f"/research-records/from-scan/{scan_id}")
    assert create_response.status_code == 201
    record = create_response.json()
    record_id = record["id"]
    assert record["scan_id"] == scan_id
    assert record["repo_name"] == "shop"
    assert record["expected_services"] == 3
    assert record["detected_services"] == 3
    assert record["total_findings"] >= 0
    assert record["true_positives"] == record["total_findings"]
    assert record["false_positives"] == 0
    assert record["false_negatives"] == 0
    assert record["precision"] == 1.0 if record["total_findings"] > 0 else record["precision"] is None
    assert "Draft accuracy fields" in record["notes"]

    update_response = client.put(
        f"/research-records/{record_id}",
        json={
            **record,
            "expected_services": 3,
            "true_positives": 4,
            "false_positives": 1,
            "false_negatives": 1,
            "notes": "Manual validation complete.",
            "limitations": "Small fixture repository.",
            "research_relevance": "Demonstrates real-repo style extraction.",
            "suitable_for_report": True,
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["precision"] == 0.8
    assert updated["recall"] == 0.8
    assert updated["f1_score"] == 0.8
    assert updated["suitable_for_report"] is True

    list_response = client.get("/research-records")
    assert list_response.status_code == 200
    assert list_response.json()[0]["id"] == record_id

    csv_response = client.get("/research-records/export", params={"format": "csv"})
    assert csv_response.status_code == 200
    assert "repo_name,commit_ref" in csv_response.text
    assert "shop" in csv_response.text

    markdown_response = client.get("/research-records/export", params={"format": "markdown"})
    assert markdown_response.status_code == 200
    assert "| repo_name | commit_ref |" in markdown_response.text

    json_response = client.get("/research-records/export", params={"format": "json"})
    assert json_response.status_code == 200
    assert json_response.json()[0]["id"] == record_id

    delete_response = client.delete(f"/research-records/{record_id}")
    assert delete_response.status_code == 204
    assert client.get(f"/research-records/{record_id}").status_code == 404

    del app.state.persistence_repository


def test_project_evolution_timeline_compares_consecutive_snapshots() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Evolution Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    first_scan = client.post(
        f"/projects/{project_id}/scans",
        json={
            "service_paths": [
                str(ROOT / "chatty" / "order-service"),
                str(ROOT / "chatty" / "user-service"),
            ]
        },
    )
    assert first_scan.status_code == 201
    first_scan_id = first_scan.json()["scan"]["id"]

    second_scan = client.post(
        f"/projects/{project_id}/scans",
        json={
            "service_paths": [
                str(ROOT / "cycle" / "order-service"),
                str(ROOT / "cycle" / "payment-service"),
            ]
        },
    )
    assert second_scan.status_code == 201
    second_scan_id = second_scan.json()["scan"]["id"]

    snapshots_response = client.get(f"/projects/{project_id}/snapshots")
    assert snapshots_response.status_code == 200
    assert len(snapshots_response.json()) == 2

    timeline_response = client.get(f"/projects/{project_id}/evolution")
    assert timeline_response.status_code == 200
    timeline = timeline_response.json()
    assert len(timeline) == 1
    assert timeline[0]["base_scan_id"] == first_scan_id
    assert timeline[0]["target_scan_id"] == second_scan_id
    assert timeline[0]["risk_trend"]["new_risk_count"] >= 1
    assert timeline[0]["new_dependencies"] or timeline[0]["removed_dependencies"]
    assert timeline[0]["recommendations"]

    compare_response = client.get(
        f"/projects/{project_id}/evolution/compare",
        params={"base_scan_id": first_scan_id, "target_scan_id": second_scan_id},
    )
    assert compare_response.status_code == 200
    comparison = compare_response.json()
    assert comparison["architecture_change_summary"]["summary"]
    assert comparison["score_trend"]["system_delta"] is not None

    del app.state.persistence_repository


def test_scan_roadmap_groups_actions_and_dependencies() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Roadmap Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    policy_document = """
policies:
  - id: no-cycles
    name: No cyclic dependencies
    rule: dependency_cycle_count == 0
    severity: critical
  - id: no-hardcoded-service-urls
    name: No hard-coded service URLs
    rule: hard_coded_service_url_count == 0
    severity: high
"""
    import_response = client.post(
        f"/projects/{project_id}/policies/import",
        json={"content": policy_document},
    )
    assert import_response.status_code == 200

    scan_response = client.post(
        f"/projects/{project_id}/scans",
        json={
            "service_paths": [
                str(ROOT / "cycle" / "order-service"),
                str(ROOT / "cycle" / "payment-service"),
                str(ROOT / "hardcoded" / "billing-service"),
            ]
        },
    )
    assert scan_response.status_code == 201
    scan_id = scan_response.json()["scan"]["id"]

    roadmap_response = client.get(f"/scans/{scan_id}/roadmap")
    assert roadmap_response.status_code == 200
    roadmap = roadmap_response.json()

    assert roadmap["quick_wins"]
    assert roadmap["medium_term_changes"]
    assert roadmap["high_effort_refactors"]
    assert len(roadmap["suggested_order"]) == (
        len(roadmap["quick_wins"])
        + len(roadmap["medium_term_changes"])
        + len(roadmap["high_effort_refactors"])
    )
    assert roadmap["dependencies"]
    assert any(
        "GOVERNANCE_POLICY_VIOLATION" in action["related_finding_types"]
        for action in roadmap["medium_term_changes"]
    )
    assert any(
        action["title"].lower().startswith("break the dependency cycle")
        for action in roadmap["high_effort_refactors"]
    )

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


def test_governance_policies_run_during_scan_and_store_findings() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Governance Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    policy_document = """
policies:
  - id: no-cycles
    name: No cyclic dependencies
    rule: dependency_cycle_count == 0
    severity: critical
  - id: max-outbound
    name: Maximum outbound dependencies
    rule: outbound_dependencies <= 0
    severity: high
"""
    import_response = client.post(
        f"/projects/{project_id}/policies/import",
        json={"content": policy_document},
    )
    assert import_response.status_code == 200
    policies = import_response.json()
    assert {policy["id"] for policy in policies} == {"no-cycles", "max-outbound"}

    update_response = client.put(
        f"/projects/{project_id}/policies/max-outbound",
        json={
            "id": "max-outbound",
            "name": "Maximum outbound dependencies",
            "rule": "outbound_dependencies <= 5",
            "severity": "HIGH",
            "enabled": True,
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["rule"] == "outbound_dependencies <= 5"

    list_response = client.get(f"/projects/{project_id}/policies")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 2

    scan_response = client.post(
        f"/projects/{project_id}/scans",
        json={
            "service_paths": [
                str(ROOT / "cycle" / "order-service"),
                str(ROOT / "cycle" / "payment-service"),
            ]
        },
    )
    assert scan_response.status_code == 201
    scan_id = scan_response.json()["scan"]["id"]
    findings = scan_response.json()["result"]["findings"]
    governance = [
        finding for finding in findings
        if finding["type"] == "GOVERNANCE_POLICY_VIOLATION"
    ]
    assert governance
    assert governance[0]["evidence"][0]["policy_id"] == "no-cycles"
    assert governance[0]["recommendations"]

    persisted_findings = client.get(f"/scans/{scan_id}/findings")
    assert persisted_findings.status_code == 200
    assert any(
        finding["type"] == "GOVERNANCE_POLICY_VIOLATION"
        for finding in persisted_findings.json()
    )

    del app.state.persistence_repository


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




def test_hard_coded_dependency_findings_appear_in_api_response() -> None:
    client = TestClient(app)
    response = client.post(
        "/analyze",
        json={"service_paths": [str(ROOT / "hardcoded" / "order-service")]},
    )

    assert response.status_code == 200
    findings = response.json()["findings"]
    hard_coded = [
        finding for finding in findings if finding["type"] == "HARD_CODED_SERVICE_DEPENDENCY"
    ]
    assert hard_coded
    evidence = hard_coded[0]["evidence"][0]
    assert evidence["file_path"]
    assert evidence["line_number"]
    assert hard_coded[0]["recommendation"]



def test_health_scores_appear_in_api_response() -> None:
    client = TestClient(app)
    response = client.post(
        "/analyze",
        json={
            "service_paths": [
                str(ROOT / "god" / "platform-service"),
                str(ROOT / "god" / "order-service"),
                str(ROOT / "god" / "billing-service"),
                str(ROOT / "god" / "inventory-service"),
                str(ROOT / "god" / "user-service"),
                str(ROOT / "god" / "payment-service"),
                str(ROOT / "god" / "notification-service"),
            ]
        },
    )

    assert response.status_code == 200
    health = response.json()["summary"]["health_scores"]
    assert health["system"]["scope"] == "system"
    assert health["service"]
    assert health["domain"]
    assert any(score["target"] == "platform-service" for score in health["service"])


def test_ai_explainer_summarizes_scan_with_grounded_evidence() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Explainer Project"})
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

    explainer_response = client.post(
        "/ai/explainer",
        json={
            "intent": "SCAN_SUMMARY",
            "project_id": project_id,
            "scan_id": scan_id,
            "question": "Summarize this scan.",
        },
    )
    assert explainer_response.status_code == 200
    payload = explainer_response.json()
    assert payload["intent"] == "SCAN_SUMMARY"
    assert payload["grounded"] is True
    assert payload["evidence"]
    assert "services" in payload["answer"].lower()

    del app.state.persistence_repository


def test_ai_explainer_searches_docs_without_scan_context() -> None:
    client = TestClient(app)
    response = client.post(
        "/ai/explainer",
        json={
            "intent": "DOC_QA",
            "question": "How do I scan a public repository?",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["intent"] == "DOC_QA"
    assert payload["evidence"]
    assert any(item["kind"] == "doc" for item in payload["evidence"])


def test_ai_explainer_compares_two_scans() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Explainer Compare Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    first_scan = client.post(
        f"/projects/{project_id}/scans",
        json={
            "service_paths": [
                str(ROOT / "chatty" / "order-service"),
                str(ROOT / "chatty" / "user-service"),
            ]
        },
    )
    second_scan = client.post(
        f"/projects/{project_id}/scans",
        json={
            "service_paths": [
                str(ROOT / "cycle" / "order-service"),
                str(ROOT / "cycle" / "payment-service"),
            ]
        },
    )
    assert first_scan.status_code == 201
    assert second_scan.status_code == 201

    response = client.post(
        "/ai/explainer",
        json={
            "intent": "COMPARE_SCANS",
            "project_id": project_id,
            "base_scan_id": first_scan.json()["scan"]["id"],
            "target_scan_id": second_scan.json()["scan"]["id"],
            "question": "What changed between these two scans?",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["intent"] == "COMPARE_SCANS"
    assert payload["evidence"]
    assert "changed" in payload["answer"].lower() or "new risks" in payload["answer"].lower()

    del app.state.persistence_repository


def test_ai_explainer_uses_live_hybrid_path_when_enabled(monkeypatch) -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Hybrid AI Project"})
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

    monkeypatch.setenv("MESA_AI_MODE", "hybrid")
    monkeypatch.setenv("MESA_OPENAI_API_KEY", "test-key")

    def fake_openai_response(payload, grounded_response, api_key):
        assert payload.scan_id == scan_id
        assert api_key == "test-key"
        return grounded_response.model_copy(
            update={
                "title": "Live hybrid explanation",
                "answer": "This answer came from the live hybrid AI path.",
                "source": "openai-hybrid:test-model",
            }
        )

    monkeypatch.setattr(explainer_module, "_call_openai_responses_api", fake_openai_response)

    response = client.post(
        "/ai/explainer",
        json={
            "intent": "SCAN_SUMMARY",
            "project_id": project_id,
            "scan_id": scan_id,
            "question": "Summarize this scan with the live AI path.",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["title"] == "Live hybrid explanation"
    assert payload["source"] == "openai-hybrid:test-model"
    assert "live hybrid ai path" in payload["answer"].lower()

    del app.state.persistence_repository


def test_ai_explainer_stream_returns_done_payload() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Stream Project"})
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

    response = client.post(
        "/ai/explainer/stream",
        json={
            "intent": "AUTO",
            "project_id": project_id,
            "scan_id": scan_id,
            "question": "Explain simply what should be solved first.",
        },
    )

    assert response.status_code == 200
    text = response.text
    assert "event: delta" in text
    assert "event: done" in text
    assert "PRIORITIZE_FIXES" in text

    del app.state.persistence_repository


def test_ai_explainer_can_generate_policy_draft() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Policy Draft Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    scan_response = client.post(
        f"/projects/{project_id}/scans",
        json={
            "service_paths": [
                str(ROOT / "cycle" / "order-service"),
                str(ROOT / "cycle" / "payment-service"),
            ]
        },
    )
    assert scan_response.status_code == 201
    scan_id = scan_response.json()["scan"]["id"]

    response = client.post(
        "/ai/explainer",
        json={
            "intent": "POLICY_WRITING_ASSISTANCE",
            "project_id": project_id,
            "scan_id": scan_id,
            "question": "Draft governance policy YAML for this project.",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["intent"] == "POLICY_WRITING_ASSISTANCE"
    assert payload["policy_document"]
    assert "policies:" in payload["policy_document"]

    del app.state.persistence_repository


def test_ai_status_reports_placeholder_key(monkeypatch) -> None:
    client = TestClient(app)
    monkeypatch.setenv("MESA_AI_MODE", "hybrid")
    monkeypatch.setenv("MESA_OPENAI_API_KEY", "your_api_key_here")

    response = client.get("/ai/explainer/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["state"] == "PLACEHOLDER_API_KEY"
    assert payload["live_enabled"] is True


def test_ai_status_reports_invalid_key_from_probe(monkeypatch) -> None:
    client = TestClient(app)
    monkeypatch.setenv("MESA_AI_MODE", "hybrid")
    monkeypatch.setenv("MESA_OPENAI_API_KEY", "sk-test123456")

    monkeypatch.setattr(
        explainer_module,
        "_probe_openai_status",
        lambda api_key, base_url, model: (
            explainer_module.AIConnectionState.INVALID_API_KEY,
            "OpenAI rejected the configured API key.",
        ),
    )

    response = client.get("/ai/explainer/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["state"] == "INVALID_API_KEY"
    assert "rejected" in payload["message"].lower()
