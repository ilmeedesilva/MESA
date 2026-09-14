# MESA Improvement Phase Tracker

This tracker follows the incremental implementation plan from the full-stack architecture improvement brief.

| Phase | Title | Status | Notes |
| --- | --- | --- | --- |
| 1 | Evidence Confidence Ledger | Complete | Findings include detector metadata, evidence chain, confidence reasoning, limitations, source files, related services, and "why valid" explanation. |
| 2 | Better Real Microservice Repository Support | Complete | Repository preview and service discovery support real-repo signals such as Docker, Kubernetes, Spring, FastAPI, Express/Nest, OpenAPI, package manifests, ports, env vars, and database config. |
| 3 | Refactoring Playbooks | Complete | Roadmap actions include structured remediation playbooks with phases, checks, rollback, risks, effort, services, and findings. |
| 4 | Architecture Fitness Gates for CI/CD | Complete | Adds deterministic pass/fail gate reports for health score, critical findings, cycles, governance violations, and high-risk coupling. Includes API, CLI, JSON output, docs, and tests. |
| 5 | Async Scan Job System v1 | Complete | Repository-backed scans run via `POST /projects/{id}/repo-scans/async` (FastAPI `BackgroundTasks`, no Celery/Redis) with queued/running/completed/failed status polled from `GET /scan-jobs/{id}`. Frontend guided scan workflow submits and polls the async job for repository sources. |
| 6 | Secure Scan Intake Hardening | Complete | Archive extraction enforces decompressed-size and file-count caps, rejects tar symlink/hardlink/device members, and sweeps stale extracted workspaces on a TTL. Zip-slip/path-traversal protection was already in place. See `docs/architecture/PHASE_13_SECURE_SCAN_INTAKE.md`. |
| 7 | Real Repository Evaluation | Not started | Planned: guided evaluation on open-source microservice repositories with TP/FP/FN recording. |

## Current Build Focus

Phase 7 (Real Repository Evaluation) is next. It is unblocked: Phase 5 (async scan jobs) and Phase 6 (secure intake) are both complete, so repository intake and scanning are hardened and non-blocking before real, internet-hosted repositories are evaluated against them.

## Completed Build Order

Phase 6 was completed ahead of Phase 5: it is a self-contained hardening change to `src/mesa/ingestion/repository.py` with no dependency on the job system, and closing it first reduced risk before Phase 5/7 exercise repository intake more heavily.

Phase 5 landed with:

- backend tests passing (`tests/test_scan_jobs.py` covers queued/running/completed/failed transitions and the new endpoints)
- job lifecycle API verified (`POST /projects/{id}/repo-scans/async`, `GET /scan-jobs/{id}`)
- frontend scan flow updated (the guided workflow's repository-backed scan submits the async job and polls it)
- manual verification against a live backend + dev server (see `docs/architecture/PHASE_14_ASYNC_SCAN_JOB_SYSTEM.md`)
