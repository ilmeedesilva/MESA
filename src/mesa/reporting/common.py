"""Small helpers shared by the report formats."""

from __future__ import annotations

from mesa.models import SEVERITY_RANK, Finding, FindingType, Severity, SourceLocation

TYPE_TITLES = {
    FindingType.CYCLIC_DEPENDENCY: "Cyclic dependency",
    FindingType.CHATTY_SERVICE: "Chatty service",
    FindingType.SHARED_DATABASE: "Shared database",
    FindingType.HARD_CODED_SERVICE_DEPENDENCY: "Hard-coded service dependency",
    FindingType.GOD_SERVICE: "God service",
    FindingType.GOVERNANCE_POLICY_VIOLATION: "Governance policy violation",
}


def type_title(finding_type: FindingType) -> str:
    return TYPE_TITLES.get(finding_type, finding_type.value.replace("_", " ").capitalize())


def subject(finding: Finding) -> str:
    """What the finding is about, e.g. `a -> b -> a` for a cycle."""
    first = finding.evidence[0] if finding.evidence else {}
    if finding.type == FindingType.CYCLIC_DEPENDENCY and isinstance(first, dict):
        cycle = first.get("cycle")
        if isinstance(cycle, list) and cycle:
            # Start at the alphabetically first service so the text does not
            # depend on the order in which the cycle was found.
            names = [str(item) for item in cycle]
            start = names.index(min(names))
            rotated = names[start:] + names[:start]
            return " -> ".join([*rotated, rotated[0]])
    if (
        finding.type == FindingType.CHATTY_SERVICE
        and isinstance(first, dict)
        and first.get("caller")
        and first.get("callee")
    ):
        return f"{first['caller']} -> {first['callee']} ({first.get('call_count', '?')} calls)"
    if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY and isinstance(first, dict):
        return f"{finding.services[0]} uses {first.get('value', 'a fixed address')}"
    if finding.type == FindingType.SHARED_DATABASE and isinstance(first, dict):
        return f"{', '.join(finding.services)} share {first.get('database', 'a database')}"
    return ", ".join(finding.services) or "system"


def locations(finding: Finding, limit: int = 5) -> list[tuple[SourceLocation, str]]:
    """Distinct file:line places in the evidence, primary location first, each
    with a short note such as "calls http://..."."""
    candidates: list[tuple[object, str]] = []
    for item in finding.evidence:
        if not isinstance(item, dict):
            continue
        if item.get("source_service") and item.get("target_service"):
            candidates.append(
                (item.get("source"), f"calls {item.get('url') or item['target_service']}")
            )
        for call in item.get("calls", []) if isinstance(item.get("calls"), list) else []:
            if isinstance(call, dict):
                candidates.append((call.get("source"), f"calls {call.get('url', '')}".strip()))
        if item.get("database"):
            candidates.append((item.get("source"), f"connects to {item['database']}"))
        for place in item.get("locations", []) if isinstance(item.get("locations"), list) else []:
            if isinstance(place, dict):
                candidates.append((place, _place_note(place)))
        if item.get("file_path"):
            candidates.append((item, f"uses {item.get('value', '')}".strip()))

    notes: dict[tuple[str, int | None], str] = {}
    ordered: list[SourceLocation] = []

    def add(raw: object, note: str) -> None:
        if not isinstance(raw, dict) or not isinstance(raw.get("file_path"), str):
            return
        line = raw.get("line_number") if isinstance(raw.get("line_number"), int) else None
        key = (raw["file_path"], line)
        if key not in notes:
            ordered.append(SourceLocation(file_path=raw["file_path"], line_number=line))
            notes[key] = note
        elif note and not notes[key]:
            notes[key] = note

    if finding.primary_location is not None:
        add(finding.primary_location.model_dump(), "")
    for raw, note in candidates:
        add(raw, note)
    # Primary first, then the rest in file order, so the list is stable.
    primary, rest = ordered[:1], ordered[1:]
    if finding.primary_location is None:
        primary, rest = [], ordered
    rest = sorted(rest, key=lambda loc: (loc.file_path, loc.line_number or 0))
    chosen = (primary + rest)[:limit]
    return [(loc, notes[(loc.file_path, loc.line_number)]) for loc in chosen]


def _place_note(place: dict) -> str:
    if place.get("role") == "api_routes":
        return f"defines {place.get('endpoint_count', 'its')} API routes"
    if place.get("role") == "large_file":
        return f"{place.get('line_count', '?')} lines"
    return ""


def why_it_matters(finding: Finding) -> str:
    if finding.recommendations and finding.recommendations[0].architectural_consequence:
        return finding.recommendations[0].architectural_consequence
    return ""


def how_to_fix(finding: Finding, steps: int = 2) -> list[str]:
    if finding.recommendations and finding.recommendations[0].refactoring_steps:
        return finding.recommendations[0].refactoring_steps[:steps]
    return [finding.recommendation] if finding.recommendation else []


def sort_findings(findings: list[Finding]) -> list[Finding]:
    """Most severe first, then by type and subject, so reports are stable."""
    return sorted(
        findings,
        key=lambda f: (-SEVERITY_RANK[f.severity], f.type.value, subject(f), f.fingerprint),
    )


def is_blocking(finding: Finding, minimum: Severity) -> bool:
    return SEVERITY_RANK[finding.severity] >= SEVERITY_RANK[minimum]
