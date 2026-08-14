# MESA Improvement Phase Tracker

This tracker follows the incremental implementation plan from the full-stack architecture improvement brief.

| Phase | Title | Status | Notes |
| --- | --- | --- | --- |
| 1 | Evidence Confidence Ledger | Complete | Findings include detector metadata, evidence chain, confidence reasoning, limitations, source files, related services, and "why valid" explanation. |
| 2 | Better Real Microservice Repository Support | Complete | Repository preview and service discovery support real-repo signals such as Docker, Kubernetes, Spring, FastAPI, Express/Nest, OpenAPI, package manifests, ports, env vars, and database config. |
| 3 | Refactoring Playbooks | Complete | Roadmap actions include structured remediation playbooks with phases, checks, rollback, risks, effort, services, and findings. |
| 4 | Architecture Fitness Gates for CI/CD | Complete | Adds deterministic pass/fail gate reports for health score, critical findings, cycles, governance violations, and high-risk coupling. Includes API, CLI, JSON output, docs, and tests. |
| 5 | Async Scan Job System v1 | Not started | Planned: queued/running/completed/failed scan jobs using FastAPI background tasks or an equivalent lightweight backend mechanism. |
| 6 | Secure Scan Intake Hardening | Not started | Planned: file-count, size, binary, symlink, traversal, archive, and warning controls for untrusted repositories. |
| 7 | Real Repository Evaluation | Not started | Planned: guided evaluation on open-source microservice repositories with TP/FP/FN recording. |

## Current Build Focus

Phase 5 should stay small and operationally safe:

- simple background task based scan jobs first
- queued, running, completed, and failed statuses
- result reference back to the existing persisted scan model
- frontend loading and error states
- no Celery or Redis unless the simple approach becomes insufficient

## Future Build Order

Do not start Phase 6 until Phase 5 has:

- backend tests passing
- job lifecycle API verified
- frontend scan flow updated
- manual long-running scan workflow verified
