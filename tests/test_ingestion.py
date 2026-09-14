import os
import tarfile
import time
from pathlib import Path
import zipfile

import pytest

from mesa.ingestion import repository as repository_module
from mesa.ingestion.repository import RepositoryPreparationError, prepare_repository
from mesa.models import RepoScanPreviewRequest, RepoSourceType


def _archive_request(archive_path: Path) -> RepoScanPreviewRequest:
    return RepoScanPreviewRequest(
        source_type=RepoSourceType.ARCHIVE_PATH, location=str(archive_path)
    )


def test_archive_extraction_rejects_oversized_content(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MESA_REPO_CACHE_ROOT", str(tmp_path / "cache"))
    monkeypatch.setattr(repository_module, "_MAX_EXTRACTED_BYTES", 10)

    archive_path = tmp_path / "big.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("service/app.py", "print('x')" * 10)

    with pytest.raises(RepositoryPreparationError, match="exceeding"):
        prepare_repository(_archive_request(archive_path))


def test_archive_extraction_rejects_too_many_files(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MESA_REPO_CACHE_ROOT", str(tmp_path / "cache"))
    monkeypatch.setattr(repository_module, "_MAX_EXTRACTED_FILES", 1)

    archive_path = tmp_path / "many.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("service/app.py", "print('a')")
        archive.writestr("service/util.py", "print('b')")

    with pytest.raises(RepositoryPreparationError, match="file limit"):
        prepare_repository(_archive_request(archive_path))


def test_tar_extraction_rejects_symlink_members(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MESA_REPO_CACHE_ROOT", str(tmp_path / "cache"))

    archive_path = tmp_path / "evil.tar"
    with tarfile.open(archive_path, "w") as archive:
        info = tarfile.TarInfo(name="service/escape")
        info.type = tarfile.SYMTYPE
        info.linkname = "/etc/passwd"
        archive.addfile(info)

    with pytest.raises(RepositoryPreparationError, match="unsupported member type"):
        prepare_repository(_archive_request(archive_path))


def test_stale_cache_workspace_is_swept(tmp_path, monkeypatch) -> None:
    cache_root = tmp_path / "cache"
    cache_root.mkdir()
    stale_dir = cache_root / "stale-workspace"
    stale_dir.mkdir()
    fresh_dir = cache_root / "fresh-workspace"
    fresh_dir.mkdir()

    old_time = time.time() - (48 * 3600)
    os.utime(stale_dir, (old_time, old_time))

    monkeypatch.setenv("MESA_REPO_CACHE_ROOT", str(cache_root))
    monkeypatch.setenv("MESA_REPO_CACHE_TTL_HOURS", "24")

    repository_module._workspace_cache_root()

    assert not stale_dir.exists()
    assert fresh_dir.exists()
