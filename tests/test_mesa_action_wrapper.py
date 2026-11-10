"""The Marketplace wrapper (packaging/mesa-action/action.yml) must behave like action.yml.

The wrapper is copied into the public mesa-action repository at release. It may differ from the
main Action only in how MESA is installed (a pinned release from PyPI instead of the code next
to it). Everything a user sees or relies on - inputs, outputs and every other step - must be
the same, so a change to one file without the other fails here.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "action.yml"
WRAPPER = ROOT / "packaging" / "mesa-action" / "action.yml"
INSTALL_STEP = "Install MESA"


def _load(path: Path) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _steps_except_install(action: dict[str, Any]) -> list[dict[str, Any]]:
    return [step for step in action["runs"]["steps"] if step.get("name") != INSTALL_STEP]


def _install_step(action: dict[str, Any]) -> dict[str, Any]:
    (step,) = [step for step in action["runs"]["steps"] if step.get("name") == INSTALL_STEP]
    return step


def test_inputs_and_outputs_match() -> None:
    main, wrapper = _load(MAIN), _load(WRAPPER)
    assert wrapper["inputs"] == main["inputs"]
    assert wrapper["outputs"] == main["outputs"]


def test_name_description_and_branding_match() -> None:
    main, wrapper = _load(MAIN), _load(WRAPPER)
    for key in ("name", "description", "branding"):
        assert wrapper[key] == main[key], key


def test_every_step_except_install_matches() -> None:
    main, wrapper = _load(MAIN), _load(WRAPPER)
    assert wrapper["runs"]["using"] == main["runs"]["using"] == "composite"
    assert _steps_except_install(wrapper) == _steps_except_install(main)
    # The install step is in the same place in both.
    names = [step.get("name") for step in main["runs"]["steps"]]
    assert [step.get("name") for step in wrapper["runs"]["steps"]] == names


def test_wrapper_installs_one_pinned_release_from_pypi() -> None:
    step = _install_step(_load(WRAPPER))
    version = step["env"]["MESA_VERSION"]
    # Before the release this is a placeholder; afterwards an exact version such as 1.0.0.
    assert version == "__MESA_VERSION__" or re.fullmatch(r"\d+\.\d+\.\d+", version), version
    assert '"mesa-analyzer==$MESA_VERSION"' in step["run"]
    assert "ACTION_PATH" not in step["run"]


def test_wrapper_folder_has_no_license_or_workflows_yet() -> None:
    # The Marketplace needs exactly one action.yml at the root and no workflow files. The
    # LICENSE is added on release day (after 5 January 2027), not before.
    folder = WRAPPER.parent
    assert sorted(path.name for path in folder.iterdir()) == ["README.md", "action.yml"]
