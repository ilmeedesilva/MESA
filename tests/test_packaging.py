"""The core install stays small and the package metadata stays consistent."""

import subprocess
import sys
from importlib import metadata

import pytest

import mesa
from mesa.optional import MissingDependencyError, require

OPTIONAL = ["fastapi", "uvicorn", "neo4j", "psycopg", "anthropic", "httpx"]


@pytest.mark.parametrize("module", ["mesa.cli", "mesa.ci", "mesa.scan", "mesa.reporting"])
def test_command_line_modules_do_not_import_optional_packages(module: str) -> None:
    # A fresh interpreter, so modules imported by other tests don't count.
    code = f"import sys, {module}\nprint(','.join(m for m in {OPTIONAL!r} if m in sys.modules))"
    loaded = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True, check=True
    ).stdout.strip()

    assert loaded == ""


def test_version_has_a_single_source() -> None:
    assert metadata.version("mesa-analyzer") == mesa.__version__


def test_both_command_names_are_installed() -> None:
    scripts = {
        entry.name: entry.value
        for entry in metadata.entry_points(group="console_scripts")
        if entry.value.startswith("mesa.")
    }

    assert scripts == {"mesa": "mesa.cli:app", "mesa-analyzer": "mesa.cli:app"}


def test_core_dependencies_exclude_the_extras() -> None:
    requirements = metadata.requires("mesa-analyzer") or []
    core = [r for r in requirements if "extra ==" not in r]

    assert sorted(r.split(">")[0].split("[")[0] for r in core) == [
        "networkx",
        "pydantic",
        "pyyaml",
        "rich",
        "typer",
    ]


def test_missing_optional_package_names_the_extra(monkeypatch) -> None:
    import importlib

    def fail(name: str):
        raise ImportError(name)

    monkeypatch.setattr(importlib, "import_module", fail)

    with pytest.raises(MissingDependencyError, match=r'pip install "mesa-analyzer\[ai\]"'):
        require("anthropic")
