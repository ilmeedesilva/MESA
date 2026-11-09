"""GitHub Actions workflow commands (`::error file=...,line=...::message`).

They show as annotations on the pull request's changed files. GitHub shows only
a limited number per step, so only the first few new findings are annotated;
SARIF is the complete inline route.
"""

from __future__ import annotations

from mesa.models import Finding, Severity
from mesa.reporting.common import sort_findings, subject, type_title

DEFAULT_LIMIT = 10

_COMMANDS = {
    Severity.CRITICAL: "error",
    Severity.HIGH: "error",
    Severity.MEDIUM: "warning",
    Severity.LOW: "notice",
}


def render_annotations(findings: list[Finding], *, limit: int = DEFAULT_LIMIT) -> list[str]:
    lines: list[str] = []
    for finding in sort_findings(findings):
        if len(lines) >= limit:
            break
        location = finding.primary_location
        if location is None:
            continue
        properties = [f"file={_property(location.file_path)}"]
        if location.line_number:
            properties.append(f"line={location.line_number}")
        properties.append(f"title={_property(f'MESA: {type_title(finding.type)}')}")
        message = f"{subject(finding)}. {finding.description}"
        lines.append(f"::{_COMMANDS[finding.severity]} {','.join(properties)}::{_data(message)}")
    return lines


def _data(value: str) -> str:
    return value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def _property(value: str) -> str:
    return _data(value).replace(":", "%3A").replace(",", "%2C")
