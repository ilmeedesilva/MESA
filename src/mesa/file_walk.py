"""Walk the files of a scanned directory safely.

Every scanner in MESA (service discovery, fact extraction, language detection)
reads files below a root directory. Two rules apply to all of them:

* Directories such as `.git`, `node_modules` or virtual environments are
  skipped. Only the part of the path *below the root* is checked, so a project
  that happens to live inside a folder called `build` is still scanned.
* A file is only read when its real location (after following symlinks) is
  inside the root. A symlink inside a scanned repository that points to
  `/etc/passwd`, or to another part of the server, is skipped. This closes the
  gap left by the API's scan-root check, which only checks the service path
  itself and not the files below it.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

IGNORED_DIR_NAMES = frozenset(
    {".git", "__pycache__", "node_modules", ".venv", "venv", "dist", "build"}
)


def is_ignored(file_path: Path, root: Path) -> bool:
    """True if a directory between `root` and `file_path` is one MESA never scans."""
    try:
        parts = file_path.relative_to(root).parts
    except ValueError:
        parts = file_path.parts
    return any(part in IGNORED_DIR_NAMES for part in parts)


def is_inside(path: Path, root: Path) -> bool:
    """True if `path`, with every symlink resolved, lies inside `root`."""
    return _is_inside_real(os.path.realpath(path), os.path.realpath(root))


def _is_inside_real(real_path: str, real_root: str) -> bool:
    return real_path == real_root or real_path.startswith(real_root.rstrip(os.sep) + os.sep)


def iter_files(root: Path, *, sort: bool = True) -> Iterator[Path]:
    """Yield the regular files below `root` that MESA may read.

    Ordering matches `sorted(root.rglob("*"))`, which earlier versions used
    directly, so results (and the order of findings) do not change.
    """
    real_root = os.path.realpath(root)
    entries = root.rglob("*")
    for file_path in sorted(entries) if sort else entries:
        if is_ignored(file_path, root) or not file_path.is_file():
            continue
        # Skips a symlinked file, or a file below a symlinked directory, whose
        # real location is outside the root.
        if not _is_inside_real(os.path.realpath(file_path), real_root):
            continue
        yield file_path
