"""SARIF 2.1.0 output for GitHub code scanning.

Upload `mesa.sarif` with `github/codeql-action/upload-sarif` and findings appear
inline on the pull request's "Files changed" tab and in the Security tab.

- One rule per finding type, with help text.
- Severity maps to SARIF levels: CRITICAL and HIGH -> error, MEDIUM ->
  warning, LOW -> note.
- `partialFingerprints` carries MESA's fingerprint, so GitHub keeps tracking a
  finding when code moves.
- With a baseline, `baselineState` says whether a result is new or unchanged.
- GitHub needs a location for every result. Findings without one (system-wide
  governance findings) are left out and counted in the run's properties.
"""

from __future__ import annotations

from typing import Any

from mesa.models import Finding, FindingType, Severity
from mesa.reporting.common import how_to_fix, locations, sort_findings, subject, type_title

SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json"
INFORMATION_URI = "https://github.com/ilmeedesilva/MESA"
FINGERPRINT_KEY = "mesaFingerprint/v1"

_LEVELS = {
    Severity.CRITICAL: "error",
    Severity.HIGH: "error",
    Severity.MEDIUM: "warning",
    Severity.LOW: "note",
}

_RULE_HELP = {
    FindingType.CYCLIC_DEPENDENCY: (
        "Services call each other in a loop.",
        "Services in a cycle can no longer be deployed or scaled independently, and a failure "
        "in one can cascade through the others. Move the shared logic into one service, "
        "reverse one dependency, or replace one of the calls with an event.",
    ),
    FindingType.CHATTY_SERVICE: (
        "One service makes many separate calls to another.",
        "Many fine-grained synchronous calls add latency and couple the two services tightly. "
        "Combine the calls into a coarser API, use events, or keep a local read model.",
    ),
    FindingType.SHARED_DATABASE: (
        "Several services use the same database.",
        "A shared database couples the services' schemas and deployments. Give the data one "
        "owning service and let the others use its API or events.",
    ),
    FindingType.HARD_CODED_SERVICE_DEPENDENCY: (
        "A service address is written into code or configuration.",
        "Fixed hosts, ports and URLs break when services move between environments. Read the "
        "address from configuration or service discovery instead.",
    ),
    FindingType.GOD_SERVICE: (
        "One service has too many responsibilities.",
        "A service that owns many capabilities and dependencies becomes a bottleneck for "
        "change and a single point of failure. Split it along its business capabilities.",
    ),
    FindingType.GOVERNANCE_POLICY_VIOLATION: (
        "A configured architecture policy is not met.",
        "The scan breaks a rule from the project's governance policy file. Bring the "
        "architecture back within the rule or update the policy deliberately.",
    ),
}


def render_sarif(
    findings: list[Finding],
    *,
    version: str,
    new_fingerprints: set[str] | None = None,
) -> dict[str, Any]:
    """Build a SARIF log. With `new_fingerprints`, each result gets a baselineState."""
    rule_types = [t for t in FindingType if any(f.type == t for f in findings)]
    rule_index = {t: index for index, t in enumerate(rule_types)}
    results: list[dict[str, Any]] = []
    without_location = 0
    for finding in sort_findings(findings):
        result = _result(finding, rule_index[finding.type], new_fingerprints)
        if result is None:
            without_location += 1
        else:
            results.append(result)
    return {
        "$schema": SARIF_SCHEMA,
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "MESA",
                        "semanticVersion": version,
                        "informationUri": INFORMATION_URI,
                        "rules": [_rule(t) for t in rule_types],
                    }
                },
                "originalUriBaseIds": {
                    "%SRCROOT%": {"description": {"text": "The repository root."}}
                },
                "results": results,
                "properties": {"findingsWithoutLocation": without_location},
            }
        ],
    }


def _rule(finding_type: FindingType) -> dict[str, Any]:
    short, full = _RULE_HELP.get(finding_type, (type_title(finding_type), type_title(finding_type)))
    return {
        "id": _rule_id(finding_type),
        "name": type_title(finding_type).replace(" ", "").replace("-", ""),
        "shortDescription": {"text": short},
        "fullDescription": {"text": full},
        "help": {"text": full, "markdown": f"**{type_title(finding_type)}.** {full}"},
        "helpUri": INFORMATION_URI,
        "properties": {"tags": ["architecture", "microservices", "maintainability"]},
    }


def _result(
    finding: Finding, index: int, new_fingerprints: set[str] | None
) -> dict[str, Any] | None:
    places = locations(finding, limit=10)
    if not places:
        return None
    physical = [
        {
            "physicalLocation": {
                "artifactLocation": {"uri": location.file_path, "uriBaseId": "%SRCROOT%"},
                **({"region": {"startLine": location.line_number}} if location.line_number else {}),
            },
            **({"message": {"text": note}} if note else {}),
        }
        for location, note in places
    ]
    steps = " ".join(how_to_fix(finding))
    message = f"{type_title(finding.type)}: {subject(finding)}. {finding.description}"
    if steps:
        message += f" How to fix: {steps}"
    result: dict[str, Any] = {
        "ruleId": _rule_id(finding.type),
        "ruleIndex": index,
        "level": _LEVELS[finding.severity],
        "message": {"text": message},
        "locations": [physical[0]],
        "partialFingerprints": {FINGERPRINT_KEY: finding.fingerprint},
        "properties": {
            "severity": finding.severity.value,
            "confidence": finding.confidence,
            "services": finding.services,
            "mesaId": finding.id,
        },
    }
    if len(physical) > 1:
        result["relatedLocations"] = [
            {"id": number, **place} for number, place in enumerate(physical[1:], start=1)
        ]
    if new_fingerprints is not None:
        result["baselineState"] = "new" if finding.fingerprint in new_fingerprints else "unchanged"
    return result


def _rule_id(finding_type: FindingType) -> str:
    return "mesa/" + finding_type.value.lower().replace("_", "-")
