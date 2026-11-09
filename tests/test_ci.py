"""`mesa ci` on a real temporary git repository."""

import json
import shutil
import subprocess
from pathlib import Path

import pytest
from typer.testing import CliRunner

from mesa.cli import app

pytestmark = pytest.mark.skipif(shutil.which("git") is None, reason="git is not installed")

runner = CliRunner()
FIXED = Path(__file__).parents[1] / "demo-projects" / "myservice-fixed"

CYCLE_ORDER = """

import requests


@app.get("/orders/{order_id}/customer")
def order_customer(order_id: str):
    return requests.get("http://user-service:8080/users/1").json()
"""
CYCLE_USER = """

import requests


@app.get("/users/{user_id}/orders")
def user_orders(user_id: str):
    return requests.get("http://order-service:8080/orders/1").json()
"""


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-c", "user.name=MESA test", "-c", "user.email=test@example.com", *args],
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def _commit(repo: Path, message: str) -> None:
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", message)


@pytest.fixture()
def repo(tmp_path: Path) -> Path:
    repo = tmp_path / "shop"
    shutil.copytree(FIXED, repo)
    _git(repo, "init", "-q")
    _commit(repo, "base")
    return repo


def _add_cycle(repo: Path) -> None:
    with (repo / "order-service" / "app.py").open("a", encoding="utf-8") as handle:
        handle.write(CYCLE_ORDER)
    with (repo / "user-service" / "app.py").open("a", encoding="utf-8") as handle:
        handle.write(CYCLE_USER)
    _commit(repo, "add loyalty calls")


def _run(repo: Path, out: Path, *args: str, monkeypatch=None):
    if monkeypatch is not None:
        monkeypatch.chdir(repo)
    return runner.invoke(app, ["ci", "--path", str(repo), "--out-dir", str(out), *args])


def test_a_new_cycle_fails_with_exactly_the_new_findings(repo: Path, tmp_path: Path) -> None:
    _add_cycle(repo)
    out = tmp_path / "out"

    result = _run(repo, out, "--base-ref", "HEAD~1")

    assert result.exit_code == 1, result.output
    gate = json.loads((out / "gate.json").read_text(encoding="utf-8"))
    assert gate["status"] == "failed"
    assert sorted(f["type"] for f in gate["new_findings"]) == [
        "CYCLIC_DEPENDENCY",
        "HARD_CODED_SERVICE_DEPENDENCY",
        "HARD_CODED_SERVICE_DEPENDENCY",
    ]
    assert gate["fixed_findings"] == []
    locations = {f["primary_location"]["file_path"] for f in gate["new_findings"]}
    assert locations <= {"order-service/app.py", "user-service/app.py"}
    assert {p.name for p in out.iterdir()} == {
        "head.json",
        "base.json",
        "gate.json",
        "report.md",
        "mesa.sarif",
    }
    # The temporary base checkout is removed again.
    assert len(_git(repo, "worktree", "list").splitlines()) == 1


def test_a_harmless_change_passes(repo: Path, tmp_path: Path) -> None:
    _add_cycle(repo)
    (repo / "README.md").write_text("# Demo shop\n", encoding="utf-8")
    _commit(repo, "readme")

    result = _run(repo, tmp_path / "out", "--base-ref", "HEAD~1")

    assert result.exit_code == 0, result.output
    gate = json.loads((tmp_path / "out" / "gate.json").read_text(encoding="utf-8"))
    assert gate["new_findings"] == [] and gate["unchanged_count"] == 3


def test_a_fix_shows_up_as_fixed(repo: Path, tmp_path: Path) -> None:
    _add_cycle(repo)
    shutil.copy(FIXED / "user-service" / "app.py", repo / "user-service" / "app.py")
    _commit(repo, "replace the back-call")

    result = _run(repo, tmp_path / "out", "--base-ref", "HEAD~1")

    assert result.exit_code == 0, result.output
    gate = json.loads((tmp_path / "out" / "gate.json").read_text(encoding="utf-8"))
    assert {f["type"] for f in gate["fixed_findings"]} == {
        "CYCLIC_DEPENDENCY",
        "HARD_CODED_SERVICE_DEPENDENCY",
    }
    assert gate["new_findings"] == []


def test_github_outputs_and_summary(repo: Path, tmp_path: Path, monkeypatch) -> None:
    _add_cycle(repo)
    outputs = tmp_path / "github_output"
    summary = tmp_path / "step_summary"
    monkeypatch.setenv("GITHUB_OUTPUT", str(outputs))
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))

    _run(repo, tmp_path / "out", "--base-ref", "HEAD~1", "--no-fail")

    values = dict(line.split("=", 1) for line in outputs.read_text("utf-8").splitlines())
    assert values["status"] == "failed"
    assert values["new-findings"] == "3"
    assert values["fixed-findings"] == "0"
    assert float(values["health-delta"]) < 0
    assert "MESA architecture check: FAILED" in summary.read_text("utf-8")
    assert values["report-sarif"].endswith("mesa.sarif")
    assert Path(values["report-markdown"]).read_text("utf-8").startswith("<!-- mesa-report -->")


def test_annotations_are_printed_on_request(repo: Path, tmp_path: Path) -> None:
    _add_cycle(repo)

    quiet = _run(repo, tmp_path / "a", "--base-ref", "HEAD~1", "--no-fail")
    loud = _run(repo, tmp_path / "b", "--base-ref", "HEAD~1", "--no-fail", "--annotations")

    assert "::error " not in quiet.output
    assert "::error file=" in loud.output
    assert "title=MESA%3A Cyclic dependency" in loud.output


def test_links_use_the_github_repository_and_head_sha(
    repo: Path, tmp_path: Path, monkeypatch
) -> None:
    _add_cycle(repo)
    monkeypatch.setenv("GITHUB_SERVER_URL", "https://github.com")
    monkeypatch.setenv("GITHUB_REPOSITORY", "octo/shop")

    _run(repo, tmp_path / "out", "--base-ref", "HEAD~1", "--no-fail", "--head-sha", "feed42")

    report = (tmp_path / "out" / "report.md").read_text("utf-8")
    assert "https://github.com/octo/shop/blob/feed42/order-service/app.py#L" in report


def test_without_a_base_it_uses_absolute_mode(repo: Path, tmp_path: Path) -> None:
    result = _run(repo, tmp_path / "out")

    gate = json.loads((tmp_path / "out" / "gate.json").read_text(encoding="utf-8"))
    assert gate["mode"] == "absolute" and gate["has_baseline"] is False
    assert result.exit_code == 0  # the fixed demo meets the default thresholds


def test_config_from_the_head_applies_to_both_scans(repo: Path, tmp_path: Path) -> None:
    _add_cycle(repo)
    (repo / ".mesa.yml").write_text("services:\n  exclude: ['user-service']\n", encoding="utf-8")
    _commit(repo, "exclude user-service")

    result = _run(repo, tmp_path / "out", "--base-ref", "HEAD~2")

    assert result.exit_code == 0, result.output  # no cycle without user-service
    head = json.loads((tmp_path / "out" / "head.json").read_text(encoding="utf-8"))
    base = json.loads((tmp_path / "out" / "base.json").read_text(encoding="utf-8"))
    assert "user-service" not in head["summary"]["selected_service_paths"]
    assert "user-service" not in base["summary"]["selected_service_paths"]


def test_unknown_base_ref_and_non_git_folder(repo: Path, tmp_path: Path) -> None:
    unknown = _run(repo, tmp_path / "out", "--base-ref", "does-not-exist")
    option_like = _run(repo, tmp_path / "out", "--base-ref", "--help-me")
    plain = tmp_path / "plain"
    plain.mkdir()
    not_git = runner.invoke(app, ["ci", "--path", str(plain), "--out-dir", str(tmp_path / "o")])

    assert unknown.exit_code == 2 and "fetch-depth: 0" in unknown.output
    assert option_like.exit_code != 0
    assert not_git.exit_code == 2 and "not inside a git repository" in not_git.output
