from pathlib import Path

from mesa.analysis import analyze_services
from mesa.models import FindingType
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
