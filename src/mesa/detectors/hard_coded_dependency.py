from __future__ import annotations

import os
from typing import Any

import networkx as nx

from mesa.detectors.base import Detector
from mesa.detectors.evidence import evidence_chain_item, source_files_from_evidence
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

# Well-known local observability/infrastructure sidecar ports. A hard-coded
# reference to one of these on a loopback host is still genuinely hard-coded,
# but is much more likely to be a local agent address than a cross-service
# business dependency, so it is downgraded rather than treated the same as
# e.g. a service-to-service HTTP call. Overridable via MESA_INFRA_PORT_ALLOWLIST.
_DEFAULT_INFRA_PORTS: dict[int, str] = {
    4317: "the OpenTelemetry Collector (gRPC)",
    4318: "the OpenTelemetry Collector (HTTP)",
    8125: "StatsD",
    9090: "Prometheus",
    9091: "the Prometheus Pushgateway",
    6831: "the Jaeger agent (compact thrift)",
    6832: "the Jaeger agent (binary thrift)",
    14268: "the Jaeger collector (HTTP)",
    8500: "Consul",
    8200: "Vault",
}
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}


def _infra_port_allowlist() -> dict[int, str]:
    override = os.getenv("MESA_INFRA_PORT_ALLOWLIST")
    if override is None:
        return _DEFAULT_INFRA_PORTS
    table: dict[int, str] = {}
    for entry in override.split(","):
        entry = entry.strip()
        if not entry:
            continue
        port_part = entry.rsplit(":", 1)[-1]
        try:
            port = int(port_part)
        except ValueError:
            continue
        table[port] = f"a configured infrastructure port ({entry})"
    return table


def _infra_service_label(host: str | None, port: int | None) -> str | None:
    if host is None or port is None:
        return None
    if host.lower() not in _LOCAL_HOSTS:
        return None
    return _infra_port_allowlist().get(port)


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
    host = dependency.get("host")
    port = dependency.get("port")
    infra_label = _infra_service_label(host, port)
    severity = (
        Severity.LOW if infra_label else _severity(file_type, dependency.get("reason"), duplicate_count)
    )
    confidence = _confidence(file_type, dependency.get("reason"), duplicate_count)
    value = dependency.get("value", "unknown endpoint")
    location = _location(source)
    evidence_entry: dict[str, Any] = {
        "anti_pattern": "Hard-Coded Service Dependency",
        "service": service_name,
        "value": value,
        "host": host,
        "port": port,
        "scheme": dependency.get("scheme"),
        "file_type": file_type,
        "file_path": source.get("file_path"),
        "line_number": source.get("line_number"),
        "context": dependency.get("context"),
        "reason": dependency.get("reason"),
        "duplicate_occurrences": duplicate_count,
        "explanation": _explanation(file_type, dependency.get("reason"), duplicate_count),
    }
    if infra_label:
        evidence_entry["likely_infrastructure_address"] = True
        evidence_entry["infrastructure_service_guess"] = infra_label
    evidence = [evidence_entry]

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
        evidence=evidence,
        recommendation=(
            "Move endpoint values behind configuration or service discovery, inject them through "
            "environment-specific settings, and centralize client construction. For Kubernetes or "
            "Docker deployments, prefer DNS/service names supplied by deployment manifests instead "
            "of embedding URLs in application source code."
        ),
        detector_name="HardCodedServiceDependencyDetector",
        rule_id="hard-coded-dependency.static-endpoint-reference",
        evidence_chain=[
            evidence_chain_item(
                "scan_text_evidence",
                f"Found endpoint-like value in {file_type} evidence.",
                source=source,
                data={"value": value, "reason": dependency.get("reason")},
            ),
            evidence_chain_item(
                "classify_endpoint",
                "Classified the value as a service dependency because it matches a service host, local endpoint, or private network endpoint.",
                source=source,
                data={"host": dependency.get("host"), "port": dependency.get("port")},
            ),
            evidence_chain_item(
                "score_confidence",
                "Adjusted confidence using file type, endpoint reason, and duplicate occurrence count.",
                source=source,
                data={"duplicate_occurrences": duplicate_count, "confidence": confidence},
            ),
        ],
        confidence_reason=_explanation(file_type, dependency.get("reason"), duplicate_count),
        limitations=_limitations(port, infra_label),
        source_files=source_files_from_evidence(evidence),
        related_services=[service_name],
        why_valid=(
            f"MESA found {value} directly embedded in {location}; this is concrete source/config "
            "evidence of a deployment endpoint being coupled to the service implementation."
        ),
    )


def _limitations(port: int | None, infra_label: str | None) -> list[str]:
    limitations = [
        "A hard-coded endpoint may still be acceptable in local-only test fixtures.",
        "The detector does not execute deployment manifests to prove the endpoint is active.",
    ]
    if infra_label:
        limitations.append(
            f"Port {port} is commonly used by {infra_label}; verify this is not a local "
            "observability/infrastructure sidecar before treating it as a cross-service "
            "coupling risk. Override MESA_INFRA_PORT_ALLOWLIST to change which ports are "
            "treated this way."
        )
    return limitations


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
