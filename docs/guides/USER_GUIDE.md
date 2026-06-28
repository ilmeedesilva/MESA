# MESA User Guide

## What MESA Does

MESA analyzes multiple microservice directories and reports architectural anti-patterns, health scores, recommendations, governance policy violations, and architecture evolution.

## Start the App

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:5173`
- API docs: `http://localhost:8000/docs`
- Neo4j Browser: `http://localhost:7474`

Neo4j development credentials:

```text
neo4j / mesa-password
```

## Run a Scan in the UI

1. Open `http://localhost:5173`.
2. Follow the guided workflow at the top of the page.
3. Create or select a project.
4. Choose one of these input styles:

- Repository-backed workflow:
  - choose source type
  - enter a local path, archive path, or public GitHub URL
  - click `Preview Discovery`
  - review the discovered services and keep the ones you want
  - click `Apply Selected Services`
- Manual fallback:
  - leave the repository source empty
  - paste service directories manually

5. If you use manual service paths, use Docker-mounted paths such as:

```text
/workspace/tests/fixtures/god/platform-service
/workspace/tests/fixtures/god/order-service
/workspace/tests/fixtures/god/billing-service
/workspace/tests/fixtures/god/inventory-service
/workspace/tests/fixtures/god/user-service
/workspace/tests/fixtures/god/payment-service
/workspace/tests/fixtures/god/notification-service
```

6. Optional: edit and save governance policies.
7. Click `Run Scan` or `Run Repo Scan`.
8. Review findings, graph, health scores, evolution, and recommendations.

## Guided Workflow Meaning

The current UI now guides users through these steps:

1. Project
2. Source
3. Review Services
4. Governance Policies
5. Run Scan

The workflow banner at the top shows:

- what step is currently complete
- what step is currently active
- the next recommended action

This is intended to reduce first-run confusion and make the system easier to evaluate.

## Repository Ingestion APIs

Phase 2 introduces repository-ingestion endpoints for source-driven scans.

Current supported source types:

- `LOCAL_PATH`
- `ARCHIVE_PATH`
- `GITHUB_URL`

Recommended workflow:

1. Preview a repository source with `POST /repo-scans/preview`.
2. Review the `discovered_services` section from the preview response.
3. Keep the candidates you want to analyze and note their `relative_path` values.
4. Run a persisted repository scan with `POST /projects/{project_id}/repo-scans`.

Current limitation:

- automatic service discovery is heuristic and explainable, not guaranteed perfect
- GitHub URL fetching depends on runtime network access and an accessible public archive

## Phase 3 Service Discovery Review

Phase 3 adds explainable service discovery on top of repository preview.

Each discovered service candidate now includes:

- confidence score
- detected language
- signal manifests
- detected entrypoints
- human-readable reasons for why MESA believes the directory is a likely service

Recommended interpretation:

- high-confidence candidates are usually safe defaults for scanning
- medium-confidence candidates should be reviewed before selection
- if a repository contains orchestration files but weak per-service signals, review the candidate list carefully instead of assuming all directories are services

## CLI Usage

```bash
mesa analyze tests/fixtures/chatty/order-service tests/fixtures/chatty/user-service
```

Evaluation:

```bash
PYTHONPATH=src python3 -m mesa.cli evaluate benchmarks/ground_truth.yml --output-dir evaluation-results
```
