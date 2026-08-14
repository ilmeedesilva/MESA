from pathlib import Path

from mesa.analysis import analyze_services
from mesa.models import FindingType


ROOT = Path(__file__).resolve().parents[1] / "demo-projects"


def _service_paths(project_name: str) -> list[str]:
    project_root = ROOT / project_name
    return [
        str(project_root / "order-service"),
        str(project_root / "payment-service"),
        str(project_root / "user-service"),
        str(project_root / "platform-service"),
    ]


def test_demo_projects_show_before_and_after_improvement() -> None:
    broken = analyze_services(_service_paths("myservice-broken"))
    fixed = analyze_services(_service_paths("myservice-fixed"))

    broken_types = {finding.type for finding in broken.findings}
    fixed_types = {finding.type for finding in fixed.findings}

    assert FindingType.CHATTY_SERVICE in broken_types
    assert FindingType.CYCLIC_DEPENDENCY in broken_types
    assert FindingType.SHARED_DATABASE in broken_types
    assert FindingType.HARD_CODED_SERVICE_DEPENDENCY in broken_types

    assert FindingType.CHATTY_SERVICE not in fixed_types
    assert FindingType.CYCLIC_DEPENDENCY not in fixed_types
    assert FindingType.SHARED_DATABASE not in fixed_types
    assert FindingType.HARD_CODED_SERVICE_DEPENDENCY not in fixed_types

    assert len(broken.findings) > len(fixed.findings)
    assert broken.summary["health_scores"]["system"]["score"] < fixed.summary["health_scores"]["system"]["score"]
