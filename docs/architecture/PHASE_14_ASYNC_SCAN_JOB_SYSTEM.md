# Phase 14: Async Scan Job System v1

Status: Implemented.

## Goal

Stop repository-backed scans (archive upload or `GITHUB_URL` download + extract + analyze) from blocking a request/worker thread for the full scan duration, using the simplest mechanism that works: FastAPI `BackgroundTasks`, no Celery or Redis.

## Problem

`POST /projects/{id}/repo-scans` did everything synchronously in-request: download/extract the repository, run static analysis, persist findings, and (if enabled) write to Neo4j. A slow GitHub download or a large repository could tie up a worker for the whole request and risk client-side timeouts.

## Added

- `ScanJobStatus` / `ScanJobRecord` models (`src/mesa/models.py`): `QUEUED` -> `RUNNING` -> `COMPLETED` or `FAILED`, with `scan_id` (once completed) and `error_message` (if failed).
- `scan_jobs` table (`src/mesa/storage/migrations/002_scan_jobs.sql`) and matching methods (`create_scan_job`, `get_scan_job`, `mark_scan_job_running`, `complete_scan_job`, `fail_scan_job`) on both `InMemoryPersistenceRepository` and `PostgresPersistenceRepository`.
- `PostgresPersistenceRepository.initialize()` now applies every `*.sql` file under `storage/migrations/` in order, instead of only the first one, so future migrations do not require touching this method again.
- `_run_repo_scan`: the scan logic previously inline in `run_project_repo_scan` (`src/mesa/api/main.py`), factored out so both the synchronous and async endpoints share it.
- `POST /projects/{project_id}/repo-scans/async` (202): creates a `QUEUED` job and schedules `_run_repo_scan` via `BackgroundTasks`, catching any exception and recording it as `FAILED` rather than raising into the void.
- `GET /scan-jobs/{job_id}`: polls job status; 404 if the job id is unknown.
- Frontend (`frontend/src/main.tsx`): the guided scan workflow's repository-backed submission path now calls the async endpoint and polls `pollScanJob` (1s interval, ~5 minute cap) instead of awaiting the synchronous endpoint directly. The manual-service-paths scan path is unchanged, since those scans are local and fast.

## What Did Not Change

- `POST /projects/{project_id}/repo-scans` (synchronous) still exists and still works, for callers (CLI, scripts, existing integrations) that want a single blocking call.
- Manual local-path scans (`POST /projects/{project_id}/scans`) are unaffected; only the repository-backed (archive/GitHub) path was switched to async in the UI.

## Verification

- `tests/test_scan_jobs.py`: job lifecycle (queued -> completed, queued -> failed), 404s for unknown project/job.
- Manual: started the real backend (`uvicorn`) and frontend (`vite`) and drove the exact HTTP sequence the UI performs, through the vite `/api` proxy, against the live backend: create project -> `POST .../repo-scans/async` (`QUEUED`) -> `GET /scan-jobs/{id}` (`COMPLETED` with a `scan_id` about a second later) -> `GET /scans/{scan_id}` (full result, findings present). No browser-automation tooling (Playwright/chromium-cli) was available in this environment to click through the rendered page itself; the network contract the UI relies on was verified directly instead.

## Limitations

- Jobs are in-process: a process restart loses any in-flight `QUEUED`/`RUNNING` job (acceptable for a "v1", consistent with the "no Celery/Redis unless needed" scope).
- No job cancellation endpoint.
- No job listing/history endpoint yet (only fetch-by-id); add one if the frontend needs to show past job attempts rather than just the current one.
