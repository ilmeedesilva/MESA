"""The pull request comment and job summary, in GitHub-flavoured Markdown.

Layout:

    MESA architecture check: FAILED (1 new problem, 0 fixed)
    Health score: 91.2 -> 78.4 (-12.8, allowed drop is 5.0)
    New problems     - each with file:line links, why it matters, how to fix
    Fixed            - collapsed
    Existing         - collapsed, "not blocking"
    footer           - version, run time, "static analysis only"

The first line is a hidden marker so the GitHub Action can find and update its
own comment instead of adding a new one on every push. The whole report stays
under GitHub's 65,536-character comment limit; when it would not, the least
important parts are cut and the report says how many findings are not shown.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from mesa.models import ArchitectureFitnessGateResult, ArchitectureGateMode, Finding, Severity
from mesa.reporting.common import (
    how_to_fix,
    is_blocking,
    locations,
    sort_findings,
    subject,
    type_title,
    why_it_matters,
)

COMMENT_MARKER = "<!-- mesa-report -->"
_URL = re.compile(r"[a-z][a-z0-9+.-]*://[^\s,;)]+", re.IGNORECASE)
# GitHub rejects comments over 65,536 characters; keep a margin.
DEFAULT_MAX_CHARS = 60_000

_SEVERITY_BADGE = {
    Severity.CRITICAL: "🔴 CRITICAL",
    Severity.HIGH: "🟠 HIGH",
    Severity.MEDIUM: "🟡 MEDIUM",
    Severity.LOW: "⚪ LOW",
}


@dataclass(frozen=True)
class LinkContext:
    """Where to link file:line references, e.g. https://github.com/o/r/blob/<sha>/path#L3."""

    server_url: str
    repository: str
    sha: str

    def url(self, file_path: str, line: int | None) -> str:
        anchor = f"#L{line}" if line else ""
        return (
            f"{self.server_url.rstrip('/')}/{self.repository}/blob/{self.sha}/{file_path}{anchor}"
        )


def render_markdown(
    gate: ArchitectureFitnessGateResult,
    *,
    findings: list[Finding] | None = None,
    base_label: str | None = None,
    links: LinkContext | None = None,
    version: str,
    elapsed_seconds: float | None = None,
    max_chars: int = DEFAULT_MAX_CHARS,
) -> str:
    """Render a gate result.

    `findings` are all findings of the scanned code; without a baseline they
    are listed as the scan's problems. With a baseline the gate's new and
    fixed findings are used and the rest are "existing".
    """
    all_findings = findings or []
    minimum = gate.thresholds.fail_on_new_severity
    new = sort_findings(gate.new_findings) if gate.has_baseline else sort_findings(all_findings)
    fixed = sort_findings(gate.fixed_findings)
    new_prints = {finding.fingerprint for finding in gate.new_findings}
    existing = (
        sort_findings([f for f in all_findings if f.fingerprint not in new_prints])
        if gate.has_baseline
        else []
    )

    header = _header(gate, len(new), len(fixed), base_label)
    footer = _footer(version, elapsed_seconds)
    blocks = [_finding_block(f, links, gate.mode, minimum) for f in new]
    fixed_section = _fixed_section(fixed)
    existing_section = _existing_section(existing, gate.unchanged_count, gate.has_baseline)

    # Drop the least important parts first until the report fits.
    omitted = 0
    while True:
        report = _assemble(
            header, blocks, omitted, fixed_section, existing_section, footer, gate.has_baseline
        )
        if len(report) <= max_chars:
            return report
        if existing:
            # Keep the count, drop the list.
            existing = []
            existing_section = _existing_section([], gate.unchanged_count, gate.has_baseline)
            continue
        if fixed_section and "<details>" in fixed_section:
            fixed_section = f"**Fixed:** {len(fixed)} problem(s) resolved by this change.\n"
            continue
        if blocks:
            blocks.pop()
            omitted += 1
            continue
        return report[:max_chars]


def _header(
    gate: ArchitectureFitnessGateResult, new: int, fixed: int, base_label: str | None
) -> str:
    status = "PASSED" if gate.status.value == "passed" else "FAILED"
    icon = "✅" if status == "PASSED" else "❌"
    lines = [COMMENT_MARKER]
    if gate.has_baseline:
        lines.append(
            f"## {icon} MESA architecture check: {status} "
            f"({new} new {_plural(new, 'problem')}, {fixed} fixed)"
        )
    else:
        lines.append(
            f"## {icon} MESA architecture check: {status} ({new} {_plural(new, 'finding')})"
        )
    lines.append("")
    if gate.has_baseline and gate.health_before is not None and gate.health_after is not None:
        delta = gate.health_delta or 0.0
        allowed = (
            f", allowed drop is {gate.thresholds.max_health_drop:.1f}"
            if gate.mode == ArchitectureGateMode.NEW_ONLY
            else ""
        )
        lines.append(
            f"**Health score:** {gate.health_before:.1f} → {gate.health_after:.1f} "
            f"({delta:+.1f}{allowed})"
        )
    elif gate.health_score is not None:
        lines.append(
            f"**Health score:** {gate.health_score:.1f} "
            f"(minimum {gate.thresholds.minimum_health_score:.1f})"
        )
    if base_label and gate.has_baseline:
        lines.append(f"Compared with `{_code(base_label)}`.")
    failed = [rule for rule in gate.rules if not rule.passed]
    if failed:
        lines += ["", "**Why it failed:**", ""]
        lines += [f"- {_escape(rule.message)}" for rule in failed]
    lines.append("")
    return "\n".join(lines)


def _finding_block(
    finding: Finding,
    links: LinkContext | None,
    mode: ArchitectureGateMode,
    minimum: Severity,
) -> str:
    badge = _SEVERITY_BADGE[finding.severity]
    non_blocking = (
        " (below the blocking level)"
        if mode == ArchitectureGateMode.NEW_ONLY and not is_blocking(finding, minimum)
        else ""
    )
    lines = [
        f"#### {badge} {type_title(finding.type)}: {_escape(subject(finding))}{non_blocking}",
        "",
    ]
    places = locations(finding)
    if places:
        for location, note in places:
            reference = _reference(location.file_path, location.line_number, links)
            lines.append(f"- {reference}{f' {_escape(note)}' if note else ''}")
        lines.append("")
    why = why_it_matters(finding)
    if why:
        lines.append(f"**Why it matters:** {_escape(why)}")
        lines.append("")
    steps = how_to_fix(finding)
    if steps:
        lines.append("**How to fix:** " + " ".join(_escape(step) for step in steps))
        lines.append("")
    return "\n".join(lines)


def _fixed_section(fixed: list[Finding]) -> str:
    if not fixed:
        return ""
    items = "\n".join(f"- {type_title(f.type)}: {_escape(subject(f))}" for f in fixed)
    return (
        f"<details>\n<summary>✅ Fixed by this change: {len(fixed)}</summary>\n\n"
        f"{items}\n\n</details>\n"
    )


def _existing_section(existing: list[Finding], count: int, has_baseline: bool) -> str:
    if not has_baseline or count == 0:
        return ""
    summary = f"Existing problems not caused by this change: {count} (not blocking)"
    if not existing:
        return f"{summary}. See the job summary or the `gate.json` report.\n"
    items = "\n".join(
        f"- {f.severity.value} {type_title(f.type)}: {_escape(subject(f))}" for f in existing
    )
    return f"<details>\n<summary>{summary}</summary>\n\n{items}\n\n</details>\n"


def _assemble(
    header: str,
    blocks: list[str],
    omitted: int,
    fixed_section: str,
    existing_section: str,
    footer: str,
    has_baseline: bool,
) -> str:
    parts = [header]
    if blocks:
        parts.append("### New problems\n" if has_baseline else "### Problems found\n")
        parts.extend(blocks)
    if omitted:
        parts.append(
            f"_{omitted} more {_plural(omitted, 'finding')} not shown here to keep this "
            "comment short. All findings are in the job summary and the `gate.json` report._\n"
        )
    if fixed_section:
        parts.append(fixed_section)
    if existing_section:
        parts.append(existing_section)
    parts.append(footer)
    return "\n".join(parts)


def _footer(version: str, elapsed_seconds: float | None) -> str:
    timing = f"Ran in {elapsed_seconds:.1f}s · " if elapsed_seconds is not None else ""
    return (
        "---\n"
        f"<sub>{timing}MESA {_escape(version)} · Static analysis only: no code was executed.</sub>\n"
    )


def _reference(file_path: str, line: int | None, links: LinkContext | None) -> str:
    label = f"{file_path}:{line}" if line else file_path
    code = f"`{_code(label)}`"
    if links is None:
        return code
    return f"[{code}]({links.url(file_path, line)})"


def _escape(text: str) -> str:
    """Neutralise HTML and Markdown that could break the comment layout.

    URLs go in code spans: GitHub would otherwise turn addresses such as
    http://user-service:8080 into links that lead nowhere.
    """
    parts: list[str] = []
    position = 0
    text = str(text).replace(" -> ", " → ")
    for match in _URL.finditer(text):
        parts.append(_escape_plain(text[position : match.start()]))
        parts.append(f"`{_code(match.group(0))}`")
        position = match.end()
    parts.append(_escape_plain(text[position:]))
    return "".join(parts)


def _escape_plain(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("*", "\\*")
        .replace("_", "\\_")
        .replace("`", "'")
        .replace("@", "@​")  # no accidental @mentions
    )


def _code(text: str) -> str:
    return str(text).replace("`", "'")


def _plural(count: int, word: str) -> str:
    return word if count == 1 else f"{word}s"
