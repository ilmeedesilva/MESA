# Contributing to MESA

Thanks for helping. Bug reports, false-positive reports, docs fixes and new detectors are all
welcome. For anything larger than a small fix, please open an issue first so we can agree on the
approach.

## Set up

Backend (Python 3.10 or later):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Frontend (Node 22):

```bash
cd frontend
npm install
npm run dev      # development server on http://localhost:5173
```

Full stack with PostgreSQL and Neo4j:

```bash
docker compose up --build
```

Run only the API, with in-memory storage:

```bash
uvicorn mesa.api.main:app --reload
```

## Checks

Run these before opening a pull request. CI runs the same ones.

```bash
python -m pytest                    # tests
python -m pytest --cov=mesa         # with coverage
ruff check src tests                # lint
cd frontend && npm run build        # type check and build the UI
```

## Where things are

| Area | Path |
| --- | --- |
| CLI | `src/mesa/cli.py` |
| API | `src/mesa/api/main.py` |
| Repository ingestion | `src/mesa/ingestion/` |
| Service discovery | `src/mesa/discovery/service_candidates.py` |
| Static extraction | `src/mesa/analysis/extractor.py` |
| Pipeline | `src/mesa/analysis/pipeline.py` |
| Graph builder | `src/mesa/graph/builder.py` |
| Detectors | `src/mesa/detectors/` |
| Health score, recommendations, governance, gate, roadmap, evolution | `src/mesa/analysis/` |
| Evaluation runner and AI baseline | `src/mesa/evaluation/` |
| Storage (PostgreSQL, Neo4j, in-memory) | `src/mesa/storage/` |
| Web UI | `frontend/src/` |
| Test fixtures (small sample services) | `tests/fixtures/` |
| Benchmarks and ground truth | `benchmarks/` |

[How MESA works](docs/architecture.md) explains how these fit together.

## Adding a detector

1. Add a class under `src/mesa/detectors/` that implements `Detector.detect(graph)` and returns
   `Finding` objects. Fill in the evidence (with source file and line), `rule_id`,
   `confidence_reason`, `limitations` and `why_valid` fields, the same way the existing
   detectors do.
2. Register it in `src/mesa/analysis/pipeline.py`.
3. Add recommendation handling in `src/mesa/analysis/recommendations.py`.
4. Add a small fixture under `tests/fixtures/`, tests, and ground-truth labels in a benchmark
   manifest.
5. Document it in [docs/detectors.md](docs/detectors.md).

## Adding a benchmark

Benchmarks are YAML manifests in `benchmarks/`. Each system lists its `service_paths`, the
expected `ground_truth` findings (type and affected services), and `evaluator_notes` explaining
each labelling decision. Real repositories must be pinned to a commit: add them to
`scripts/fetch_benchmark_repos.py`, never commit their source. Run `mesa evaluate <manifest>` to
score MESA against it.

## Research results are protected

`benchmarks/results/v0.1.0-research/` holds the results published with the research and must
never be edited. If a change touches discovery, extraction, detectors or label matching:

1. Re-run all four benchmarks (see [benchmarks/results/README.md](benchmarks/results/README.md)).
2. If any number changes, say so in the pull request and in `CHANGELOG.md`, with the reason.
3. Write new results to a new folder, never over the research folder.

## Commits and pull requests

- Branch from `main`, one topic per pull request.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for messages, for example
  `fix: ignore comments when matching hard-coded URLs`.
- Add a `CHANGELOG.md` entry under "Unreleased" for anything a user would notice.
- Describe what changed, why, and how you tested it.

## Reporting a false positive

Open an issue with the finding (type, services, the evidence file and line), what is actually
there, and, if possible, a link to a public repository that shows it.
