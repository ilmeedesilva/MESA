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
- Detectors for Chatty Services, Cyclic Dependencies, Shared Database, God Service, and Hard-Coded Service Dependencies.
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
ruff check src tests
```

CI runs both, plus `pytest --cov=mesa --cov-report=term-missing` for a coverage report (currently ~80% overall; the CLI and the Postgres/Neo4j storage backends are the least-covered areas since the test suite exercises the in-memory repository).

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


## Architecture Graph Dashboard

Phase 7 renders the persisted Neo4j architecture graph as an interactive architectural digital twin: services, per-service API groups, databases, and supporting resources as distinct node types, with risk-highlighted edges linked back to findings. Clicking a node or edge opens an inspector with ownership, linked findings, and health context. See `docs/architecture/PHASE_7_ARCHITECTURE_GRAPH_DASHBOARD.md`.


## Architecture Snapshots and Evolution Tracking

Phase 8 compares scan N with scan N+1 to detect architectural drift over time.

```text
GET /projects/{project_id}/snapshots
GET /projects/{project_id}/evolution
GET /projects/{project_id}/evolution/compare?base_scan_id=<scan_id>&target_scan_id=<scan_id>
```

Each comparison reports architecture change summary, risk trend, score trend, new/removed dependencies, and new/removed cycles. See `docs/architecture/PHASE_8_ARCHITECTURE_SNAPSHOTS_AND_EVOLUTION.md`.


## Recommendation Layer

Phase 9 attaches a structured, evidence-grounded recommendation to every finding: root cause, architectural consequence, affected services/files, refactoring steps, expected impact, priority, and estimated difficulty, covering all implemented detectors. See `docs/architecture/PHASE_9_RECOMMENDATION_LAYER.md`.


## Governance Policy Engine

Phase 10 lets a project define its own architecture rules and have MESA enforce them at scan time; violations are returned as normal findings with recommendations.

```text
GET /projects/{project_id}/policies
POST /projects/{project_id}/policies
PUT /projects/{project_id}/policies/{policy_id}
POST /projects/{project_id}/policies/import
```

See `docs/architecture/PHASE_10_GOVERNANCE_POLICY_ENGINE.md` for the YAML/JSON policy format.


## Evaluation Runner

Phase 11 adds a repeatable evaluation runner that scores MESA's own detector output against ground-truth benchmark labels (precision/recall/F1, CSV/JSON/Markdown export):

```bash
mesa evaluate benchmarks/ground_truth.yml --output-dir evaluation-results
```

See `docs/architecture/PHASE_11_EVALUATION_RUNNER.md`.


## Secure Scan Intake Hardening

Phase 13 hardens archive/GitHub-URL ingestion: decompressed-size and file-count caps, rejection of tar symlink/hardlink/device members, and a TTL sweep of extracted workspaces, on top of the existing zip-slip/path-traversal protection. See `docs/architecture/PHASE_13_SECURE_SCAN_INTAKE.md`.


## Async Scan Job System

Phase 14 runs repository-backed scans (archive or GitHub URL) as a background job instead of blocking the request:

```text
POST /projects/{project_id}/repo-scans/async
GET /scan-jobs/{job_id}
```

The guided scan workflow's repository-backed submit path uses this automatically. See `docs/architecture/PHASE_14_ASYNC_SCAN_JOB_SYSTEM.md`.


## Real Repository Evaluation

Phase 15 evaluates MESA against manually reviewed, real, third-party repositories (`GoogleCloudPlatform/microservices-demo`, `piomin/sample-spring-microservices-new`) rather than only synthetic fixtures, with full TP/FP/FN reasoning recorded in `benchmarks/real_repo_*.yml`. See `docs/architecture/PHASE_15_REAL_REPOSITORY_EVALUATION.md` and `docs/research/EVALUATION_SETUP_AND_RESULTS.md` for results.


## Benchmark Evaluation API and UI

Phase 16 exposes the evaluation runner over the API and a frontend `Benchmarks` page, so ground-truth precision/recall/F1 can be run without a terminal:

```text
GET /benchmarks
POST /benchmarks/{benchmark_id}/evaluate
```

See `docs/architecture/PHASE_16_BENCHMARK_EVALUATION_API_AND_UI.md`.

## Detector Fixes and Language Coverage (Phases 17–20)

Phase 17 fixes a Config Server misattribution: MESA no longer reads a hosted config file's URLs (e.g. `config-service/discovery-service.yml`) as the hosting service's own outbound calls, removing false `CHATTY_SERVICE`/`CYCLIC_DEPENDENCY` findings on Spring Cloud Config-based systems. See `docs/architecture/PHASE_17_CONFIG_SERVER_MISATTRIBUTION_FIX.md`.

Phase 18 downgrades hard-coded-dependency findings for known observability/infra sidecar addresses (OpenTelemetry, Prometheus, Jaeger, Consul, Vault) to `LOW` severity with a `likely_infrastructure_address` flag, configurable via `MESA_INFRA_PORT_ALLOWLIST`. See `docs/architecture/PHASE_18_INFRA_ADDRESS_DOWNGRADE.md`.

Phase 19 adds a synthetic recall-stress-test fixture (8 services, 5 anti-pattern types deliberately interleaved in one scan) to test whether co-occurring patterns mask each other. See `docs/architecture/PHASE_19_RECALL_STRESS_TEST.md`.

Phase 20 adds MVP Go language support (regex-based extraction, matching the existing per-language style), closing a real discovery gap found evaluating Online Boutique. See `docs/architecture/PHASE_20_GO_LANGUAGE_SUPPORT.md`.

Real-repository evaluation (Phase 15) was extended with a third repository, Sock Shop (`microservices-demo` org, 8 services split across 8 separate repos) — a deliberately different kind of result from Online Boutique and the Spring sample: 17 of 21 findings are false positives traced to test fixtures, API-contract mocks, and code comments, quantifying a specific extraction gap rather than another clean score. Evaluating it surfaced and fixed four further real bugs (language misdetection, a `db_type` string-normalization bug, and two bugs blocking ground-truth auto-matching for real repositories). See `benchmarks/real_repo_sockshop.yml`.

## AI Baseline Comparison

An empirical comparison of MESA's deterministic static analysis against a general-purpose LLM (Claude Sonnet 5) prompted directly with MESA's own anti-pattern taxonomy, run 5 times per benchmark system to measure both accuracy and output determinism:

```text
mesa evaluate-ai-baseline <benchmark.yml> --systems <ids> --runs 5 --provider openai|anthropic
```

On the one real repository tested (`spring-sample`), the LLM scored F1 = 0.0000 with a 40% exact-match rate across 5 runs, against MESA's 1.0000/100% (deterministic by construction). See `docs/research/AI_BASELINE_COMPARISON.md` for the full methodology and results.
