# MESA

MESA is an architecture intelligence platform for microservice systems.

Current implementation:

- performs cross-service static analysis
- detects architectural anti-patterns from source and configuration evidence
- builds a graph-based architectural view of a system
- calculates health scores and recommendations
- supports governance policies, scan history, and evolution analysis

Target product direction:

- dynamic public repository intake
- automatic service discovery
- guided workflow for non-expert users
- integrated documentation portal
- optional AI-assisted explanation grounded in MESA evidence

See [docs/guides/PRODUCT_VISION.md](docs/guides/PRODUCT_VISION.md), [docs/guides/USER_PERSONAS_AND_FLOWS.md](docs/guides/USER_PERSONAS_AND_FLOWS.md), [docs/guides/FEATURE_SCOPE_AND_RELEASE_PLAN.md](docs/guides/FEATURE_SCOPE_AND_RELEASE_PLAN.md), and [docs/guides/PRODUCT_LANGUAGE_AND_TERMINOLOGY.md](docs/guides/PRODUCT_LANGUAGE_AND_TERMINOLOGY.md) for the Phase 1 product foundation.

Current vertical slice:

- Python/FastAPI backend.
- CLI workflow for reproducible research evaluation.
- Static extraction for Python services, environment/config files, and simple HTTP call evidence.
- NetworkX graph model plus Neo4j architecture graph persistence for persistent scans.
- Initial detectors for Chatty Services, Cyclic Dependencies, and Shared Database.
- React + TypeScript frontend scaffold with Cytoscape.js.

## Quick Start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
mesa analyze tests/fixtures/chatty/order-service tests/fixtures/chatty/user-service
uvicorn mesa.api.main:app --reload
```

## Run Tests

```bash
pytest
```

## Public Demo Experience

Phase J adds a backend-free public demo experience inside the frontend.

If the live API is unavailable, the UI can still load:

- embedded demo scans
- embedded documentation
- roadmap, graph, and score examples
- evaluator walkthrough guidance

See `docs/guides/PUBLIC_DEMO_GUIDE.md` for the public-demo workflow.



## Persistent API Workflow

Phase 1 adds PostgreSQL-backed project and scan persistence. Start the full stack with:

```bash
docker compose up --build
```

Then use `http://localhost:8000/docs` to create projects, run persistent scans, view scan history, and retrieve findings after restart. See `docs/architecture/PHASE_1_PERSISTENCE_FOUNDATION.md` for the full guide.


## Neo4j Architecture Graph

Phase 2 adds a Neo4j-backed architectural digital twin for persistent scans. Start the full stack with:

```bash
docker compose up --build
```

Then create a project and run `POST /projects/{project_id}/scans` from `http://localhost:8000/docs`. Use the returned scan id with:

```text
GET /scans/{scan_id}/graph
GET /scans/{scan_id}/graph/paths?source=order-service&target=user-service
GET /scans/{scan_id}/graph/cycles
GET /scans/{scan_id}/graph/centrality
GET /scans/{scan_id}/graph/shared-databases
GET /scans/{scan_id}/graph/high-risk-clusters
```

Neo4j Browser is available at `http://localhost:7474` with `neo4j` / `mesa-password` in the development stack. See `docs/architecture/PHASE_2_NEO4J_ARCHITECTURE_GRAPH.md` for the full Phase 2 guide.


## Hard-Coded Service Dependencies

Phase 3 detects service URLs, private IP endpoints, local ports, and service-like hostnames embedded in source or configuration files. Findings use the type `HARD_CODED_SERVICE_DEPENDENCY` and are returned by both `/analyze` and persistent scan endpoints. See `docs/architecture/PHASE_3_HARD_CODED_SERVICE_DEPENDENCIES.md` for detection heuristics and test fixtures.


## God Service Scores

Phase 4 adds a weighted God Service score for every analyzed service. Scores are returned in `summary.god_service_scores`; high-risk services also produce `GOD_SERVICE` findings with decomposition recommendations. See `docs/architecture/PHASE_4_GOD_SERVICE_DETECTOR.md` for the scoring model, thresholds, and test workflow.


## Architectural Health Scores

Phase 5 adds service-level, domain-level, and system-level architectural health scores. Scores are returned in `summary.health_scores`, persisted in the `scores` table, and exposed through `GET /scans/{scan_id}/scores`. See `docs/architecture/PHASE_5_ARCHITECTURAL_HEALTH_SCORE.md` for dimensions, weights, grades, and test workflow.


## Scan History and Findings Dashboard

Phase 6 adds a persistent frontend workflow for project creation, scan execution, scan history, findings filtering, finding detail inspection, and health score review. See `docs/architecture/PHASE_6_SCAN_HISTORY_AND_FINDINGS_DASHBOARD.md` for the dashboard workflow and limitations.
