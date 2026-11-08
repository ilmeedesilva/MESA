#!/usr/bin/env python3
"""Fetch the third-party repositories used by MESA's real-repository benchmarks.

Downloads each repository at the exact commit it was evaluated at and lays it
out under ``benchmarks/real-repos/`` exactly as the ``benchmarks/real_repo_*.yml``
files expect. This is the single source of truth for those commits;
``benchmarks/real-repos/README.md`` points here.

It mirrors how the original copies were made (MESA's own GITHUB_URL ingestion
in ``src/mesa/ingestion/repository.py``): download the GitHub codeload zip for
the commit, extract it with ``zipfile.extractall``, and take the single
top-level folder as the repository root. Using the same extraction matters:
``zipfile`` writes symbolic links as small text files, and the evaluated
copies were made that way.

Safe to run more than once: a repository already fetched at the pinned commit
is left alone. Use ``--force`` to delete and re-fetch.

Usage:
    python scripts/fetch_benchmark_repos.py            # fetch anything missing
    python scripts/fetch_benchmark_repos.py --force    # re-fetch everything
    python scripts/fetch_benchmark_repos.py --verify   # only check what is there

Standard library only (PyYAML is used for the layout check if installed).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from urllib.request import urlopen

REPO_ROOT = Path(__file__).resolve().parent.parent
BENCHMARKS_DIR = REPO_ROOT / "benchmarks"
TARGET_ROOT = BENCHMARKS_DIR / "real-repos"
# Kept outside every benchmark's discovery root so it can never be scanned.
STATE_FILE = TARGET_ROOT / ".fetched.json"


@dataclass(frozen=True)
class PinnedRepo:
    target: str  # path under benchmarks/real-repos/
    owner: str
    repo: str
    commit: str
    subdirectory: str | None  # keep only this folder of the repository
    tree_sha256: str  # content hash of the laid-out folder (see tree_digest)


# The commits the paper's results were produced from (fetched 2026-09-14 / 2026-09-21).
PINNED_REPOS: tuple[PinnedRepo, ...] = (
    PinnedRepo(
        "online-boutique/src",
        "GoogleCloudPlatform",
        "microservices-demo",
        "b9a978db9e01f4ad3dca9494a22cb9edc17548fe",
        "src",
        "e9fb7a7ef146ca56bcf8dce0ee4511ac524a8aec307a0d46b4bca8f330598fd0",
    ),
    PinnedRepo(
        "spring-sample",
        "piomin",
        "sample-spring-microservices-new",
        "cc5c9fbe771772eb40d091ee2371286ecd099083",
        None,
        "f4db630f1f69a839d11d28664776bd130a6f4d4acaee19c361f065e0a758aaa5",
    ),
    PinnedRepo(
        "sock-shop/catalogue",
        "microservices-demo",
        "catalogue",
        "925e08ee17c28b94b87160e1ae5e03da7f61cf84",
        None,
        "e0669d1cd068ceb4c2fa648fa897120ce13a7f22c95dd3b9641afac81b005f36",
    ),
    PinnedRepo(
        "sock-shop/carts",
        "microservices-demo",
        "carts",
        "f4e80051668c6a83359c41b03a27baefa590adc8",
        None,
        "aa06c52be7690f163e29869eefb0ee8b429e9265f6bb709292fe2ddb6dbe43dd",
    ),
    PinnedRepo(
        "sock-shop/orders",
        "microservices-demo",
        "orders",
        "546a10c92d1ff9998c21f3849f5b95a0f14430a0",
        None,
        "eb20c8f059b3567586071bea47c2f970679cc3e3dd958b1b309816dbc2d9121f",
    ),
    PinnedRepo(
        "sock-shop/payment",
        "microservices-demo",
        "payment",
        "384e33447dda5334187517dda09566c9a17fd6af",
        None,
        "fab5d6257f642a15e26dd36f37c4c3181c7f019e4b9abb87795732b18316b63d",
    ),
    PinnedRepo(
        "sock-shop/shipping",
        "microservices-demo",
        "shipping",
        "9c0fbfa31895dd029d44d3434de93f64cd71f87b",
        None,
        "566c7b1c9e5d0bdccad28310da0a4095f66cc3879b95d0ca0e01ab6ce25bfce1",
    ),
    PinnedRepo(
        "sock-shop/user",
        "microservices-demo",
        "user",
        "e1a79e77860734cacc3f64cabff1487e22a442a4",
        None,
        "bb7d64eabaff7e5085f3693b1833e02b1ab765a40a2fd225c5dd38f18cdaab4b",
    ),
    PinnedRepo(
        "sock-shop/queue-master",
        "microservices-demo",
        "queue-master",
        "7dc33721c765e5af415c9d244d84637ff2d510cd",
        None,
        "55c54668f314f41f1f524d9db4f84e5a8e9a36d8253ddcaf6647d3a71915c882",
    ),
    PinnedRepo(
        "sock-shop/front-end",
        "microservices-demo",
        "front-end",
        "52dee656f4423be041619bbb090205f912e00113",
        None,
        "113b974b1e373980fd59973703c13ce1989415997253ef07efa178581389c0b4",
    ),
)


def tree_digest(root: Path) -> str:
    """SHA-256 over every file's relative path and bytes, in sorted order."""
    digest = hashlib.sha256()
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(b"\0")
        digest.update(hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest()


def load_state() -> dict[str, str]:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {}


def save_state(state: dict[str, str]) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")


def download(url: str, destination: Path) -> None:
    with urlopen(url, timeout=60) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)


def fetch(pin: PinnedRepo) -> None:
    url = f"https://codeload.github.com/{pin.owner}/{pin.repo}/zip/{pin.commit}"
    target = TARGET_ROOT / pin.target
    with tempfile.TemporaryDirectory(prefix="mesa-bench-") as tmp:
        tmp_path = Path(tmp)
        archive = tmp_path / "repo.zip"
        print(f"  downloading {url}")
        download(url, archive)
        extract_dir = tmp_path / "extract"
        extract_dir.mkdir()
        with zipfile.ZipFile(archive) as zf:
            for name in zf.namelist():
                resolved = (extract_dir / name).resolve()
                if not resolved.is_relative_to(extract_dir.resolve()):
                    raise SystemExit(f"Unsafe path in archive: {name}")
            zf.extractall(extract_dir)
        top_level = [p for p in extract_dir.iterdir() if p.is_dir() and p.name != "__MACOSX"]
        if len(top_level) != 1:
            raise SystemExit(f"Expected one top-level folder in {url}, found {len(top_level)}")
        source = top_level[0] / pin.subdirectory if pin.subdirectory else top_level[0]
        if not source.is_dir():
            raise SystemExit(f"{pin.subdirectory!r} not found in {pin.owner}/{pin.repo}")
        if target.exists():
            # Only reached with --force (main() refuses otherwise); never outside TARGET_ROOT.
            if not target.resolve().is_relative_to(TARGET_ROOT.resolve()):
                raise SystemExit(f"Refusing to delete {target}: outside {TARGET_ROOT}")
            shutil.rmtree(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(target))


def check_hash(pin: PinnedRepo) -> bool:
    actual = tree_digest(TARGET_ROOT / pin.target)
    if not pin.tree_sha256:
        print(f"  tree sha256 {actual} (no pinned hash to compare)")
        return True
    if actual != pin.tree_sha256:
        print(f"  MISMATCH tree sha256 {actual}, expected {pin.tree_sha256}")
        return False
    print("  tree sha256 matches pinned hash")
    return True


def check_layout() -> list[str]:
    """Every service path named in benchmarks/real_repo_*.yml must exist."""
    try:
        import yaml
    except ImportError:
        print("PyYAML not installed; skipping benchmark layout check.")
        return []
    problems: list[str] = []
    for spec in sorted(BENCHMARKS_DIR.glob("real_repo_*.yml")):
        data = yaml.safe_load(spec.read_text())
        for system in data.get("systems", []):
            paths = list(system.get("service_paths", []))
            discovery_root = (system.get("service_discovery") or {}).get("root")
            if discovery_root:
                paths.append(discovery_root)
            for rel in paths:
                if not (BENCHMARKS_DIR / rel).is_dir():
                    problems.append(f"{spec.name}: missing {rel}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--force", action="store_true", help="re-fetch even if already present")
    parser.add_argument("--verify", action="store_true", help="do not download; only verify")
    args = parser.parse_args()

    TARGET_ROOT.mkdir(parents=True, exist_ok=True)
    state = load_state()
    ok = True
    for pin in PINNED_REPOS:
        target = TARGET_ROOT / pin.target
        print(f"{pin.target}  ({pin.owner}/{pin.repo} @ {pin.commit[:12]})")
        present = target.is_dir() and state.get(pin.target) == pin.commit
        if args.verify:
            if not present:
                print("  NOT FETCHED at the pinned commit")
                ok = False
                continue
        elif present and not args.force:
            print("  already fetched at the pinned commit")
        elif target.exists() and not args.force:
            print("  folder exists but was not fetched by this script at the pinned commit;")
            print("  leaving it untouched. Re-run with --force to replace it.")
            ok = False
            continue
        else:
            fetch(pin)
            state[pin.target] = pin.commit
            save_state(state)
        ok = check_hash(pin) and ok

    problems = check_layout()
    for problem in problems:
        print(f"LAYOUT: {problem}")
    ok = ok and not problems
    print("OK: all benchmark repositories in place." if ok else "FAILED: see messages above.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
