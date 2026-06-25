# MESA Developer Guide

## Local Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Frontend:

```bash
cd frontend
npm install
npm run build
```

## Run Backend Locally

```bash
uvicorn mesa.api.main:app --reload
```

## Run Full Stack

```bash
docker compose up --build
```

## Test

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider
cd frontend && npm run build
```

## Main Backend Areas

| Area | Path |
|---|---|
| API | `src/mesa/api/main.py` |
| Static extraction | `src/mesa/analysis/extractor.py` |
| Pipeline | `src/mesa/analysis/pipeline.py` |
| Graph builder | `src/mesa/graph/builder.py` |
| Detectors | `src/mesa/detectors/` |
| Health score | `src/mesa/analysis/health.py` |
| Recommendations | `src/mesa/analysis/recommendations.py` |
| Governance | `src/mesa/analysis/governance.py` |
| Evolution | `src/mesa/analysis/evolution.py` |
| Evaluation | `src/mesa/evaluation/runner.py` |
| Persistence | `src/mesa/storage/` |

## Adding a Detector

1. Add a detector class under `src/mesa/detectors/`.
2. Return `Finding` objects with evidence and recommendation text.
3. Register it in `src/mesa/analysis/pipeline.py`.
4. Add structured recommendation handling if needed.
5. Add tests and benchmark ground truth.
