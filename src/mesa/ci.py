"""Compare a pull request with its base commit (`mesa ci`).

1. Scan the working tree (the PR head).
2. Check out the base commit into a temporary `git worktree` and scan it with
   the *same* configuration (the head's `.mesa.yml`), so the comparison is fair.
3. Compare the two scans with the gate (new-only mode by default).
4. Write head.json, base.json, gate.json, report.md (the pull request
   comment) and mesa.sarif (for code scanning) to the output folder and, on
   GitHub Actions, the job summary and step outputs.

Without a base commit (for example on a push to main) only the head is scanned
and the gate runs in absolute mode.

MESA only reads files: it never installs or runs the repository's code, so
this is safe for pull requests from forks.
"""

from __future__ import annotations

import contextlib
import json
import os
import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

from mesa import __version__
from mesa.analysis.fitness_gate import evaluate_architecture_gate
from mesa.config import MesaConfig
from mesa.models import (
    AnalysisResult,
    ArchitectureFitnessGateResult,
    ArchitectureGateMode,
    ArchitectureGateThresholds,
)
from mesa.reporting import LinkContext, render_annotations, render_markdown, render_sarif
from mesa.scan import scan_repository

# The job summary can be much longer than a pull request comment.
_STEP_SUMMARY_MAX_CHARS = 900_000


class CIError(RuntimeError):
    """`mesa ci` cannot run (not a git repository, unknown base commit, ...)."""


@dataclass
class CIResult:
    gate: ArchitectureFitnessGateResult
    head: AnalysisResult
    base: AnalysisResult | None
    out_dir: Path
    base_ref: str | None
    elapsed_seconds: float = 0.0
    links: LinkContext | None = None


def run_ci(
    *,
    path: Path,
    config: MesaConfig,
    thresholds: ArchitectureGateThresholds,
    out_dir: Path,
    base_ref: str | None = None,
    policy_path: Path | None = None,
    head_sha: str | None = None,
) -> CIResult:
    started = time.monotonic()
    path = path.resolve()
    repo_root = _git_toplevel(path)
    scan_subpath = path.relative_to(repo_root)
    policies = policy_path or config.policies_path()

    head = scan_repository(path, config, path_base=repo_root, policy_path=policies)
    base: AnalysisResult | None = None
    if base_ref:
        base_commit = _resolve_commit(repo_root, base_ref)
        with _worktree(repo_root, base_commit) as base_root:
            base_scan_root = base_root / scan_subpath
            if base_scan_root.is_dir():
                base = scan_repository(
                    base_scan_root, config, path_base=base_root, policy_path=policies
                )
            else:
                # The scanned folder is new in this pull request: nothing to compare.
                base = AnalysisResult(services=[], findings=[], graph={}, summary={})
    else:
        thresholds = thresholds.model_copy(update={"mode": ArchitectureGateMode.ABSOLUTE})

    gate = evaluate_architecture_gate(head, thresholds=thresholds, baseline=base)
    result = CIResult(
        gate=gate,
        head=head,
        base=base,
        out_dir=out_dir,
        base_ref=base_ref,
        elapsed_seconds=time.monotonic() - started,
        links=_github_links(repo_root, head_sha),
    )
    write_outputs(result)
    return result


def write_outputs(result: CIResult) -> None:
    out_dir = result.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "head.json").write_text(result.head.model_dump_json(indent=2), encoding="utf-8")
    if result.base is not None:
        (out_dir / "base.json").write_text(result.base.model_dump_json(indent=2), encoding="utf-8")
    (out_dir / "gate.json").write_text(result.gate.model_dump_json(indent=2), encoding="utf-8")
    (out_dir / "report.md").write_text(markdown_report(result), encoding="utf-8")
    sarif = render_sarif(
        result.head.findings,
        version=__version__,
        new_fingerprints=(
            {f.fingerprint for f in result.gate.new_findings} if result.gate.has_baseline else None
        ),
    )
    (out_dir / "mesa.sarif").write_text(json.dumps(sarif, indent=2), encoding="utf-8")

    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as handle:
            handle.write(markdown_report(result, max_chars=_STEP_SUMMARY_MAX_CHARS) + "\n")
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        gate = result.gate
        values = {
            "status": gate.status.value,
            "health-score": "" if gate.health_score is None else f"{gate.health_score:.2f}",
            "health-delta": "" if gate.health_delta is None else f"{gate.health_delta:.2f}",
            "new-findings": str(len(gate.new_findings)),
            "fixed-findings": str(len(gate.fixed_findings)),
            "report-json": str(out_dir / "gate.json"),
            "report-markdown": str(out_dir / "report.md"),
            "report-sarif": str(out_dir / "mesa.sarif"),
        }
        with open(github_output, "a", encoding="utf-8") as handle:
            for key, value in values.items():
                handle.write(f"{key}={value}\n")


def markdown_report(result: CIResult, *, max_chars: int | None = None) -> str:
    """The pull request comment (report.md)."""
    options = {} if max_chars is None else {"max_chars": max_chars}
    return render_markdown(
        result.gate,
        findings=result.head.findings,
        base_label=result.base_ref,
        links=result.links,
        version=__version__,
        elapsed_seconds=result.elapsed_seconds,
        **options,
    )


def annotation_lines(result: CIResult) -> list[str]:
    """Inline annotations: new findings, or every finding without a baseline."""
    findings = result.gate.new_findings if result.gate.has_baseline else result.head.findings
    return render_annotations(findings)


def render_summary(result: CIResult) -> str:
    """A short plain-text summary for the terminal."""
    gate = result.gate
    status = "PASSED" if gate.status.value == "passed" else "FAILED"
    lines = [f"## MESA architecture check: {status}", ""]
    if gate.has_baseline:
        lines.append(
            f"{len(gate.new_findings)} new, {len(gate.fixed_findings)} fixed, "
            f"{gate.unchanged_count} unchanged (compared with `{result.base_ref}`)."
        )
        if gate.health_before is not None and gate.health_after is not None:
            lines.append(
                f"Health score: {gate.health_before:.1f} -> {gate.health_after:.1f} "
                f"({gate.health_delta:+.1f})."
            )
    else:
        lines.append(
            f"{len(result.head.findings)} finding(s); no base commit, so fixed thresholds apply."
        )
        if gate.health_score is not None:
            lines.append(f"Health score: {gate.health_score:.1f}.")
    lines.append("")
    for rule in gate.rules:
        lines.append(f"- {'pass' if rule.passed else 'FAIL'}: {rule.message}")
    if gate.new_findings:
        lines += ["", "### New findings", ""]
        for finding in gate.new_findings:
            where = ""
            if finding.primary_location is not None:
                line = finding.primary_location.line_number
                where = f" (`{finding.primary_location.file_path}{f':{line}' if line else ''}`)"
            lines.append(
                f"- {finding.severity.value} {finding.type.value}: {finding.description}{where}"
            )
    lines += ["", f"MESA {__version__}. Static analysis only: no code was executed."]
    return "\n".join(lines)


def _github_links(repo_root: Path, head_sha: str | None) -> LinkContext | None:
    """Links to files on GitHub, when running in GitHub Actions."""
    server = os.environ.get("GITHUB_SERVER_URL")
    repository = os.environ.get("GITHUB_REPOSITORY")
    if not server or not repository:
        return None
    sha = head_sha or _git(repo_root, "rev-parse", "HEAD")
    return LinkContext(server_url=server, repository=repository, sha=sha)


def _git(repo_root: Path, *args: str) -> str:
    git = shutil.which("git")
    if git is None:
        raise CIError("git is not installed.")
    completed = subprocess.run(
        [git, "-C", str(repo_root), *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise CIError(f"git {' '.join(args)} failed: {completed.stderr.strip()}")
    return completed.stdout.strip()


def _git_toplevel(path: Path) -> Path:
    try:
        return Path(_git(path, "rev-parse", "--show-toplevel")).resolve()
    except CIError as error:
        raise CIError(f"{path} is not inside a git repository.") from error


def _resolve_commit(repo_root: Path, ref: str) -> str:
    if ref.startswith("-"):
        raise CIError(f"Invalid base ref: {ref}")
    try:
        return _git(repo_root, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}")
    except CIError as error:
        raise CIError(
            f"Base commit {ref} was not found. On GitHub Actions, check out with "
            "`fetch-depth: 0` so the base commit is available."
        ) from error


class _worktree:
    """A temporary detached worktree at `commit`, removed afterwards."""

    def __init__(self, repo_root: Path, commit: str) -> None:
        self.repo_root = repo_root
        self.commit = commit
        self.parent = Path(tempfile.mkdtemp(prefix="mesa-base-", dir=os.environ.get("RUNNER_TEMP")))
        self.path = self.parent / "base"

    def __enter__(self) -> Path:
        _git(self.repo_root, "worktree", "add", "--detach", str(self.path), self.commit)
        return self.path.resolve()

    def __exit__(self, *exc_info: object) -> None:
        with contextlib.suppress(CIError):
            _git(self.repo_root, "worktree", "remove", "--force", str(self.path))
        shutil.rmtree(self.parent, ignore_errors=True)
        with contextlib.suppress(CIError):
            _git(self.repo_root, "worktree", "prune")
