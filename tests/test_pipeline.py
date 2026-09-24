from pathlib import Path

from mesa.analysis import analyze_services
from mesa.analysis.extractor import _extract_text_config, _stem_matches_other_service, detect_language
from mesa.detectors.god_service import score_god_services
from mesa.discovery import discover_service_candidates
from mesa.graph.builder import build_graph
from mesa.models import FindingType, ServiceFacts
from mesa.storage.neo4j_store import _service_dependencies

ROOT = Path(__file__).parent / "fixtures"


def test_detects_chatty_services() -> None:
    result = analyze_services(
        [
            str(ROOT / "chatty" / "order-service"),
            str(ROOT / "chatty" / "user-service"),
        ]
    )

    assert any(finding.type == FindingType.CHATTY_SERVICE for finding in result.findings)


def test_detects_cyclic_dependencies() -> None:
    result = analyze_services(
        [
            str(ROOT / "cycle" / "order-service"),
            str(ROOT / "cycle" / "payment-service"),
        ]
    )

    assert any(finding.type == FindingType.CYCLIC_DEPENDENCY for finding in result.findings)


def test_detects_shared_database() -> None:
    result = analyze_services(
        [
            str(ROOT / "shared-db" / "order-service"),
            str(ROOT / "shared-db" / "payment-service"),
        ]
    )

    assert any(finding.type == FindingType.SHARED_DATABASE for finding in result.findings)




def test_graph_edges_keep_service_source() -> None:
    result = analyze_services(
        [
            str(ROOT / "chatty" / "order-service"),
            str(ROOT / "chatty" / "user-service"),
        ]
    )

    api_edges = [edge for edge in result.graph["edges"] if edge.get("type") == "api_call"]
    assert api_edges
    assert all(isinstance(edge["source"], str) for edge in api_edges)
    assert all("source_location" in edge for edge in api_edges)



def test_neo4j_dependency_projection_includes_api_and_shared_database_edges() -> None:
    dependencies = _service_dependencies(
        [
            {"source": "order-service", "target": "user-service", "type": "api_call"},
            {"source": "order-service", "target": "user-service", "type": "api_call"},
            {
                "source": "billing-service",
                "target": "payment-service",
                "type": "shared_database",
                "database": "postgres://db/orders",
            },
        ]
    )

    assert {dependency["kind"] for dependency in dependencies} == {"api_call", "shared_database"}
    api_dependency = next(
        dependency for dependency in dependencies if dependency["kind"] == "api_call"
    )
    assert api_dependency["weight"] == 2
    shared_dependency = next(
        dependency for dependency in dependencies if dependency["kind"] == "shared_database"
    )
    assert shared_dependency["database"] == "postgres://db/orders"



def test_detects_hard_coded_service_dependencies() -> None:
    result = analyze_services(
        [
            str(ROOT / "hardcoded" / "order-service"),
            str(ROOT / "hardcoded" / "billing-service"),
        ]
    )

    findings = [
        finding
        for finding in result.findings
        if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY
    ]
    assert findings
    evidence = [item for finding in findings for item in finding.evidence]
    values = {item["value"] for item in evidence}
    assert "http://user-service:8080/users" in values
    assert "http://inventory-service:3001/items" in values
    assert "http://10.0.0.5:8080/payments" in values
    assert any(item["line_number"] for item in evidence)
    assert all(item["file_path"] for item in evidence)


def test_hard_coded_dependency_detector_avoids_external_urls() -> None:
    result = analyze_services([str(ROOT / "hardcoded" / "clean-service")])

    assert not any(
        finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY
        for finding in result.findings
    )


def test_hard_coded_dependency_detector_handles_unresolved_placeholder_ports() -> None:
    result = analyze_services([str(ROOT / "hardcoded" / "gateway-service")])

    findings = [
        finding
        for finding in result.findings
        if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY
    ]
    assert findings
    evidence = [item for finding in findings for item in finding.evidence]
    values = {item["value"] for item in evidence}
    assert "http://localhost:${server.port" in values


def test_hard_coded_dependency_detector_downgrades_known_infra_ports() -> None:
    result = analyze_services([str(ROOT / "hardcoded" / "otel-service")])

    findings = [
        finding
        for finding in result.findings
        if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY
    ]
    assert len(findings) == 1
    finding = findings[0]
    assert finding.severity.value == "LOW"
    assert len(finding.evidence) == 1
    evidence = finding.evidence[0]
    assert evidence["likely_infrastructure_address"] is True
    assert "OpenTelemetry" in evidence["infrastructure_service_guess"]
    assert any("4317" in limitation for limitation in finding.limitations)


def test_hard_coded_dependency_detector_leaves_non_infra_ports_unaffected() -> None:
    result = analyze_services([str(ROOT / "hardcoded" / "order-service")])

    findings = [
        finding
        for finding in result.findings
        if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY
    ]
    assert findings
    for finding in findings:
        for evidence in finding.evidence:
            assert "likely_infrastructure_address" not in evidence


def test_infra_port_allowlist_env_override(monkeypatch) -> None:
    monkeypatch.setenv("MESA_INFRA_PORT_ALLOWLIST", "9999")
    result = analyze_services([str(ROOT / "hardcoded" / "otel-service")])

    findings = [
        finding
        for finding in result.findings
        if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY
    ]
    assert len(findings) == 1
    evidence = findings[0].evidence[0]
    assert "likely_infrastructure_address" not in evidence


def test_stem_matches_other_service_ignores_self_and_matches_hosted_variants() -> None:
    other_names = {"discovery-service"}

    assert _stem_matches_other_service(Path("config-service/discovery-service.yml"), other_names)
    assert _stem_matches_other_service(Path("config-service/discovery-service-docker.yml"), other_names)
    assert not _stem_matches_other_service(Path("discovery-service/discovery-service.yml"), set())
    assert not _stem_matches_other_service(Path("config-service/application.yml"), other_names)


def test_config_server_hosted_files_do_not_create_false_chatty_or_cyclic_findings() -> None:
    result = analyze_services(
        [
            str(ROOT / "config-server" / "config-service"),
            str(ROOT / "config-server" / "discovery-service"),
        ],
        chatty_threshold=3,
    )

    finding_types = {finding.type for finding in result.findings}
    assert FindingType.CHATTY_SERVICE not in finding_types
    assert FindingType.CYCLIC_DEPENDENCY not in finding_types

    hard_coded = [
        finding for finding in result.findings if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY
    ]
    assert any(
        "discovery-service:8061" in item.get("value", "")
        for finding in hard_coded
        if finding.services == ["config-service"]
        for item in finding.evidence
    )


def test_god_service_scoring_thresholds() -> None:
    graph = build_graph(
        [
            ServiceFacts(
                name="platform-service",
                root_path="/tmp/platform-service",
                file_count=22,
                domain_keywords=[
                    "orders", "payments", "users", "inventory", "shipments",
                    "invoices", "catalog", "returns", "analytics",
                ],
            ),
            ServiceFacts(name="small-service", root_path="/tmp/small-service", file_count=1),
        ]
    )
    graph.nodes["platform-service"].update(
        endpoint_count=10, database_count=3, linked_findings=5
    )
    graph.add_edge("small-service", "platform-service", type="api_call")
    graph.add_edge("platform-service", "small-service", type="api_call")

    scores = {score.service: score for score in score_god_services(graph)}

    assert scores["platform-service"].score >= 70
    assert scores["platform-service"].severity.value in {"HIGH", "CRITICAL"}
    assert scores["small-service"].score < 50


def test_detects_god_service_risk() -> None:
    result = analyze_services(
        [
            str(ROOT / "god" / "platform-service"),
            str(ROOT / "god" / "order-service"),
            str(ROOT / "god" / "billing-service"),
            str(ROOT / "god" / "inventory-service"),
            str(ROOT / "god" / "user-service"),
            str(ROOT / "god" / "payment-service"),
            str(ROOT / "god" / "notification-service"),
        ]
    )

    scores = {score["service"]: score for score in result.summary["god_service_scores"]}
    assert scores["platform-service"]["score"] >= 70
    assert scores["order-service"]["score"] < scores["platform-service"]["score"]
    god_findings = [finding for finding in result.findings if finding.type == FindingType.GOD_SERVICE]
    assert god_findings
    assert god_findings[0].services == ["platform-service"]
    assert "decreases" in god_findings[0].recommendation



def test_health_scores_are_generated_and_explainable() -> None:
    result = analyze_services(
        [
            str(ROOT / "god" / "platform-service"),
            str(ROOT / "god" / "order-service"),
            str(ROOT / "god" / "billing-service"),
            str(ROOT / "god" / "inventory-service"),
            str(ROOT / "god" / "user-service"),
            str(ROOT / "god" / "payment-service"),
            str(ROOT / "god" / "notification-service"),
        ]
    )

    health = result.summary["health_scores"]
    assert health["system"]["scope"] == "system"
    assert 0 <= health["system"]["score"] <= 100
    assert health["system"]["grade"] in {"Excellent", "Good", "Moderate", "Poor", "Critical"}
    assert health["service"]
    assert health["domain"]

    platform_score = next(
        score for score in health["service"] if score["target"] == "platform-service"
    )
    small_result = analyze_services([str(ROOT / "god" / "small-service")])
    small_score = small_result.summary["health_scores"]["service"][0]

    assert platform_score["score"] < small_score["score"]
    assert set(platform_score["breakdown"]) == {
        "coupling",
        "cohesion",
        "cyclic_dependencies",
        "shared_database_usage",
        "hard_coded_dependency_risk",
        "god_service_risk",
        "api_complexity",
        "deployment_independence",
        "ownership_clarity",
    }
    assert platform_score["explanation"]
    assert platform_score["recommendations"]


def test_findings_include_evidence_grounded_structured_recommendations() -> None:
    result = analyze_services(
        [
            str(ROOT / "god" / "platform-service"),
            str(ROOT / "god" / "order-service"),
            str(ROOT / "god" / "billing-service"),
            str(ROOT / "god" / "inventory-service"),
            str(ROOT / "god" / "user-service"),
            str(ROOT / "god" / "payment-service"),
            str(ROOT / "god" / "notification-service"),
        ]
    )

    assert result.findings
    for finding in result.findings:
        assert finding.recommendation
        assert finding.recommendations
        recommendation = finding.recommendations[0]
        assert recommendation.root_cause
        assert recommendation.architectural_consequence
        assert recommendation.affected_services == finding.services
        assert recommendation.refactoring_steps
        assert recommendation.expected_impact
        assert recommendation.priority in {"Immediate", "High", "Medium", "Low"}
        assert recommendation.estimated_difficulty in {"Low", "Medium", "High"}
        assert recommendation.evidence
        assert recommendation.source.startswith("rule-based")


def test_findings_include_evidence_confidence_ledger() -> None:
    result = analyze_services(
        [
            str(ROOT / "god" / "platform-service"),
            str(ROOT / "god" / "order-service"),
            str(ROOT / "god" / "billing-service"),
            str(ROOT / "god" / "inventory-service"),
            str(ROOT / "god" / "user-service"),
            str(ROOT / "god" / "payment-service"),
            str(ROOT / "god" / "notification-service"),
        ]
    )

    assert result.findings
    for finding in result.findings:
        assert finding.detector_name
        assert finding.rule_id
        assert finding.evidence_chain
        assert finding.confidence_reason
        assert finding.limitations
        assert finding.related_services == finding.services
        assert finding.why_valid
        assert 0 <= finding.confidence <= 1

    hardcoded_result = analyze_services(
        [
            str(ROOT / "hardcoded" / "order-service"),
            str(ROOT / "hardcoded" / "billing-service"),
        ]
    )
    hardcoded = next(
        finding
        for finding in hardcoded_result.findings
        if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY
    )
    assert hardcoded.source_files
    assert hardcoded.evidence_chain[0].source is not None


def test_recommendations_work_without_llm_configuration(monkeypatch) -> None:
    monkeypatch.delenv("MESA_LLM_RECOMMENDATIONS", raising=False)
    result = analyze_services([str(ROOT / "hardcoded" / "order-service")])

    hardcoded = next(
        finding for finding in result.findings
        if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY
    )
    recommendation = hardcoded.recommendations[0]

    assert recommendation.source == "rule-based"
    assert recommendation.affected_files
    assert "service discovery" in " ".join(recommendation.refactoring_steps).lower()


def test_health_score_calculation_is_deterministic() -> None:
    service_paths = [
        str(ROOT / "hardcoded" / "order-service"),
        str(ROOT / "hardcoded" / "billing-service"),
    ]

    first = analyze_services(service_paths).summary["health_scores"]
    second = analyze_services(service_paths).summary["health_scores"]

    assert first == second


def test_extracts_real_repo_style_service_facts() -> None:
    result = analyze_services(
        [
            str(ROOT / "real-repo" / "shop" / "frontend-service"),
            str(ROOT / "real-repo" / "shop" / "catalog-service"),
            str(ROOT / "real-repo" / "shop" / "inventory-api"),
        ]
    )
    services = {service.name: service for service in result.services}

    frontend = services["frontend-service"]
    assert frontend.language == "typescript"
    assert any(endpoint.path == "/home" and endpoint.method == "GET" for endpoint in frontend.endpoints)
    assert any(call.target_hint == "catalog-service" for call in frontend.calls)
    assert any(library.name == "express" for library in frontend.libraries)

    catalog = services["catalog-service"]
    assert catalog.language == "java"
    assert any(endpoint.path == "/products" and endpoint.method == "GET" for endpoint in catalog.endpoints)
    assert any(endpoint.path == "/products" and endpoint.method == "POST" for endpoint in catalog.endpoints)
    assert any(
        library.name == "org.springframework.boot:spring-boot-starter-web"
        for library in catalog.libraries
    )
    assert catalog.databases

    inventory = services["inventory-api"]
    assert any(endpoint.path == "/inventory" for endpoint in inventory.endpoints)
    assert inventory.databases


def test_recall_stress_fixture_finds_every_interleaved_anti_pattern() -> None:
    root = ROOT / "recall-stress"
    services = [
        "checkout-service",
        "billing-gateway-service",
        "fulfillment-service",
        "alert-service",
        "profile-service",
        "ledger-service",
        "legacy-bridge-service",
        "platform-hub-service",
    ]
    result = analyze_services([str(root / name) for name in services], chatty_threshold=3)

    finding_types = {finding.type for finding in result.findings}
    assert finding_types == {
        FindingType.CHATTY_SERVICE,
        FindingType.CYCLIC_DEPENDENCY,
        FindingType.SHARED_DATABASE,
        FindingType.GOD_SERVICE,
        FindingType.HARD_CODED_SERVICE_DEPENDENCY,
    }

    cyclic = next(f for f in result.findings if f.type == FindingType.CYCLIC_DEPENDENCY)
    assert set(cyclic.services) == {"checkout-service", "billing-gateway-service", "fulfillment-service"}

    chatty = next(f for f in result.findings if f.type == FindingType.CHATTY_SERVICE)
    assert set(chatty.services) == {"alert-service", "profile-service"}

    shared_db = next(f for f in result.findings if f.type == FindingType.SHARED_DATABASE)
    assert set(shared_db.services) == {"checkout-service", "billing-gateway-service", "ledger-service"}

    god_finding = next(f for f in result.findings if f.type == FindingType.GOD_SERVICE)
    assert god_finding.services == ["platform-hub-service"]
    god_score = next(
        score for score in result.summary["god_service_scores"] if score["service"] == "platform-hub-service"
    )
    assert god_score["score"] >= 70.0

    assert result.summary["finding_count"] == 26


def test_go_extraction_detects_endpoints_calls_and_cross_service_cycle() -> None:
    root = ROOT / "go-services"
    result = analyze_services(
        [str(root / "orders-service"), str(root / "inventory-service")], chatty_threshold=3
    )
    services = {service.name: service for service in result.services}

    orders = services["orders-service"]
    assert orders.language == "go"
    assert any(endpoint.path == "/orders" for endpoint in orders.endpoints)
    assert any(call.target_hint == "inventory-service" for call in orders.calls)

    inventory = services["inventory-service"]
    assert inventory.language == "go"
    assert any(endpoint.path == "/items" and endpoint.method == "GET" for endpoint in inventory.endpoints)
    assert any(call.target_hint == "orders-service" and call.method == "GRPC" for call in inventory.calls)

    finding_types = {finding.type for finding in result.findings}
    assert FindingType.CYCLIC_DEPENDENCY in finding_types
    assert FindingType.HARD_CODED_SERVICE_DEPENDENCY in finding_types


def test_db_type_normalization_does_not_double_mongodb() -> None:
    """Regression test for a real bug found evaluating Sock Shop: db_type
    normalization used chained .replace("mongo", "mongodb") calls, and since
    "mongo" is a substring of "mongodb" itself, a URI that already matched
    "mongodb://..." got corrupted into "mongodbdb://..." - which masked the
    real false-positive cause behind a SHARED_DATABASE finding (see
    benchmarks/real_repo_sockshop.yml evaluator_notes).
    """
    facts = ServiceFacts(name="carts", root_path="/tmp/carts")
    _extract_text_config(
        Path("app.js"), facts, text="var endpoint = 'mongodb://carts-db:27017/data';"
    )
    assert len(facts.databases) == 1
    assert facts.databases[0].db_type == "mongodb"

    facts_alias = ServiceFacts(name="legacy", root_path="/tmp/legacy")
    _extract_text_config(
        Path("app.js"), facts_alias, text="var endpoint = 'mongo://legacy-db:27017/data';"
    )
    assert facts_alias.databases[0].db_type == "mongodb"

    facts_pg = ServiceFacts(name="billing", root_path="/tmp/billing")
    _extract_text_config(
        Path("app.js"), facts_pg, text="var endpoint = 'postgresql://billing-db:5432/data';"
    )
    assert facts_pg.databases[0].db_type == "postgres"


def test_detect_language_is_not_hijacked_by_a_single_stray_file() -> None:
    """Regression test for a real bug found evaluating Sock Shop
    (github.com/microservices-demo): every Go/Java service there ships a
    Python BDD test helper, and the old detect_language() checked "does any
    .py file exist anywhere in the tree" with a fixed priority ahead of Go,
    so a single stray test script reported the whole service as Python.
    """
    root = ROOT / "language-detection" / "go-with-python-tests"
    assert detect_language(root) == "go"

    result = analyze_services([str(root)])
    service = result.services[0]
    assert service.language == "go"
    assert any(endpoint.path == "/catalogue" for endpoint in service.endpoints)


def test_go_mod_manifest_is_discoverable_and_selects_go_language() -> None:
    candidates = discover_service_candidates(ROOT / "go-services")
    by_path = {candidate.relative_path: candidate for candidate in candidates}

    assert "orders-service" in by_path
    assert "inventory-service" in by_path
    assert by_path["orders-service"].language == "go"
    assert by_path["orders-service"].confidence >= 0.24
    assert any("go.mod" in reason for reason in by_path["orders-service"].reasons)
