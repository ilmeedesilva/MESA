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
2. Create or select a project.
3. Use Docker-mounted service paths, for example:

```text
/workspace/tests/fixtures/god/platform-service
/workspace/tests/fixtures/god/order-service
/workspace/tests/fixtures/god/billing-service
/workspace/tests/fixtures/god/inventory-service
/workspace/tests/fixtures/god/user-service
/workspace/tests/fixtures/god/payment-service
/workspace/tests/fixtures/god/notification-service
```

4. Optional: edit and save governance policies.
5. Click Run Scan.
6. Review findings, graph, health scores, evolution, and recommendations.

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
