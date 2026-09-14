from __future__ import annotations

import os
import shutil
import tarfile
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from tempfile import gettempdir
from urllib.parse import urlparse
from urllib.request import urlopen
from uuid import uuid4

from mesa.discovery import discover_service_candidates
from mesa.models import RepoScanPreview, RepoScanPreviewRequest, RepoScanRunRequest, RepoSourceMetadata

_MANIFEST_FILENAMES = {
    "pyproject.toml",
    "requirements.txt",
    "package.json",
    "pom.xml",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml",
    "openapi.yaml",
    "openapi.yml",
    "openapi.json",
    "swagger.yaml",
    "swagger.yml",
    "swagger.json",
}
_ARCHIVE_SUFFIXES = {".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz"}
_MAX_PREVIEW_FILES = 5000
_MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024
_MAX_EXTRACTED_BYTES = 1024 * 1024 * 1024
_MAX_EXTRACTED_FILES = 20000
_DEFAULT_CACHE_TTL_HOURS = 24


class RepositoryPreparationError(ValueError):
    """Raised when a repository source cannot be prepared safely."""


@dataclass(slots=True)
class PreparedRepository:
    root_path: Path
    metadata: RepoSourceMetadata
    warnings: list[str]


def prepare_repository(request: RepoScanPreviewRequest | RepoScanRunRequest) -> PreparedRepository:
    location = request.location.strip()
    if not location:
        raise RepositoryPreparationError("Repository location is required")

    if request.source_type == "LOCAL_PATH":
        return _prepare_local_directory(location, request.subdirectory)
    if request.source_type == "ARCHIVE_PATH":
        return _prepare_archive_path(location, request.subdirectory)
    if request.source_type == "GITHUB_URL":
        return _prepare_github_url(location, request.ref, request.subdirectory)

    raise RepositoryPreparationError(f"Unsupported repository source type: {request.source_type}")


def preview_repository(request: RepoScanPreviewRequest) -> RepoScanPreview:
    prepared = prepare_repository(request)
    manifest_counts, top_level_entries, file_count = _summarize_repository(prepared.root_path)
    discovered_services = discover_service_candidates(prepared.root_path)
    candidate_paths = [candidate.relative_path for candidate in discovered_services]
    warnings = list(prepared.warnings)
    if file_count >= _MAX_PREVIEW_FILES:
        warnings.append(
            f"Preview file counting stopped at {_MAX_PREVIEW_FILES} files. Full repository may contain more files."
        )
    if not candidate_paths:
        warnings.append("No likely service roots were detected in preview.")
    warnings.extend(_service_discovery_warnings(discovered_services))

    return RepoScanPreview(
        source=prepared.metadata,
        root_path=str(prepared.root_path),
        top_level_entries=top_level_entries,
        file_count=file_count,
        manifest_counts=manifest_counts,
        candidate_service_paths=candidate_paths,
        discovered_services=discovered_services,
        warnings=warnings,
    )


def _service_discovery_warnings(discovered_services) -> list[str]:
    warnings: list[str] = []
    if not discovered_services:
        return warnings
    unknown_languages = [
        candidate.relative_path
        for candidate in discovered_services
        if candidate.language in {"unknown", "api-spec"}
    ]
    if unknown_languages:
        warnings.append(
            "Some discovered services have unclear implementation language: "
            + ", ".join(unknown_languages[:5])
            + ("." if len(unknown_languages) <= 5 else ", ...")
        )
    low_confidence = [
        candidate.relative_path
        for candidate in discovered_services
        if candidate.confidence < 0.45
    ]
    if low_confidence:
        warnings.append(
            "Some service candidates are low-confidence and should be reviewed before scanning: "
            + ", ".join(low_confidence[:5])
            + ("." if len(low_confidence) <= 5 else ", ...")
        )
    return warnings


def resolve_service_paths(prepared: PreparedRepository, request: RepoScanRunRequest) -> list[str]:
    if request.service_paths:
        return [str(_resolve_relative_path(prepared.root_path, raw_path)) for raw_path in request.service_paths]

    candidates = discover_service_candidates(prepared.root_path)
    candidate_paths = [
        candidate.relative_path
        for candidate in candidates
        if candidate.selected_by_default
    ] or [candidate.relative_path for candidate in candidates]
    if not candidate_paths:
        raise RepositoryPreparationError(
            "No service paths were provided and no likely service roots were detected automatically."
        )
    return [str(_resolve_relative_path(prepared.root_path, path)) for path in candidate_paths]


def _prepare_local_directory(location: str, subdirectory: str | None) -> PreparedRepository:
    root_path = Path(location).expanduser().resolve()
    if not root_path.exists():
        raise RepositoryPreparationError(f"Local repository path does not exist: {location}")
    if not root_path.is_dir():
        raise RepositoryPreparationError(f"Local repository path is not a directory: {location}")

    root_path = _apply_subdirectory(root_path, subdirectory)
    return PreparedRepository(
        root_path=root_path,
        metadata=RepoSourceMetadata(
            source_type="LOCAL_PATH",
            source_label=root_path.name,
            source_path=str(root_path),
        ),
        warnings=[],
    )


def _prepare_archive_path(location: str, subdirectory: str | None) -> PreparedRepository:
    archive_path = Path(location).expanduser().resolve()
    if not archive_path.exists():
        raise RepositoryPreparationError(f"Archive path does not exist: {location}")
    if not archive_path.is_file():
        raise RepositoryPreparationError(f"Archive path is not a file: {location}")
    if archive_path.suffix.lower() not in _ARCHIVE_SUFFIXES and not archive_path.name.endswith(".tar.gz"):
        raise RepositoryPreparationError("Archive path must point to a zip or tar archive")

    workspace_root = _workspace_cache_root() / f"{archive_path.stem}-{uuid4().hex[:8]}"
    workspace_root.mkdir(parents=True, exist_ok=False)
    _extract_archive(archive_path, workspace_root)
    root_path = _normalize_extracted_root(workspace_root)
    root_path = _apply_subdirectory(root_path, subdirectory)

    return PreparedRepository(
        root_path=root_path,
        metadata=RepoSourceMetadata(
            source_type="ARCHIVE_PATH",
            source_label=archive_path.name,
            source_path=str(archive_path),
            workspace_path=str(root_path),
        ),
        warnings=[
            "Archive source was extracted into a managed workspace so findings can retain stable file paths."
        ],
    )


def _prepare_github_url(location: str, ref: str | None, subdirectory: str | None) -> PreparedRepository:
    owner, repo = _parse_github_repo(location)
    download_ref = ref or "HEAD"
    workspace_root = _workspace_cache_root() / f"{owner}-{repo}-{uuid4().hex[:8]}"
    workspace_root.mkdir(parents=True, exist_ok=False)
    archive_path = workspace_root / "repo.zip"
    _download_github_archive(owner, repo, download_ref, archive_path)
    _extract_archive(archive_path, workspace_root)
    root_path = _normalize_extracted_root(workspace_root)
    root_path = _apply_subdirectory(root_path, subdirectory)

    warnings = []
    if download_ref == "HEAD":
        warnings.append("Repository was fetched with HEAD; commit SHA is not yet persisted in the current phase.")

    return PreparedRepository(
        root_path=root_path,
        metadata=RepoSourceMetadata(
            source_type="GITHUB_URL",
            source_label=f"{owner}/{repo}",
            repo_url=f"https://github.com/{owner}/{repo}",
            repo_provider="github",
            repo_ref=download_ref,
            workspace_path=str(root_path),
        ),
        warnings=warnings,
    )


def _workspace_cache_root() -> Path:
    configured = os.getenv("MESA_REPO_CACHE_ROOT")
    if configured:
        root = Path(configured).expanduser().resolve()
    else:
        root = Path(gettempdir()).resolve() / "mesa-repo-cache"
    root.mkdir(parents=True, exist_ok=True)
    _sweep_stale_workspaces(root)
    return root


def _sweep_stale_workspaces(root: Path) -> None:
    ttl_hours = float(os.getenv("MESA_REPO_CACHE_TTL_HOURS", str(_DEFAULT_CACHE_TTL_HOURS)))
    cutoff = time.time() - (ttl_hours * 3600)
    for entry in root.iterdir():
        try:
            if entry.is_dir() and entry.stat().st_mtime < cutoff:
                shutil.rmtree(entry, ignore_errors=True)
        except OSError:
            continue


def _parse_github_repo(location: str) -> tuple[str, str]:
    parsed = urlparse(location)
    if parsed.scheme not in {"http", "https"} or parsed.netloc.lower() != "github.com":
        raise RepositoryPreparationError("Only https://github.com/<owner>/<repo> URLs are supported")
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 2:
        raise RepositoryPreparationError("GitHub URL must include owner and repository name")
    return parts[0], parts[1].removesuffix(".git")


def _download_github_archive(owner: str, repo: str, ref: str, destination: Path) -> None:
    archive_url = f"https://codeload.github.com/{owner}/{repo}/zip/{ref}"
    total = 0
    try:
        with urlopen(archive_url, timeout=20) as response, destination.open("wb") as output:
            while True:
                chunk = response.read(64 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > _MAX_DOWNLOAD_BYTES:
                    raise RepositoryPreparationError(
                        f"Remote repository download exceeded {_MAX_DOWNLOAD_BYTES // (1024 * 1024)} MB limit"
                    )
                output.write(chunk)
    except RepositoryPreparationError:
        raise
    except Exception as error:  # pragma: no cover
        raise RepositoryPreparationError(f"Could not download GitHub repository archive: {error}") from error


def _extract_archive(archive_path: Path, destination: Path) -> None:
    try:
        if zipfile.is_zipfile(archive_path):
            with zipfile.ZipFile(archive_path) as archive:
                members = archive.infolist()
                _check_extraction_limits(
                    member_count=len(members),
                    total_bytes=sum(member.file_size for member in members),
                )
                for member in members:
                    member_path = destination / member.filename
                    _ensure_within_destination(destination, member_path)
                archive.extractall(destination)
            return
        if tarfile.is_tarfile(archive_path):
            with tarfile.open(archive_path) as archive:
                members = archive.getmembers()
                _check_extraction_limits(
                    member_count=len(members),
                    total_bytes=sum(member.size for member in members),
                )
                for member in members:
                    if member.issym() or member.islnk() or member.isdev():
                        raise RepositoryPreparationError(
                            f"Archive contains an unsupported member type: {member.name}"
                        )
                    member_path = destination / member.name
                    _ensure_within_destination(destination, member_path)
                archive.extractall(destination)
            return
    except RepositoryPreparationError:
        raise
    except Exception as error:
        raise RepositoryPreparationError(f"Could not extract archive: {error}") from error
    raise RepositoryPreparationError("Unsupported archive format")


def _check_extraction_limits(*, member_count: int, total_bytes: int) -> None:
    if member_count > _MAX_EXTRACTED_FILES:
        raise RepositoryPreparationError(
            f"Archive contains {member_count} files, exceeding the {_MAX_EXTRACTED_FILES} file limit"
        )
    if total_bytes > _MAX_EXTRACTED_BYTES:
        raise RepositoryPreparationError(
            f"Archive would extract to {total_bytes // (1024 * 1024)} MB, "
            f"exceeding the {_MAX_EXTRACTED_BYTES // (1024 * 1024)} MB limit"
        )


def _normalize_extracted_root(workspace_root: Path) -> Path:
    directories = [child for child in workspace_root.iterdir() if child.is_dir() and child.name != "__MACOSX"]
    if len(directories) == 1:
        return directories[0]
    return workspace_root


def _apply_subdirectory(root_path: Path, subdirectory: str | None) -> Path:
    if not subdirectory:
        return root_path
    resolved = _resolve_relative_path(root_path, subdirectory)
    if not resolved.is_dir():
        raise RepositoryPreparationError(f"Requested subdirectory is not a directory: {subdirectory}")
    return resolved


def _resolve_relative_path(root_path: Path, raw_path: str) -> Path:
    candidate = Path(raw_path)
    resolved = candidate.resolve() if candidate.is_absolute() else (root_path / candidate).resolve()

    try:
        resolved.relative_to(root_path)
    except ValueError as error:
        raise RepositoryPreparationError(f"Path escapes repository root: {raw_path}") from error

    if not resolved.exists():
        raise RepositoryPreparationError(f"Path does not exist inside repository: {raw_path}")
    if not resolved.is_dir():
        raise RepositoryPreparationError(f"Path is not a directory inside repository: {raw_path}")
    return resolved


def _summarize_repository(root_path: Path) -> tuple[dict[str, int], list[str], int]:
    manifest_counts = {manifest: 0 for manifest in sorted(_MANIFEST_FILENAMES)}
    top_level_entries = sorted(child.name for child in root_path.iterdir())[:40]
    file_count = 0

    for file_path in sorted(root_path.rglob("*")):
        if not file_path.is_file() or _is_ignored(file_path):
            continue
        file_count += 1
        if file_path.name in manifest_counts:
            manifest_counts[file_path.name] += 1
        if file_count >= _MAX_PREVIEW_FILES:
            break

    return manifest_counts, top_level_entries, file_count


def _is_ignored(file_path: Path) -> bool:
    ignored = {".git", "__pycache__", "node_modules", ".venv", "venv", "dist", "build"}
    return any(part in ignored for part in file_path.parts)


def _ensure_within_destination(destination: Path, member_path: Path) -> None:
    resolved_destination = destination.resolve()
    resolved_member = member_path.resolve()
    try:
        resolved_member.relative_to(resolved_destination)
    except ValueError as error:
        raise RepositoryPreparationError("Archive contains a path that escapes the extraction directory") from error
