# Phase 6: Scan History and Findings Dashboard

## Goal

Phase 6 makes scan progress visible in the frontend. The UI now supports persistent project-based scanning instead of only one-off analysis, so users can create a project, run scans, revisit previous scans, triage findings, and inspect architectural health scores.

## Implemented Frontend Scope

The React dashboard now includes:

- Project creation screen
- Project selector backed by browser local storage
- Scan path input screen
- Persistent scan execution using `POST /projects/{project_id}/scans`
- Scan history list using `GET /projects/{project_id}/scans`
- Scan result loading using `GET /scans/{scan_id}`
- Findings dashboard
- Filters by anti-pattern, severity, service, and minimum confidence
- Finding detail drawer with evidence JSON
- Health score view for system and lowest service scores
- Existing Cytoscape architecture graph view retained

## API Usage

Phase 6 uses the existing backend API:

```text
POST /projects
POST /projects/{project_id}/scans
GET /projects/{project_id}/scans
GET /scans/{scan_id}
GET /scans/{scan_id}/scores
```

The frontend stores created project records in browser `localStorage` because the backend does not yet expose a global `GET /projects` endpoint. Scan history and scan results are still loaded from the backend database.

## Dashboard Workflow

1. Create a project from the left panel.
2. Enter one service directory per line.
3. Run a persistent scan.
4. Select earlier scans from the scan history strip.
5. Review findings in the right dashboard.
6. Filter findings by anti-pattern, severity, service, or confidence.
7. Open a finding detail drawer to inspect evidence and recommendations.
8. Review system and service health scores in the health score panel.

## Health Score View

The health panel shows:

- system score
- grade
- explanation
- dimension breakdown
- lowest service scores

Scores come from `summary.health_scores` and, when loading persisted scans, from `GET /scans/{scan_id}/scores` when available.

## How to Run

```bash
docker compose up --build
```

Open:

```text
http://localhost:5173
```

Use the default fixture paths or enter custom Docker-visible service paths beginning with `/workspace`.

## How to Test

Backend tests:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider
```

Frontend build:

```bash
cd frontend
npm run build
```

## Acceptance Criteria Status

- User can create/select project.
- User can run scan from UI.
- User can view previous scans.
- User can inspect findings.
- User can view health scores.

## Current Limitations

- Project list persistence is browser-local because the backend currently supports create/get project but not list all projects.
- The dashboard does not yet support deleting projects or scans.
- The graph still visualizes the report graph from the scan result, not the Neo4j query graph endpoint.
- The finding drawer displays evidence as formatted JSON; a later phase can render evidence with file-aware UI components.
