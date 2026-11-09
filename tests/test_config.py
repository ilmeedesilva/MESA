from pathlib import Path

import pytest

from mesa.config import ConfigError, load_config
from mesa.models import ArchitectureGateMode, Severity


def test_missing_default_config_means_defaults(tmp_path: Path) -> None:
    config = load_config(None, default_dir=tmp_path)

    assert config.gate.mode == ArchitectureGateMode.NEW_ONLY
    assert config.gate.fail_on_new_severity == Severity.HIGH
    assert config.gate.max_health_drop == 5.0
    assert "tests" in config.services.all_excludes()


def test_explicit_missing_config_is_an_error(tmp_path: Path) -> None:
    with pytest.raises(ConfigError, match="not found"):
        load_config(tmp_path / "nope.yml")


def test_full_config_is_read(tmp_path: Path) -> None:
    (tmp_path / ".mesa.yml").write_text(
        "services:\n"
        "  include: ['services/*']\n"
        "  exclude: ['legacy/**']\n"
        "  default_excludes: false\n"
        "gate:\n"
        "  mode: absolute\n"
        "  max_health_drop: 2.5\n"
        "  fail_on_new_severity: medium\n"
        "  minimum_health_score: 60\n"
        "chatty_threshold: 5\n"
        "policies: rules/policies.yml\n",
        encoding="utf-8",
    )

    config = load_config(None, default_dir=tmp_path)
    thresholds = config.gate.thresholds()

    assert config.services.all_excludes() == ["legacy/**"]
    assert thresholds.mode == ArchitectureGateMode.ABSOLUTE
    assert thresholds.fail_on_new_severity == Severity.MEDIUM
    assert thresholds.minimum_health_score == 60
    assert config.chatty_threshold == 5
    assert config.policies_path() == tmp_path / "rules" / "policies.yml"


def test_bad_config_lists_every_problem_by_name(tmp_path: Path) -> None:
    path = tmp_path / ".mesa.yml"
    path.write_text(
        "gate:\n  mode: strict\n  max_heath_drop: 3\nchatty_threshold: 0\n", encoding="utf-8"
    )

    with pytest.raises(ConfigError) as error:
        load_config(path)

    message = str(error.value)
    assert "gate.mode" in message
    assert "gate.max_heath_drop: unknown setting" in message
    assert "chatty_threshold" in message


@pytest.mark.parametrize("content", ["- a\n- b\n", "gate: [\n"])
def test_config_that_is_not_a_mapping_is_an_error(tmp_path: Path, content: str) -> None:
    path = tmp_path / ".mesa.yml"
    path.write_text(content, encoding="utf-8")

    with pytest.raises(ConfigError):
        load_config(path)
