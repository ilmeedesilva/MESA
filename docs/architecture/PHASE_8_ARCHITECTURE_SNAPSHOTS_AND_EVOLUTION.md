# Phase 8: Architecture Snapshots and Evolution Tracking

Status: Implemented.

## Goal

Add thesis-level novelty by tracking architecture snapshots over time and comparing scan N with scan N+1 to detect architectural evolution, deterioration, and improvement.

## Added

- Snapshot listing through the existing PostgreSQL `snapshots` table.
- In-memory snapshot support for tests and local fallback.
- Deterministic evolution comparison engine in `src/mesa/analysis/evolution.py`.
- Timeline API for consecutive scan comparisons.
- Explicit comparison API for two selected scan IDs.
- Frontend Architecture Evolution panel showing score trend, risk trend, new dependencies, new cycles, timeline entries, and recommendations.
- Automated API test coverage for snapshot creation and evolution comparison.

## API Endpoints

```text
GET /projects/{project_id}/snapshots
GET /projects/{project_id}/evolution
GET /projects/{project_id}/evolution/compare?base_scan_id=<scan_id>&target_scan_id=<scan_id>
```

## Evolution Report Output

Each comparison returns:

- `architecture_change_summary`
- `risk_trend`
- `score_trend`
- `service_level_changes`
- `new_dependencies`
- `removed_dependencies`
- `new_cycles`
- `removed_cycles`
- `recommendations`

## Comparison Logic

MESA compares two persisted scan reports as architecture snapshots.

- Risks are matched by anti-pattern type and affected service set.
- Dependencies are matched by source, target, and dependency type.
- Cycles are extracted from cyclic dependency findings and evidence where available.
- Health scores are compared at system and service level.
- Service-level changes include file, endpoint, database, and finding deltas.

This is deterministic and explainable, which makes it suitable for research evaluation and viva demonstration.

## Frontend Behavior

The dashboard loads `GET /projects/{project_id}/evolution` whenever scan history is loaded.

The Architecture Evolution panel shows:

- latest system score delta
- latest risk delta
- new dependency count
- new cycle count
- natural-language change summary
- recommendation
- timeline of scan-to-scan comparisons

If fewer than two scans exist, the panel shows an empty state explaining that at least two scans are required.

## How to Run

```bash
docker compose up --build
```

Open:

```text
http://localhost:5173
```

Run at least two scans under the same project, then review the Architecture Evolution panel.

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

Manual API checks:

```bash
curl http://localhost:8000/projects/<project_id>/snapshots
curl http://localhost:8000/projects/<project_id>/evolution
curl "http://localhost:8000/projects/<project_id>/evolution/compare?base_scan_id=<old_scan_id>&target_scan_id=<new_scan_id>"
```

## Acceptance Criteria Mapping

- Snapshot comparison works: implemented by `compare_scan_results` and `/evolution/compare`.
- Evolution timeline API exists: implemented by `GET /projects/{project_id}/evolution`.
- UI shows architecture changes over time: implemented by the Architecture Evolution panel.

## Limitations

- Phase 8 compares static scan reports. It does not infer intent from commit history yet.
- Finding matching is signature-based, using anti-pattern type and involved services.
- The UI currently shows project-level timeline summaries, not a full per-node historical graph playback.
- Snapshot storage currently persists graph JSON; richer snapshot metadata is derived from the persisted scan report.
