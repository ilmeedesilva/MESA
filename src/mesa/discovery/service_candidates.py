from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import re

from mesa.models import ServiceDiscoveryCandidate

_MANIFEST_WEIGHTS = {
    "pyproject.toml": 0.34,
    "requirements.txt": 0.28,
    "package.json": 0.34,
    "pom.xml": 0.36,
    "go.mod": 0.28,
    "Dockerfile": 0.22,
    "docker-compose.yml": 0.14,
    "docker-compose.yaml": 0.14,
    "openapi.yaml": 0.24,
    "openapi.yml": 0.24,
    "openapi.json": 0.24,
    "swagger.yaml": 0.22,
    "swagger.yml": 0.22,
    "swagger.json": 0.22,
}

_ENTRYPOINT_WEIGHTS = {
    "app.py": 0.38,
    "main.py": 0.34,
    "server.py": 0.34,
    "application.py": 0.32,
    "index.js": 0.30,
    "server.js": 0.34,
    "main.ts": 0.32,
    "index.ts": 0.28,
    "app.js": 0.32,
    "app.ts": 0.32,
    "nest-cli.json": 0.30,
    "Application.java": 0.38,
    "App.java": 0.32,
}

_LANGUAGE_BY_FILENAME = {
    "pyproject.toml": "python",
    "requirements.txt": "python",
    "package.json": "typescript",
    "pom.xml": "java",
    "go.mod": "go",
    "openapi.yaml": "api-spec",
    "openapi.yml": "api-spec",
    "openapi.json": "api-spec",
}

_LANGUAGE_BY_SUFFIX = {
    ".py": "python",
    ".java": "java",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".go": "go",
}

_SERVICE_ROOT_MARKERS = {
    "pyproject.toml",
    "requirements.txt",
    "package.json",
    "pom.xml",
    "go.mod",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "openapi.yaml",
    "openapi.yml",
    "openapi.json",
    "swagger.yaml",
    "swagger.yml",
    "swagger.json",
}

_MIN_CONFIDENCE = 0.24
_DEFAULT_SELECTION_CONFIDENCE = 0.45


@dataclass
class _CandidateAccumulator:
    relative_path: str
    absolute_path: str
    service_name: str
    score: float = 0.0
    reasons: list[str] = field(default_factory=list)
    manifests: list[str] = field(default_factory=list)
    entrypoints: list[str] = field(default_factory=list)
    language_votes: dict[str, int] = field(default_factory=dict)
    signal_counts: dict[str, int] = field(
        default_factory=lambda: {
            "manifest_matches": 0,
            "entrypoint_matches": 0,
            "name_pattern_matches": 0,
            "docker_compose_matches": 0,
            "kubernetes_matches": 0,
            "framework_matches": 0,
            "openapi_matches": 0,
            "port_config_matches": 0,
            "environment_config_matches": 0,
            "database_config_matches": 0,
        }
    )
    name_pattern_boost_applied: bool = False


def discover_service_candidates(root_path: Path) -> list[ServiceDiscoveryCandidate]:
    accumulators: dict[str, _CandidateAccumulator] = {}

    for file_path in sorted(root_path.rglob("*")):
        if not file_path.is_file() or _is_ignored(file_path):
            continue

        candidate_path = _candidate_path_for_file(root_path, file_path)
        candidate = _candidate_for_path(accumulators, root_path, candidate_path)

        if file_path.name in _MANIFEST_WEIGHTS:
            _add_signal(
                candidate,
                _MANIFEST_WEIGHTS[file_path.name],
                "manifest_matches",
                f"Found service manifest `{file_path.name}`.",
                manifest=file_path.name,
            )
            inferred = _LANGUAGE_BY_FILENAME.get(file_path.name)
            if inferred:
                candidate.language_votes[inferred] = candidate.language_votes.get(inferred, 0) + 2

        if file_path.name in _ENTRYPOINT_WEIGHTS:
            _add_signal(
                candidate,
                _ENTRYPOINT_WEIGHTS[file_path.name],
                "entrypoint_matches",
                f"Found likely service entrypoint `{file_path.name}`.",
                entrypoint=file_path.name,
            )

        inferred_by_suffix = _LANGUAGE_BY_SUFFIX.get(file_path.suffix.lower())
        if inferred_by_suffix:
            candidate.language_votes[inferred_by_suffix] = candidate.language_votes.get(inferred_by_suffix, 0) + 1

        _add_content_signals(root_path, file_path, candidate, accumulators)

        if not candidate.name_pattern_boost_applied and _looks_like_service_directory(file_path.parent.name):
            _add_signal(
                candidate,
                0.08,
                "name_pattern_matches",
                "Directory name matches a common microservice naming pattern.",
            )
            candidate.name_pattern_boost_applied = True

    discovered = [
        _materialize_candidate(candidate)
        for candidate in accumulators.values()
        if candidate.score >= _MIN_CONFIDENCE
    ]
    return sorted(discovered, key=lambda item: (-item.confidence, item.relative_path))


def _candidate_for_path(
    accumulators: dict[str, _CandidateAccumulator], root_path: Path, path: Path
) -> _CandidateAccumulator:
    relative_parent = path.relative_to(root_path)
    relative_path = "." if relative_parent == Path(".") else relative_parent.as_posix()
    absolute_path = str(path.resolve())
    service_name = root_path.name if relative_path == "." else path.name
    return accumulators.setdefault(
        relative_path,
        _CandidateAccumulator(
            relative_path=relative_path,
            absolute_path=absolute_path,
            service_name=service_name,
        ),
    )


def _candidate_path_for_file(root_path: Path, file_path: Path) -> Path:
    if file_path.name not in _ENTRYPOINT_WEIGHTS and not _is_nested_deployment_manifest(file_path):
        return file_path.parent
    for parent in [file_path.parent, *file_path.parents]:
        if parent == root_path.parent:
            break
        if parent == root_path:
            return file_path.parent
        if any((parent / marker).exists() for marker in _SERVICE_ROOT_MARKERS):
            return parent
    return file_path.parent


def _is_nested_deployment_manifest(file_path: Path) -> bool:
    if file_path.suffix.lower() not in {".yml", ".yaml"}:
        return False
    return any(part.lower() in {"k8s", "kubernetes", "manifests", "deployments"} for part in file_path.parts)


def _add_signal(
    candidate: _CandidateAccumulator,
    score: float,
    signal: str,
    reason: str,
    *,
    manifest: str | None = None,
    entrypoint: str | None = None,
) -> None:
    candidate.score += score
    candidate.signal_counts[signal] = candidate.signal_counts.get(signal, 0) + 1
    candidate.reasons.append(reason)
    if manifest:
        candidate.manifests.append(manifest)
    if entrypoint:
        candidate.entrypoints.append(entrypoint)


def _add_content_signals(
    root_path: Path,
    file_path: Path,
    candidate: _CandidateAccumulator,
    accumulators: dict[str, _CandidateAccumulator],
) -> None:
    if not _is_small_text_file(file_path):
        return
    try:
        content = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return

    lowered_name = file_path.name.lower()
    lowered_content = content.lower()

    if lowered_name in {"docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"}:
        for context in _docker_compose_service_contexts(root_path, file_path, content):
            compose_candidate = _candidate_for_path(accumulators, root_path, context)
            _add_signal(
                compose_candidate,
                0.30,
                "docker_compose_matches",
                f"Docker Compose references this directory as a service build context from `{file_path.name}`.",
                manifest=file_path.name,
            )

    if file_path.suffix.lower() in {".yml", ".yaml"} and _looks_like_kubernetes_manifest(lowered_content):
        _add_signal(
            candidate,
            0.22,
            "kubernetes_matches",
            "Kubernetes manifest evidence references an app, service, deployment, or container.",
            manifest=file_path.name,
        )

    if lowered_name == "package.json":
        package_signal = _package_framework_signal(lowered_content)
        if package_signal:
            language = "typescript" if "typescript" in lowered_content or "@nestjs/" in lowered_content else "javascript"
            candidate.language_votes[language] = candidate.language_votes.get(language, 0) + 3
            _add_signal(candidate, 0.28, "framework_matches", package_signal, manifest=file_path.name)

    if lowered_name == "pom.xml" and "spring-boot" in lowered_content:
        candidate.language_votes["java"] = candidate.language_votes.get("java", 0) + 3
        _add_signal(
            candidate,
            0.30,
            "framework_matches",
            "Maven `pom.xml` references Spring Boot application dependencies.",
            manifest=file_path.name,
        )

    if _looks_like_openapi_file(file_path, lowered_content):
        _add_signal(
            candidate,
            0.24,
            "openapi_matches",
            "OpenAPI/Swagger specification suggests this directory exposes service APIs.",
            manifest=file_path.name,
        )

    if _contains_service_port_config(lowered_content):
        _add_signal(
            candidate,
            0.10,
            "port_config_matches",
            "Configuration includes service port evidence.",
        )

    if _contains_environment_config(lowered_content):
        _add_signal(
            candidate,
            0.08,
            "environment_config_matches",
            "Configuration includes environment variable evidence.",
        )

    if _contains_database_config(lowered_content):
        _add_signal(
            candidate,
            0.10,
            "database_config_matches",
            "Configuration includes database connection evidence.",
        )


def _materialize_candidate(candidate: _CandidateAccumulator) -> ServiceDiscoveryCandidate:
    confidence = min(0.99, candidate.score + _category_bonus(candidate))
    reasons = _unique_preserving_order(candidate.reasons)
    language = _winning_language(candidate.language_votes)
    return ServiceDiscoveryCandidate(
        service_name=candidate.service_name,
        relative_path=candidate.relative_path,
        absolute_path=candidate.absolute_path,
        language=language,
        confidence=confidence,
        selected_by_default=confidence >= _DEFAULT_SELECTION_CONFIDENCE or (
            bool(candidate.manifests) and bool(candidate.entrypoints)
        ),
        reasons=reasons,
        manifests=sorted(set(candidate.manifests)),
        entrypoints=sorted(set(candidate.entrypoints)),
        signal_counts=dict(candidate.signal_counts),
    )


def _category_bonus(candidate: _CandidateAccumulator) -> float:
    signal_categories = sum(
        1 for count in candidate.signal_counts.values() if count > 0
    )
    if signal_categories >= 4:
        return 0.12
    if signal_categories >= 2:
        return 0.05
    return 0.0


def _winning_language(language_votes: dict[str, int]) -> str:
    if not language_votes:
        return "unknown"
    return sorted(language_votes.items(), key=lambda item: (-item[1], item[0]))[0][0]


def _looks_like_service_directory(name: str) -> bool:
    lowered = name.lower()
    return lowered.endswith("-service") or lowered.endswith("-svc") or lowered.endswith("service") or lowered.endswith("api")


def _docker_compose_service_contexts(root_path: Path, compose_file: Path, content: str) -> list[Path]:
    contexts: list[Path] = []
    lines = content.splitlines()
    for index, line in enumerate(lines):
        service_match = re.match(r"^\s{2,}([A-Za-z0-9_.-]+):\s*$", line)
        if not service_match:
            continue
        service_name = service_match.group(1)
        if service_name in {"build", "image", "ports", "environment", "depends_on", "volumes"}:
            continue
        indent = len(line) - len(line.lstrip(" "))
        block_lines: list[str] = []
        for nested in lines[index + 1:]:
            if not nested.strip():
                continue
            nested_indent = len(nested) - len(nested.lstrip(" "))
            if nested_indent <= indent:
                break
            block_lines.append(nested)
        block = "\n".join(block_lines)
        context = _compose_context_from_block(block)
        if context is None:
            candidate = root_path / service_name
        else:
            candidate = compose_file.parent / context
        resolved = candidate.resolve()
        try:
            resolved.relative_to(root_path.resolve())
        except ValueError:
            continue
        if resolved.exists() and resolved.is_dir():
            contexts.append(resolved)
    return contexts


def _compose_context_from_block(block: str) -> Path | None:
    for pattern in [
        r"context:[^\S\n]*['\"]?([^'\"\n#]+)",
        r"build:[^\S\n]*['\"]?([^'\"\n#]+)",
    ]:
        match = re.search(pattern, block)
        if match:
            value = match.group(1).strip()
            if value and not value.startswith("{"):
                return Path(value)
    return None


def _looks_like_kubernetes_manifest(content: str) -> bool:
    return (
        "apiversion:" in content
        and "kind:" in content
        and any(kind in content for kind in ["deployment", "service", "statefulset", "pod"])
    )


def _package_framework_signal(content: str) -> str | None:
    if "@nestjs/" in content:
        return "`package.json` references NestJS service framework dependencies."
    if '"express"' in content or "'express'" in content:
        return "`package.json` references Express service framework dependencies."
    if '"fastify"' in content or "'fastify'" in content:
        return "`package.json` references Fastify service framework dependencies."
    return None


def _looks_like_openapi_file(file_path: Path, content: str) -> bool:
    lowered_name = file_path.name.lower()
    if lowered_name.startswith("openapi") or lowered_name.startswith("swagger"):
        return True
    return "openapi:" in content or '"openapi"' in content or "swagger:" in content or '"swagger"' in content


def _contains_service_port_config(content: str) -> bool:
    return bool(re.search(r"\b(server\.port|containerport|targetport|port)\b\s*[:=]", content))


def _contains_environment_config(content: str) -> bool:
    return bool(re.search(r"\b(environment|env|envfrom)\b\s*:", content)) or bool(
        re.search(r"^[A-Z][A-Z0-9_]{2,}\s*=", content, re.MULTILINE)
    )


def _contains_database_config(content: str) -> bool:
    return any(token in content for token in ["postgres://", "postgresql://", "mysql://", "mongodb://", "redis://", "jdbc:"])


def _is_small_text_file(file_path: Path) -> bool:
    if file_path.suffix.lower() not in {".json", ".xml", ".yml", ".yaml", ".properties", ".env"} and file_path.name not in {
        "package.json",
        "pom.xml",
        "Dockerfile",
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yml",
        "compose.yaml",
    }:
        return False
    try:
        return file_path.stat().st_size <= 512 * 1024
    except OSError:
        return False


def _unique_preserving_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered


def _is_ignored(file_path: Path) -> bool:
    ignored = {".git", "__pycache__", "node_modules", ".venv", "venv", "dist", "build"}
    return any(part in ignored for part in file_path.parts)
