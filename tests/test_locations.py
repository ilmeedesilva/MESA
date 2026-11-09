"""Every finding points at a file and line (Action plan Phase 2)."""

from pathlib import Path

from mesa.analysis import analyze_services
from mesa.detectors.evidence import primary_location_from_evidence
from mesa.models import FindingType

ROOT = Path(__file__).parent / "fixtures"
REPO = Path(__file__).parents[1]
DEMO = REPO / "demo-projects" / "myservice-broken"


def _demo_result():
    paths = [str(path) for path in sorted(DEMO.iterdir()) if path.is_dir()]
    return analyze_services(paths, path_base=REPO)


def test_every_demo_finding_has_a_relative_file_and_line() -> None:
    result = _demo_result()

    assert len(result.findings) == 26
    for finding in result.findings:
        location = finding.primary_location
        assert location is not None, finding.id
        assert location.line_number, finding.id
        assert location.file_path.startswith("demo-projects/myservice-broken/"), finding.id
        assert finding.source_files, finding.id
        assert all(not Path(entry).is_absolute() for entry in finding.source_files)


def test_chatty_evidence_keeps_each_call_site() -> None:
    finding = next(f for f in _demo_result().findings if f.type == FindingType.CHATTY_SERVICE)
    calls = finding.evidence[0]["calls"]

    assert calls and all(call["source"]["line_number"] for call in calls)
    assert finding.evidence_chain[0].source is not None


def test_cycle_evidence_has_a_call_site_for_every_edge() -> None:
    result = analyze_services(
        [str(ROOT / "cycle" / "order-service"), str(ROOT / "cycle" / "payment-service")]
    )
    cycle = next(f for f in result.findings if f.type == FindingType.CYCLIC_DEPENDENCY)
    edges = [item for item in cycle.evidence if "source_service" in item]

    assert {(e["source_service"], e["target_service"]) for e in edges} == {
        ("order-service", "payment-service"),
        ("payment-service", "order-service"),
    }
    assert all(edge["source"]["line_number"] for edge in edges)


def test_shared_database_points_at_each_connection_setting() -> None:
    result = analyze_services(
        [str(ROOT / "shared-db" / "order-service"), str(ROOT / "shared-db" / "payment-service")]
    )
    finding = next(f for f in result.findings if f.type == FindingType.SHARED_DATABASE)

    files = {item["source"]["file_path"] for item in finding.evidence}
    assert files == {"order-service/.env", "payment-service/.env"}
    assert finding.primary_location is not None
    assert finding.primary_location.line_number == 1


def test_god_service_points_at_its_routes_and_largest_files() -> None:
    finding = next(f for f in _demo_result().findings if f.type == FindingType.GOD_SERVICE)
    locations = finding.evidence[0]["locations"]

    assert locations[0]["role"] == "api_routes"
    assert locations[0]["file_path"] == "demo-projects/myservice-broken/platform-service/app.py"
    assert locations[0]["endpoint_count"] >= 1
    assert any(location["role"] == "large_file" for location in locations)
    assert finding.primary_location is not None
    assert finding.primary_location.file_path == locations[0]["file_path"]


def test_largest_files_are_relative_and_sorted() -> None:
    result = _demo_result()
    platform = next(s for s in result.services if s.name == "platform-service")

    counts = [item.line_count for item in platform.largest_files]
    assert 0 < len(counts) <= 3
    assert counts == sorted(counts, reverse=True)
    assert all(item.file_path.startswith("demo-projects/") for item in platform.largest_files)


def test_primary_location_prefers_an_entry_with_a_line_number() -> None:
    evidence = [
        {"source": {"file_path": "a/package.json", "line_number": None}},
        {"calls": [{"source": {"file_path": "a/app.py", "line_number": 7}}]},
    ]

    location = primary_location_from_evidence(evidence)

    assert location is not None
    assert (location.file_path, location.line_number) == ("a/app.py", 7)
    assert primary_location_from_evidence([{"note": "nothing"}]) is None
