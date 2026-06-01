from __future__ import annotations

from typing import Any

import networkx as nx

from mesa.detectors.base import Detector
from mesa.models import Finding, FindingType, Severity

CONFIG_FILE_TYPES = {
    "env",
    "docker_compose",
    "application_config",
    "yaml",
    "properties",
    "json",
}
SOURCE_FILE_TYPES = {"python", "javascript", "typescript", "java"}


class HardCodedServiceDependencyDetector(Detector):
    """Detect direct service endpoints embedded in source or configuration files."""

    def detect(self, graph: nx.MultiDiGraph) -> list[Finding]:
        findings: list[Finding] = []
        index = 1
        for service_name, data in sorted(graph.nodes(data=True)):
            if data.get("type") != "service":
                continue
            dependencies = data.get("hard_coded_dependencies", [])
            if not dependencies:
                continue

            for dependency in _deduplicate(dependencies):
                findings.append(_finding(index, service_name, dependency, dependencies))
                index += 1
        return findings


def _deduplicate(dependencies: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, int | None]] = set()
    unique: list[dict[str, Any]] = []
    for dependency in dependencies:
        source = dependency.get("source", {})
        key = (
            dependency.get("value", ""),
            source.get("file_path", ""),
            source.get("line_number"),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(dependency)
    return unique


def _finding(
    index: int, service_name: str, dependency: dict[str, Any], all_dependencies: list[dict[str, Any]]
) -> Finding:
    source = dependency.get("source", {})
    duplicate_count = sum(
        1 for candidate in all_dependencies if candidate.get("value") == dependency.get("value")
    )
    file_type = dependency.get("file_type", "unknown")
    severity = _severity(file_type, dependency.get("reason"), duplicate_count)
    confidence = _confidence(file_type, dependency.get("reason"), duplicate_count)
    value = dependency.get("value", "unknown endpoint")
    location = _location(source)

    return Finding(
        id=f"MESA-HCDD-{index:03d}",
        type=FindingType.HARD_CODED_SERVICE_DEPENDENCY,
        severity=severity,
        confidence=confidence,
        services=[service_name],
        description=(
            f"{service_name} directly references {value} in {location}. "
            "This creates a hard-coded service dependency that can bypass service discovery "
            "or environment-specific configuration."
        ),
        evidence=[
            {
                "anti_pattern": "Hard-Coded Service Dependency",
                "service": service_name,
                "value": value,
                "host": dependency.get("host"),
                "port": dependency.get("port"),
                "scheme": dependency.get("scheme"),
                "file_type": file_type,
                "file_path": source.get("file_path"),
                "line_number": source.get("line_number"),
                "context": dependency.get("context"),
                "reason": dependency.get("reason"),
                "duplicate_occurrences": duplicate_count,
                "explanation": _explanation(file_type, dependency.get("reason"), duplicate_count),
            }
        ],
        recommendation=(
            "Move endpoint values behind configuration or service discovery, inject them through "
            "environment-specific settings, and centralize client construction. For Kubernetes or "
            "Docker deployments, prefer DNS/service names supplied by deployment manifests instead "
            "of embedding URLs in application source code."
        ),
    )


def _severity(file_type: str, reason: str | None, duplicate_count: int) -> Severity:
    if file_type in SOURCE_FILE_TYPES and reason in {"private IP endpoint", "local development endpoint"}:
        return Severity.HIGH
    if file_type in SOURCE_FILE_TYPES:
        return Severity.MEDIUM
    if duplicate_count > 1:
        return Severity.MEDIUM
    return Severity.LOW


def _confidence(file_type: str, reason: str | None, duplicate_count: int) -> float:
    confidence = 0.78
    if file_type in SOURCE_FILE_TYPES:
        confidence += 0.1
    if reason in {"private IP endpoint", "local development endpoint"}:
        confidence += 0.07
    if duplicate_count > 1:
        confidence += 0.03
    return min(confidence, 0.95)


def _explanation(file_type: str, reason: str | None, duplicate_count: int) -> str:
    parts = [f"Detected {reason or 'service endpoint'} in a {file_type} file."]
    if file_type in SOURCE_FILE_TYPES:
        parts.append("Because the endpoint is inside source code, deployment changes may require code edits.")
    elif file_type in CONFIG_FILE_TYPES:
        parts.append("The endpoint is configuration-level evidence, so it is lower risk than source code but still couples deployments to concrete addresses.")
    if duplicate_count > 1:
        parts.append(f"The same endpoint appears {duplicate_count} times, increasing drift risk.")
    return " ".join(parts)


def _location(source: dict[str, Any]) -> str:
    file_path = source.get("file_path", "unknown file")
    line_number = source.get("line_number")
    if line_number is None:
        return file_path
    return f"{file_path}:{line_number}"
