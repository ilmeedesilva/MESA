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
  - click `Preview discovery`
  - review the discovered services and keep the ones you want
  - click `Apply selected services`
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
7. Click `Run scan` or `Run repo scan`.
8. Review findings, graph, health scores, evolution, and recommendations.
9. Open the `Roadmap` page to see grouped fixes in suggested order.

## Read Results More Easily

MESA can explain findings at two levels of detail.

Use the `Simple | Technical` switch in the top bar (in the menu on phones). Your browser remembers the choice.

- `Simple` (default)
  - plain-language finding titles
  - clearer "why it matters" guidance
  - first recommended action
  - explanation of what the result does not prove
- `Technical`
  - everything from `Simple`
  - finding IDs, detector and rule names
  - exact file:line locations
  - evidence steps, recommendation source and raw evidence

Use `Simple` when:

- sharing results with your team
- reviewing results with non-technical stakeholders
- doing a first pass through a new repository

Use `Technical` when:

- checking exactly what the detector saw
- comparing evidence quality across findings
- fixing the problem in code

## How to Interpret a Finding

Each finding now has a clearer structure in the drawer:

1. `What MESA found`
2. `Why it matters`
3. `Why MESA thinks this`
4. `What to do first`
5. `Expected impact`
6. `What this does not prove`

Recommended reading order:

1. Start with the plain-language title.
2. Check which services are affected.
3. Read `Why it matters` to understand the architectural risk.
4. Read `Why MESA thinks this` to inspect detector support.
5. Check confidence before deciding how urgent the issue is.
6. Read the first refactoring step before planning changes.
7. Read `What this does not prove` to avoid over-interpreting the result.

## Understanding Confidence

Confidence is not the same as severity.

- Severity tells you how serious the architectural risk may be.
- Confidence tells you how strongly the current detector evidence supports that result.

Practical interpretation:

- `Very high` or `High` confidence:
  - usually safe to treat as a strong signal for review and remediation planning
- `Moderate` confidence:
  - review the evidence before acting
- `Low` confidence:
  - treat as an early signal that needs manual confirmation

## Summary Cards Meaning

The summary strip now helps users understand where to focus first:

- `Findings`: total findings in the scan
- `Services`: services included in the scan
- `System Health`: overall architecture score
- `Highest Risk`: strongest severity currently present
- `Hotspot Service`: service with the densest concentration of linked findings
- `Focus First`: the first issue MESA suggests reviewing

## Remediation Roadmap

The remediation roadmap combines multiple findings into one action plan.

Use it when you want to know:

- what to fix first
- which actions are quick wins
- which changes need deeper refactoring
- what depends on earlier work

Read it in this order:

1. roadmap summary
2. suggested order
3. quick wins
4. medium-term changes
5. high-effort refactors
6. dependencies

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

This is intended to reduce first-run confusion and make the system easier to follow.

## Repository Ingestion APIs

MESA provides repository-ingestion endpoints for source-driven scans.

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

## Service Discovery Review

MESA adds explainable service discovery on top of repository preview.

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

Architecture gate (pass or fail, for CI):

```bash
mesa gate tests/fixtures/chatty/order-service tests/fixtures/chatty/user-service --output mesa-gate.json
```
