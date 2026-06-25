from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from mesa.models import ServiceDiscoveryCandidate

_MANIFEST_WEIGHTS = {
    "pyproject.toml": 0.34,
    "requirements.txt": 0.28,
    "package.json": 0.34,
    "pom.xml": 0.36,
    "Dockerfile": 0.22,
    "docker-compose.yml": 0.14,
    "docker-compose.yaml": 0.14,
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
    "Application.java": 0.38,
    "App.java": 0.32,
}

_LANGUAGE_BY_FILENAME = {
    "pyproject.toml": "python",
    "requirements.txt": "python",
    "package.json": "typescript",
    "pom.xml": "java",
}

_LANGUAGE_BY_SUFFIX = {
    ".py": "python",
    ".java": "java",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
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
        }
    )
    name_pattern_boost_applied: bool = False


def discover_service_candidates(root_path: Path) -> list[ServiceDiscoveryCandidate]:
    accumulators: dict[str, _CandidateAccumulator] = {}

    for file_path in sorted(root_path.rglob("*")):
        if not file_path.is_file() or _is_ignored(file_path):
            continue

        relative_parent = file_path.parent.relative_to(root_path)
        relative_path = "." if relative_parent == Path(".") else relative_parent.as_posix()
        absolute_path = str(file_path.parent.resolve())
        service_name = root_path.name if relative_path == "." else file_path.parent.name

        candidate = accumulators.setdefault(
            relative_path,
            _CandidateAccumulator(
                relative_path=relative_path,
                absolute_path=absolute_path,
                service_name=service_name,
            ),
        )

        if file_path.name in _MANIFEST_WEIGHTS:
            candidate.score += _MANIFEST_WEIGHTS[file_path.name]
            candidate.manifests.append(file_path.name)
            candidate.signal_counts["manifest_matches"] += 1
            candidate.reasons.append(f"Found service manifest `{file_path.name}`.")
            inferred = _LANGUAGE_BY_FILENAME.get(file_path.name)
            if inferred:
                candidate.language_votes[inferred] = candidate.language_votes.get(inferred, 0) + 2

        if file_path.name in _ENTRYPOINT_WEIGHTS:
            candidate.score += _ENTRYPOINT_WEIGHTS[file_path.name]
            candidate.entrypoints.append(file_path.name)
            candidate.signal_counts["entrypoint_matches"] += 1
            candidate.reasons.append(f"Found likely service entrypoint `{file_path.name}`.")

        inferred_by_suffix = _LANGUAGE_BY_SUFFIX.get(file_path.suffix.lower())
        if inferred_by_suffix:
            candidate.language_votes[inferred_by_suffix] = candidate.language_votes.get(inferred_by_suffix, 0) + 1

        if not candidate.name_pattern_boost_applied and _looks_like_service_directory(file_path.parent.name):
            candidate.score += 0.08
            candidate.signal_counts["name_pattern_matches"] += 1
            candidate.name_pattern_boost_applied = True
            candidate.reasons.append("Directory name matches a common microservice naming pattern.")

    discovered = [
        _materialize_candidate(candidate)
        for candidate in accumulators.values()
        if candidate.score >= _MIN_CONFIDENCE
    ]
    return sorted(discovered, key=lambda item: (-item.confidence, item.relative_path))


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
    categories = int(bool(candidate.manifests)) + int(bool(candidate.entrypoints))
    return 0.05 if categories >= 2 else 0.0


def _winning_language(language_votes: dict[str, int]) -> str:
    if not language_votes:
        return "unknown"
    return sorted(language_votes.items(), key=lambda item: (-item[1], item[0]))[0][0]


def _looks_like_service_directory(name: str) -> bool:
    lowered = name.lower()
    return lowered.endswith("-service") or lowered.endswith("-svc") or lowered.endswith("service") or lowered.endswith("api")


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
