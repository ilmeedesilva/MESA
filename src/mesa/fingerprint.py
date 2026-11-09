"""Stable fingerprints for findings.

Finding IDs such as `MESA-HCDD-003` are counters: they change when another
finding appears earlier in the list. To compare two scans (for example the base
and the head of a pull request), MESA needs a key that only depends on *what*
was found. The fingerprint is a SHA-1 of:

* the finding type, the detector rule and the sorted service names, and
* the main piece of evidence for that type: the hard-coded URL, the shared
  database, the caller and callee of a chatty pair, or the governance policy.

Line numbers and file paths are left out on purpose, so moving code around does
not turn an existing problem into a "new" one. Two findings can share a
fingerprint (the same URL hard-coded twice in one service); comparisons count
them, so a third copy is still reported as new.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from collections.abc import Iterable
from typing import Any

from mesa.models import Finding, FindingType


def compute_fingerprint(finding: Finding) -> str:
    parts: dict[str, Any] = {
        "type": finding.type.value,
        "rule_id": finding.rule_id,
        "services": sorted(finding.services),
        "evidence": _main_evidence(finding),
    }
    payload = json.dumps(parts, sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def fingerprint_of(finding: Finding) -> str:
    """The stored fingerprint, or a computed one for reports made before 1.0."""
    return finding.fingerprint or compute_fingerprint(finding)


def assign_fingerprints(findings: Iterable[Finding]) -> None:
    for finding in findings:
        finding.fingerprint = compute_fingerprint(finding)


def new_findings(findings: list[Finding], baseline: list[Finding]) -> list[Finding]:
    """Findings that are not in `baseline`, counting repeated fingerprints."""
    remaining = Counter(fingerprint_of(finding) for finding in baseline)
    result: list[Finding] = []
    for finding in findings:
        key = fingerprint_of(finding)
        if remaining[key] > 0:
            remaining[key] -= 1
        else:
            result.append(finding)
    return result


def _main_evidence(finding: Finding) -> list[Any]:
    first = finding.evidence[0] if finding.evidence else {}
    if not isinstance(first, dict):
        return []
    if finding.type == FindingType.HARD_CODED_SERVICE_DEPENDENCY:
        return [first.get("value")]
    if finding.type == FindingType.CHATTY_SERVICE:
        return [first.get("caller"), first.get("callee")]
    if finding.type == FindingType.SHARED_DATABASE:
        return [first.get("database")]
    if finding.type == FindingType.GOVERNANCE_POLICY_VIOLATION:
        return [first.get("policy_id"), first.get("metric")]
    # Cyclic dependency and god service: the services identify the finding.
    return []
