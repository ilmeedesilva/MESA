# Phase 13: Secure Scan Intake Hardening

Status: Implemented.

## Goal

Harden repository ingestion (`src/mesa/ingestion/repository.py`) against untrusted archive and GitHub-URL sources, and stop unbounded disk growth from extracted scan workspaces.

## Problem

Archive extraction already rejected zip-slip / path-traversal members (`_ensure_within_destination`), but three gaps remained:

- No cap on total decompressed size or file count, so a small, highly-compressed archive (a zip/tar bomb) could exhaust disk during extraction.
- No rejection of symlink, hardlink, or device/FIFO members in tar archives, so a crafted tar could extract a symlink pointing outside the workspace.
- Extracted workspaces under the repo cache root (`MESA_REPO_CACHE_ROOT`, or `<tempdir>/mesa-repo-cache` by default) were never removed after a scan, so every archive or GitHub-URL scan permanently leaked disk space.

## Added

- `_check_extraction_limits`: sums declared member sizes and counts before extracting, raising `RepositoryPreparationError` past `_MAX_EXTRACTED_BYTES` (1 GB default) or `_MAX_EXTRACTED_FILES` (20,000 default). Applied to both zip and tar archives.
- Tar member type guard: rejects any member where `issym()`, `islnk()`, or `isdev()` is true before extraction.
- `_sweep_stale_workspaces`: runs each time the cache root is resolved and removes any workspace subdirectory older than `MESA_REPO_CACHE_TTL_HOURS` (24h default), avoiding the need for a separate scheduler or background worker.
- Tests: `tests/test_ingestion.py` covers oversized-archive rejection (by byte count and by file count), tar symlink rejection, and the stale-workspace sweep.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `MESA_REPO_CACHE_ROOT` | `<tempdir>/mesa-repo-cache` | Where archive/GitHub sources are extracted. |
| `MESA_REPO_CACHE_TTL_HOURS` | `24` | How long an extracted workspace is kept before being swept. |

The extraction limits (`_MAX_EXTRACTED_BYTES`, `_MAX_EXTRACTED_FILES`) are module constants rather than env vars for now, since they protect against abuse rather than tuning normal usage.

## Limitations

- The byte/file-count check reads archive member metadata, not actual written bytes; this is the standard defense against compression-ratio bombs and matches the existing `_MAX_DOWNLOAD_BYTES` download cap's approach.
- The workspace sweep is opportunistic (runs on next cache-root access), not a guaranteed background job — a long gap between scans could leave stale workspaces past the TTL until the next scan runs.
- Async scan execution (Phase 5 in `docs/guides/IMPLEMENTATION_PHASE_TRACKER.md`) is a separate, not-yet-implemented concern: large real-world scans still run synchronously in-request.
