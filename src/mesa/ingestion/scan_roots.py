"""Restrict which server directories the API may scan.

`POST /analyze` and `POST /projects/{project_id}/scans` take service paths from
the request. Without a limit, anyone who can reach the API could make MESA read
any directory on the server. Paths must therefore resolve inside one of the
allowed scan roots.

Allowed roots come from `MESA_ALLOWED_SCAN_ROOTS` (several roots separated by
the OS path separator, `:` on Linux and macOS). If it is not set, the single
root is `MESA_WORKSPACE_ROOT` (`/workspace` in the Docker setup), or the
repository root when that is not set either.

The CLI does not use this: it scans paths on the user's own machine.
"""

from __future__ import annotations

import os
from pathlib import Path

# src/mesa/ingestion/scan_roots.py -> repository root, as in evaluation/runner.py
_DEFAULT_WORKSPACE_ROOT = str(Path(__file__).resolve().parents[3])


class ScanPathNotAllowedError(ValueError):
    """A requested service path resolves outside every allowed scan root."""


def allowed_scan_roots() -> list[str]:
    raw = os.getenv("MESA_ALLOWED_SCAN_ROOTS", "")
    roots = [item.strip() for item in raw.split(os.pathsep) if item.strip()]
    if not roots:
        roots = [os.getenv("MESA_WORKSPACE_ROOT") or _DEFAULT_WORKSPACE_ROOT]
    return [os.path.realpath(root) for root in roots]


def resolve_allowed_service_path(raw_path: str) -> str:
    """Return the fully resolved path if it lies inside an allowed root.

    The path is resolved first (`..` segments removed, symlinks followed), so a
    `../` escape or a symlink pointing outside an allowed root is rejected.
    """
    resolved = os.path.realpath(raw_path)
    for root in allowed_scan_roots():
        if resolved == root:
            # The root itself. Return the configured root, not the request value.
            return root
        root_prefix = root if root.endswith(os.sep) else root + os.sep
        # A plain prefix check on the fully resolved path: static analysers
        # (CodeQL) recognise this form as a path-injection guard.
        if resolved.startswith(root_prefix):
            return resolved
    raise ScanPathNotAllowedError(
        f"Service path is outside the allowed scan roots: {raw_path}. "
        "Set MESA_ALLOWED_SCAN_ROOTS to allow other directories."
    )


def resolve_allowed_service_paths(raw_paths: list[str]) -> list[str]:
    return [resolve_allowed_service_path(raw_path) for raw_path in raw_paths]
