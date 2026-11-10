"""The optional `.mesa.yml` configuration file.

Example::

    services:
      include: ["services/*"]        # default: automatic discovery
      exclude: ["legacy/**"]         # added to the default excludes
    gate:
      mode: new-only                 # or "absolute"
      max_health_drop: 5.0
      fail_on_new_severity: HIGH
      minimum_health_score: 75       # absolute mode only
      maximum_critical_findings: 0   # absolute mode only
    chatty_threshold: 3
    policies: .mesa/policies.yml     # optional governance rules

Unknown keys are errors, so a typo such as `max_heath_drop` is reported rather
than silently ignored. Relative paths (`policies`) are relative to the folder
that contains the config file.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field, PrivateAttr, ValidationError, field_validator

from mesa.discovery.service_candidates import DEFAULT_DISCOVERY_EXCLUDES
from mesa.models import ArchitectureGateMode, ArchitectureGateThresholds, Severity

DEFAULT_CONFIG_NAME = ".mesa.yml"


class ConfigError(ValueError):
    """The configuration file is missing, unreadable or invalid."""


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ServicesConfig(_Strict):
    include: list[str] = Field(default_factory=list)
    exclude: list[str] = Field(default_factory=list)
    # Skip tests, fixtures, examples, docs, ... (DEFAULT_DISCOVERY_EXCLUDES).
    default_excludes: bool = True

    def all_excludes(self) -> list[str]:
        defaults = list(DEFAULT_DISCOVERY_EXCLUDES) if self.default_excludes else []
        return defaults + list(self.exclude)


class GateConfig(_Strict):
    mode: ArchitectureGateMode = ArchitectureGateMode.NEW_ONLY
    max_health_drop: float = Field(default=5.0, ge=0.0, le=100.0)
    fail_on_new_severity: Severity = Severity.HIGH
    minimum_health_score: float | None = Field(default=None, ge=0.0, le=100.0)
    maximum_critical_findings: int = Field(default=0, ge=0)

    @field_validator("fail_on_new_severity", mode="before")
    @classmethod
    def _upper_severity(cls, value: Any) -> Any:
        return value.upper() if isinstance(value, str) else value

    def thresholds(self, mode: ArchitectureGateMode | None = None) -> ArchitectureGateThresholds:
        values: dict[str, Any] = {
            "mode": mode or self.mode,
            "max_health_drop": self.max_health_drop,
            "fail_on_new_severity": self.fail_on_new_severity,
            "maximum_critical_findings": self.maximum_critical_findings,
        }
        if self.minimum_health_score is not None:
            values["minimum_health_score"] = self.minimum_health_score
        return ArchitectureGateThresholds(**values)


class MesaConfig(_Strict):
    services: ServicesConfig = Field(default_factory=ServicesConfig)
    gate: GateConfig = Field(default_factory=GateConfig)
    chatty_threshold: int = Field(default=3, ge=1)
    policies: str | None = None
    # Folder the config file was read from; relative paths resolve against it.
    _base_dir: Path | None = PrivateAttr(default=None)

    @property
    def base_dir(self) -> Path | None:
        return self._base_dir

    def policies_path(self) -> Path | None:
        if not self.policies:
            return None
        path = Path(self.policies)
        if not path.is_absolute() and self.base_dir is not None:
            path = self.base_dir / path
        return path


def load_config(path: Path | None, *, default_dir: Path | None = None) -> MesaConfig:
    """Read a config file.

    With `path=None`, `.mesa.yml` in `default_dir` is used if it exists and the
    defaults otherwise. A path given explicitly must exist.
    """
    if path is None:
        candidate = (default_dir or Path(".")) / DEFAULT_CONFIG_NAME
        if not candidate.is_file():
            defaults = MesaConfig()
            defaults._base_dir = default_dir
            return defaults
        path = candidate
    elif not path.is_file():
        raise ConfigError(f"Config file not found: {path}")

    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise ConfigError(f"Could not read {path}: {error}") from error
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise ConfigError(f"{path}: expected a mapping of settings at the top level.")
    try:
        config = MesaConfig.model_validate(raw)
    except ValidationError as error:
        raise ConfigError(_describe(path, error)) from error
    config._base_dir = path.parent
    return config


def _describe(path: Path, error: ValidationError) -> str:
    lines = [f"Invalid settings in {path}:"]
    for item in error.errors():
        where = ".".join(str(part) for part in item["loc"]) or "(top level)"
        message = "unknown setting" if item["type"] == "extra_forbidden" else item["msg"]
        lines.append(f"  {where}: {message}")
    return "\n".join(lines)
