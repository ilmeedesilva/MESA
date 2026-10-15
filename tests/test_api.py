import json
from pathlib import Path
import shutil

from fastapi.testclient import TestClient

from mesa.api.main import app
from mesa.analysis import analyze_services
from mesa.analysis import explainer as explainer_module
from mesa.models import (
    AIExplainerIntent,
    AIExplainerRequest,
    AIExplainerResponse,
    ProjectCreate,
    RepoSourceMetadata,
)
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

    gate_response = client.get(f"/scans/{scan_id}/gate")
    assert gate_response.status_code == 200
    gate = gate_response.json()
    assert gate["status"] in {"passed", "failed"}
    assert gate["threshold"] == 75.0
    assert len(gate["rules"]) == 5

    del app.state.persistence_repository


def test_list_projects_returns_created_projects_in_newest_first_order() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    first = client.post("/projects", json={"name": "First Project"})
    second = client.post("/projects", json={"name": "Second Project"})

    assert first.status_code == 201
    assert second.status_code == 201

    response = client.get("/projects")
    assert response.status_code == 200
    projects = response.json()
    assert [project["name"] for project in projects[:2]] == ["Second Project", "First Project"]

    del app.state.persistence_repository


def test_project_setup_can_be_saved_and_loaded() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Configured Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    save_response = client.put(
        f"/projects/{project_id}/setup",
        json={
            "source_type": "GITHUB_URL",
            "source_location": "https://github.com/example-org/example-repo",
            "source_ref": "main",
            "selected_service_paths": ["service-a", "service-b"],
            "manual_service_paths": ["service-a", "service-b"],
            "chatty_threshold": 3,
        },
    )
    assert save_response.status_code == 200
    saved = save_response.json()
    assert saved["source_type"] == "GITHUB_URL"
    assert saved["selected_service_paths"] == ["service-a", "service-b"]

    get_response = client.get(f"/projects/{project_id}/setup")
    assert get_response.status_code == 200
    loaded = get_response.json()
    assert loaded["source_location"] == "https://github.com/example-org/example-repo"
    assert loaded["manual_service_paths"] == ["service-a", "service-b"]

    del app.state.persistence_repository


def test_project_setup_returns_null_when_no_configuration_exists() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Empty Setup Project"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    setup_response = client.get(f"/projects/{project_id}/setup")
    assert setup_response.status_code == 200
    assert setup_response.json() is None

    del app.state.persistence_repository


def test_project_setup_can_be_derived_from_existing_scan_when_no_setup_row_exists() -> None:
    repository = InMemoryPersistenceRepository()
    project = repository.create_project(ProjectCreate(name="Legacy Project"))
    result = analyze_services(
        [
            str(ROOT / "chatty" / "order-service"),
            str(ROOT / "chatty" / "user-service"),
        ]
    )
    result.summary["repository_source"] = {
        "source_type": "LOCAL_PATH",
        "source_path": str(ROOT / "chatty"),
        "workspace_path": str(ROOT / "chatty"),
    }
    repository.save_scan_result(
        project.id,
        result,
        RepoSourceMetadata(
            source_type="LOCAL_PATH",
            source_label="chatty",
            source_path=str(ROOT / "chatty"),
            workspace_path=str(ROOT / "chatty"),
        ),
    )

    app.state.persistence_repository = repository
    client = TestClient(app)

    setup_response = client.get(f"/projects/{project.id}/setup")
    assert setup_response.status_code == 200
    setup = setup_response.json()
    assert setup["source_type"] == "LOCAL_PATH"
    assert setup["source_location"] == str(ROOT / "chatty")
    assert "order-service" in setup["selected_service_paths"]
    assert len(setup["manual_service_paths"]) == 2

    del app.state.persistence_repository


def test_project_scan_updates_saved_manual_project_setup() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Manual Setup Project"})
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

    setup_response = client.get(f"/projects/{project_id}/setup")
    assert setup_response.status_code == 200
    setup = setup_response.json()
    assert setup["source_type"] is None
    assert setup["manual_service_paths"] == [
        str(ROOT / "chatty" / "order-service"),
        str(ROOT / "chatty" / "user-service"),
    ]

    del app.state.persistence_repository


def test_project_repo_scan_updates_saved_repository_setup() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Repo Setup Project"})
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

    setup_response = client.get(f"/projects/{project_id}/setup")
    assert setup_response.status_code == 200
    setup = setup_response.json()
    assert setup["source_type"] == "LOCAL_PATH"
    assert setup["source_location"] == str(ROOT / "chatty")
    assert setup["selected_service_paths"] == ["order-service", "user-service"]

    del app.state.persistence_repository


def test_scan_architecture_gate_supports_custom_thresholds() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Gate Project"})
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

    default_response = client.get(f"/scans/{scan_id}/gate")
    assert default_response.status_code == 200
    default_gate = default_response.json()
    assert default_gate["status"] == "failed"
    assert "cyclic_dependency_detected" in default_gate["failed_rules"]

    relaxed_response = client.post(
        f"/scans/{scan_id}/gate",
        json={
            "thresholds": {
                "minimum_health_score": 0,
                "maximum_critical_findings": 10,
                "allow_new_cyclic_dependencies": True,
                "allow_governance_violations": True,
                "allow_new_high_risk_coupling": True,
            }
        },
    )
    assert relaxed_response.status_code == 200
    relaxed_gate = relaxed_response.json()
    assert relaxed_gate["status"] == "passed"
    assert relaxed_gate["failed_rules"] == []

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
    assert record["true_positives"] is None
    assert record["false_positives"] is None
    assert record["false_negatives"] is None
    assert record["precision"] is None
    assert "no matching ground-truth findings were available" in record["notes"]

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


def test_research_evaluation_draft_uses_selected_scan_and_project_setup() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Draft Project"})
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

    draft_response = client.get(f"/research-records/draft/{scan_id}")
    assert draft_response.status_code == 200
    draft = draft_response.json()

    assert draft["project_id"] == project_id
    assert draft["scan_id"] == scan_id
    assert draft["expected_services"] == 2
    assert draft["detected_services"] == 2
    assert draft["total_findings"] == 4
    assert draft["accuracy_mode"] == "GROUND_TRUTH"
    assert draft["matched_benchmark_id"] == "chatty-services"
    assert draft["true_positives"] == 4
    assert draft["false_positives"] == 0
    assert draft["false_negatives"] == 0
    assert draft["precision"] == 1.0
    assert draft["recall"] == 1.0
    assert draft["f1_score"] == 1.0

    del app.state.persistence_repository


def test_research_evaluation_draft_leaves_accuracy_blank_without_ground_truth() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    project_response = client.post("/projects", json={"name": "Draft Real Repo"})
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

    draft_response = client.get(f"/research-records/draft/{scan_id}")
    assert draft_response.status_code == 200
    draft = draft_response.json()

    assert draft["project_id"] == project_id
    assert draft["expected_services"] == 3
    assert draft["detected_services"] == 3
    assert draft["accuracy_mode"] == "MANUAL_VALIDATION_REQUIRED"
    assert draft["matched_benchmark_id"] is None
    assert draft["true_positives"] is None
    assert draft["false_positives"] is None
    assert draft["false_negatives"] is None
    assert draft["precision"] is None
    assert draft["recall"] is None
    assert draft["f1_score"] is None
    assert "no matching ground-truth findings were available" in draft["notes"]

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
    all_actions = (
        roadmap["quick_wins"]
        + roadmap["medium_term_changes"]
        + roadmap["high_effort_refactors"]
    )
    assert all(action["playbook"] for action in all_actions)
    for action in all_actions:
        playbook = action["playbook"]
        assert playbook["problem_summary"] == action["summary"]
        assert playbook["recommended_strategy"]
        assert playbook["estimated_effort"]
        assert len(playbook["phases"]) == 3
        assert playbook["verification_checks"]
        assert playbook["rollback_plan"]
        assert playbook["risks"]
        assert playbook["related_findings"] == action["related_findings"]
        assert playbook["related_services"] == action["affected_services"]

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


def test_policy_import_allows_same_policy_ids_in_different_projects() -> None:
    app.state.persistence_repository = InMemoryPersistenceRepository()
    client = TestClient(app)

    first_project = client.post("/projects", json={"name": "First Governance Project"})
    second_project = client.post("/projects", json={"name": "Second Governance Project"})
    assert first_project.status_code == 201
    assert second_project.status_code == 201

    first_project_id = first_project.json()["id"]
    second_project_id = second_project.json()["id"]

    policy_document = """
policies:
  - id: no-cycles
    name: No cyclic dependencies
    rule: dependency_cycle_count == 0
    severity: critical
"""

    first_import = client.post(
        f"/projects/{first_project_id}/policies/import",
        json={"content": policy_document},
    )
    second_import = client.post(
        f"/projects/{second_project_id}/policies/import",
        json={"content": policy_document},
    )

    assert first_import.status_code == 200
    assert second_import.status_code == 200
    assert first_import.json()[0]["id"] == "no-cycles"
    assert second_import.json()[0]["id"] == "no-cycles"

    first_policies = client.get(f"/projects/{first_project_id}/policies")
    second_policies = client.get(f"/projects/{second_project_id}/policies")
    assert first_policies.status_code == 200
    assert second_policies.status_code == 200
    assert first_policies.json()[0]["project_id"] == first_project_id
    assert second_policies.json()[0]["project_id"] == second_project_id

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


def test_call_openai_responses_api_parses_structured_output(monkeypatch) -> None:
    structured_output = {
        "title": "Live explanation title",
        "answer": "Live explanation answer grounded in scan evidence.",
        "suggestions": ["Reduce direct calls between order-service and user-service."],
        "follow_up_questions": ["Which endpoints are called most often?"],
        "limitations": ["Static evidence only; no runtime traffic volume."],
        "confidence": "HIGH",
    }

    class _FakeHTTPResponse:
        def __init__(self, body: bytes) -> None:
            self._body = body

        def read(self) -> bytes:
            return self._body

        def __enter__(self) -> "_FakeHTTPResponse":
            return self

        def __exit__(self, *exc_info: object) -> bool:
            return False

    def fake_urlopen(request, timeout=None):
        envelope = json.dumps({"output_text": json.dumps(structured_output)}).encode("utf-8")
        return _FakeHTTPResponse(envelope)

    monkeypatch.setattr(explainer_module.urllib_request, "urlopen", fake_urlopen)
    monkeypatch.setenv("MESA_OPENAI_MODEL", "test-model")

    grounded_response = AIExplainerResponse(
        intent=AIExplainerIntent.SCAN_SUMMARY,
        title="Grounded title",
        answer="Grounded answer.",
        limitations=["Existing grounded limitation."],
    )
    payload = AIExplainerRequest(intent=AIExplainerIntent.SCAN_SUMMARY, question="Summarize this scan.")

    result = explainer_module._call_openai_responses_api(payload, grounded_response, "test-key")

    assert result is not None
    assert result.title == "Live explanation title"
    assert result.answer == "Live explanation answer grounded in scan evidence."
    assert result.suggestions == structured_output["suggestions"]
    assert result.follow_up_questions == structured_output["follow_up_questions"]
    assert "Existing grounded limitation." in result.limitations
    assert "Static evidence only; no runtime traffic volume." in result.limitations
    assert result.confidence.value == "HIGH"
    assert result.source == "openai-hybrid:test-model"


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


def test_list_benchmarks_endpoint_excludes_template() -> None:
    client = TestClient(app)

    response = client.get("/benchmarks")

    assert response.status_code == 200
    payload = response.json()
    ids = {item["id"] for item in payload}
    assert "ground_truth" in ids
    assert "public_repo_manual_review_template" not in ids


def test_run_benchmark_evaluation_endpoint_returns_metrics() -> None:
    client = TestClient(app)

    response = client.post("/benchmarks/ground_truth/evaluate")

    assert response.status_code == 200
    payload = response.json()
    assert payload["overall"]["precision"] >= 0.9
    assert "chatty-services" in {system["id"] for system in payload["systems"]}


def test_run_benchmark_evaluation_endpoint_404s_for_unknown_benchmark() -> None:
    client = TestClient(app)

    response = client.post("/benchmarks/does-not-exist/evaluate")

    assert response.status_code == 404


def test_run_benchmark_evaluation_endpoint_404s_for_unlisted_template() -> None:
    client = TestClient(app)

    response = client.post("/benchmarks/public_repo_manual_review_template/evaluate")

    assert response.status_code == 404


def test_get_ai_baseline_comparison_returns_404_when_no_report_exists(tmp_path, monkeypatch) -> None:
    from mesa.evaluation import runner as evaluation_runner_module

    monkeypatch.setattr(
        evaluation_runner_module, "AI_BASELINE_COMPARISON_PATH", tmp_path / "does_not_exist.json"
    )

    client = TestClient(app)
    response = client.get("/ai-baseline-comparison")

    assert response.status_code == 404
    assert "evaluate-ai-baseline" in response.json()["detail"]


def test_get_ai_baseline_comparison_returns_the_exported_report(tmp_path, monkeypatch) -> None:
    from mesa.evaluation import runner as evaluation_runner_module

    report_path = tmp_path / "ai_baseline_comparison.json"
    report_path.write_text(
        '{"benchmark": "ground_truth.yml", "runs_per_system": 5, "provider": "anthropic", "systems": []}',
        encoding="utf-8",
    )
    monkeypatch.setattr(evaluation_runner_module, "AI_BASELINE_COMPARISON_PATH", report_path)

    client = TestClient(app)
    response = client.get("/ai-baseline-comparison")

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "anthropic"
    assert payload["runs_per_system"] == 5


def test_run_benchmark_evaluation_endpoint_400s_for_missing_local_source(tmp_path, monkeypatch) -> None:
    from mesa.evaluation import runner as evaluation_runner_module

    benchmarks_dir = tmp_path / "benchmarks"
    benchmarks_dir.mkdir()
    (benchmarks_dir / "real_repo_missing.yml").write_text(
        """
benchmark: missing
systems:
  - id: missing-system
    name: Missing system
    service_paths:
      - definitely/does/not/exist
    ground_truth: []
""",
        encoding="utf-8",
    )
    monkeypatch.setattr(evaluation_runner_module, "BENCHMARKS_DIR", benchmarks_dir)

    client = TestClient(app)
    response = client.post("/benchmarks/real_repo_missing/evaluate")

    assert response.status_code == 400
    assert "do not exist locally" in response.json()["detail"]


def test_get_ai_baseline_comparisons_returns_every_model_run(tmp_path, monkeypatch) -> None:
    from mesa.evaluation import runner as evaluation_runner_module

    (tmp_path / "ai-baseline-comparison-opus5").mkdir()
    (tmp_path / "ai-baseline-comparison-opus5" / "ai_baseline_comparison.json").write_text(
        '{"model": "claude-opus-5", "provider": "anthropic", "runs_per_system": 5, "systems": []}',
        encoding="utf-8",
    )
    monkeypatch.setattr(evaluation_runner_module, "EVALUATION_RESULTS_DIR", tmp_path)

    response = TestClient(app).get("/ai-baseline-comparisons")

    assert response.status_code == 200
    assert [report["model"] for report in response.json()["reports"]] == ["claude-opus-5"]


def test_get_ai_baseline_comparisons_returns_404_when_nothing_exported(tmp_path, monkeypatch) -> None:
    from mesa.evaluation import runner as evaluation_runner_module

    monkeypatch.setattr(evaluation_runner_module, "EVALUATION_RESULTS_DIR", tmp_path)

    response = TestClient(app).get("/ai-baseline-comparisons")

    assert response.status_code == 404
    assert "evaluate-ai-baseline" in response.json()["detail"]


def test_live_ai_schema_is_valid_for_openai_strict_mode(monkeypatch) -> None:
    # OpenAI strict json_schema mode rejects a schema whose "required" list
    # does not name every property; this once made every non-streaming call
    # fall back silently to the grounded answer.
    from mesa.models import AIExplainerIntent, AIExplainerRequest, AIExplainerResponse

    captured: dict = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return json.dumps(
                {
                    "output": [
                        {
                            "type": "message",
                            "content": [
                                {
                                    "type": "output_text",
                                    "text": json.dumps(
                                        {
                                            "title": "Live title",
                                            "answer": "Live answer",
                                            "suggestions": [],
                                            "follow_up_questions": [],
                                            "limitations": [],
                                            "policy_document": None,
                                            "confidence": "HIGH",
                                        }
                                    ),
                                }
                            ],
                        }
                    ]
                }
            ).encode("utf-8")

    def fake_urlopen(request, timeout=None):
        captured["body"] = json.loads(request.data.decode("utf-8"))
        return FakeResponse()

    monkeypatch.setattr(explainer_module.urllib_request, "urlopen", fake_urlopen)
    grounded = AIExplainerResponse(
        intent=AIExplainerIntent.POLICY_WRITING_ASSISTANCE,
        title="Grounded",
        answer="Grounded answer",
        policy_document="policies: []\n",
    )
    result = explainer_module._call_openai_responses_api(
        AIExplainerRequest(question="Draft a policy"), grounded, "sk-test"
    )

    schema = captured["body"]["text"]["format"]["schema"]
    assert set(schema["required"]) == set(schema["properties"])
    assert result is not None
    assert result.answer == "Live answer"
    assert result.policy_document == "policies: []\n"


class _FakeClaudeBlock:
    def __init__(self, text: str) -> None:
        self.type = "text"
        self.text = text


class _FakeClaudeMessage:
    def __init__(self, text: str, stop_reason: str = "end_turn") -> None:
        self.content = [_FakeClaudeBlock(text)]
        self.stop_reason = stop_reason


class _FakeClaudeStream:
    def __init__(self, pieces: list[str]) -> None:
        self.text_stream = iter(pieces)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def get_final_message(self):
        return _FakeClaudeMessage("".join([]))


class _FakeClaudeClient:
    def __init__(self, structured: str = "", pieces: list[str] | None = None, stop_reason: str = "end_turn"):
        self.calls: list[dict] = []
        outer = self

        class _Messages:
            def create(self, **kwargs):
                outer.calls.append(kwargs)
                return _FakeClaudeMessage(structured, stop_reason)

            def stream(self, **kwargs):
                outer.calls.append(kwargs)
                return _FakeClaudeStream(pieces or [])

        self.messages = _Messages()


def _claude_env(monkeypatch, client: _FakeClaudeClient) -> None:
    monkeypatch.setenv("MESA_AI_MODE", "hybrid")
    monkeypatch.setenv("MESA_AI_PROVIDER", "anthropic")
    monkeypatch.setenv("MESA_ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setattr(explainer_module, "_anthropic_client", lambda api_key: client)


def _grounded_for_claude():
    from mesa.models import AIExplainerIntent, AIExplainerResponse

    return AIExplainerResponse(
        intent=AIExplainerIntent.FINDING_EXPLANATION, title="Grounded", answer="Grounded answer"
    )


def test_claude_provider_returns_structured_answer(monkeypatch) -> None:
    from mesa.models import AIExplainerRequest

    payload = json.dumps(
        {
            "title": "Claude title",
            "answer": "Claude answer",
            "suggestions": ["s1"],
            "follow_up_questions": [],
            "limitations": [],
            "policy_document": None,
            "confidence": "HIGH",
        }
    )
    client = _FakeClaudeClient(structured=payload)
    _claude_env(monkeypatch, client)

    result = explainer_module.finalize_response_with_live_ai(
        AIExplainerRequest(question="Explain"), _grounded_for_claude()
    )

    assert result.answer == "Claude answer"
    assert result.source.startswith("anthropic-hybrid:")
    request = client.calls[0]
    assert request["output_config"]["format"]["type"] == "json_schema"
    schema = request["output_config"]["format"]["schema"]
    assert set(schema["required"]) == set(schema["properties"])


def test_claude_provider_falls_back_on_refusal(monkeypatch) -> None:
    from mesa.models import AIExplainerRequest

    _claude_env(monkeypatch, _FakeClaudeClient(structured="", stop_reason="refusal"))

    result = explainer_module.finalize_response_with_live_ai(
        AIExplainerRequest(question="Explain"), _grounded_for_claude()
    )

    assert result.answer == "Grounded answer"
    assert result.source == "mesa-grounded-explainer-fallback"


def test_claude_provider_streams_answer(monkeypatch) -> None:
    from mesa.models import AIExplainerRequest

    _claude_env(monkeypatch, _FakeClaudeClient(pieces=["Hello ", "from Claude"]))

    response, chunks = explainer_module.stream_answer_text(
        AIExplainerRequest(question="Explain"), _grounded_for_claude()
    )

    assert chunks == ["Hello ", "from Claude"]
    assert response.answer == "Hello from Claude"
    assert response.source.startswith("anthropic-hybrid:")
