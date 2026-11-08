#!/usr/bin/env python3
"""Repository path checks, run in CI so the repo works the same on any machine.

1. No machine-specific absolute paths (a macOS or Linux home directory, or a
   Windows user folder) in any tracked text file. Use paths relative to the
   repository root, a CLI option or an environment variable instead.
2. No two tracked paths that differ only by letter case. They collide on
   case-insensitive filesystems (macOS, Windows), and a case-only rename made
   on such a filesystem is easy to lose.

Files come from `git ls-files`, so the check sees exactly what is committed,
not the local filesystem. The frozen research results are excluded: they
record the original run and must never be edited.

Usage: python scripts/check_repo_paths.py
"""

from __future__ import annotations

import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Frozen research results (old and new location). Never edited, so not checked.
EXCLUDED_PREFIXES = ("evaluation-results/", "benchmarks/results/v0.1.0-research/")

# Built from parts so this file does not match its own patterns.
_HOME = "Us" + "ers"
MACHINE_PATH = re.compile(
    "|".join(
        [
            r"(?<![\w.-])/" + _HOME + r"/[A-Za-z0-9._-]+",  # macOS home directory
            r"(?<![\w.-])/home/[A-Za-z0-9._-]+/",  # Linux home directory
            r"\b[A-Za-z]:\\\\?"
            + _HOME
            + r"\\\\?",  # Windows user folder, single or escaped backslashes
        ]
    )
)


def tracked_files() -> list[str]:
    output = subprocess.run(
        ["git", "ls-files", "-z"], cwd=REPO_ROOT, capture_output=True, check=True
    ).stdout
    return [name for name in output.decode("utf-8").split("\0") if name]


def machine_path_problems(files: list[str]) -> list[str]:
    problems = []
    for name in files:
        if name.startswith(EXCLUDED_PREFIXES):
            continue
        path = REPO_ROOT / name
        if not path.is_file():
            continue
        data = path.read_bytes()
        if b"\0" in data[:8192]:  # binary file
            continue
        text = data.decode("utf-8", errors="replace")
        for number, line in enumerate(text.splitlines(), start=1):
            match = MACHINE_PATH.search(line)
            if match:
                problems.append(f"{name}:{number}: machine-specific path {match.group(0)!r}")
    return problems


def case_clash_problems(files: list[str]) -> list[str]:
    by_lower: dict[str, set[str]] = defaultdict(set)
    for name in files:
        parts = name.split("/")
        # Check every directory prefix as well as the file itself.
        for depth in range(1, len(parts) + 1):
            prefix = "/".join(parts[:depth])
            by_lower[prefix.lower()].add(prefix)
    return [
        "paths differ only by letter case: " + ", ".join(sorted(names))
        for names in by_lower.values()
        if len(names) > 1
    ]


def main() -> int:
    files = tracked_files()
    problems = machine_path_problems(files) + case_clash_problems(files)
    for problem in problems:
        print(problem)
    if problems:
        print(f"FAILED: {len(problems)} problem(s) in {len(files)} tracked files.")
        return 1
    print(f"OK: {len(files)} tracked files, no machine-specific paths or case-only clashes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
