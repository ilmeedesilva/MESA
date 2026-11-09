import os
from pathlib import Path

import pytest

from mesa.analysis.extractor import extract_service_facts
from mesa.discovery import discover_service_candidates
from mesa.file_walk import iter_files

pytestmark = pytest.mark.skipif(os.name == "nt", reason="symlinks need extra rights on Windows")

SECRET_URL = "http://billing-service:8080/internal"


def _service_with_outside_links(tmp_path: Path) -> Path:
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "client.py").write_text(f'requests.get("{SECRET_URL}")\n', encoding="utf-8")
    service = tmp_path / "repo" / "order-service"
    service.mkdir(parents=True)
    (service / "app.py").write_text("print('hello')\n", encoding="utf-8")
    (service / "linked_client.py").symlink_to(outside / "client.py")
    (service / "linked_dir").symlink_to(outside, target_is_directory=True)
    return service


def test_symlinks_pointing_outside_the_service_are_not_read(tmp_path: Path) -> None:
    service = _service_with_outside_links(tmp_path)

    files = [path.relative_to(service).as_posix() for path in iter_files(service)]
    facts = extract_service_facts(service)

    assert files == ["app.py"]
    assert facts.calls == []
    assert facts.hard_coded_dependencies == []


def test_symlinks_inside_the_service_are_still_read(tmp_path: Path) -> None:
    service = tmp_path / "order-service"
    (service / "real").mkdir(parents=True)
    (service / "real" / "client.py").write_text(f'requests.get("{SECRET_URL}")\n', "utf-8")
    (service / "alias.py").symlink_to(service / "real" / "client.py")

    names = [path.name for path in iter_files(service)]

    assert names == ["alias.py", "client.py"]


def test_discovery_skips_symlinks_out_of_the_root(tmp_path: Path) -> None:
    outside = tmp_path / "outside" / "secret-service"
    outside.mkdir(parents=True)
    (outside / "package.json").write_text('{"dependencies": {"express": "4"}}', "utf-8")
    root = tmp_path / "repo"
    root.mkdir()
    (root / "secret-service").symlink_to(outside, target_is_directory=True)

    assert discover_service_candidates(root) == []


def test_ignored_folders_are_judged_below_the_root_only(tmp_path: Path) -> None:
    # A checkout that lives inside a folder called "build" must still be scanned.
    service = tmp_path / "build" / "order-service"
    service.mkdir(parents=True)
    (service / "app.py").write_text("print('hi')\n", "utf-8")
    (service / "node_modules").mkdir()
    (service / "node_modules" / "lib.js").write_text("x", "utf-8")

    assert [path.name for path in iter_files(service)] == ["app.py"]
