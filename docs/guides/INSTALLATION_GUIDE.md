# MESA Installation Guide

## Prerequisites

- Docker Desktop
- Python 3.10+
- Node.js/npm for frontend development

## Recommended Docker Setup

```bash
docker compose up --build
```

Services:

| Service | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| FastAPI | `http://localhost:8000` |
| Swagger UI | `http://localhost:8000/docs` |
| Neo4j Browser | `http://localhost:7474` |

## Local Python Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest
```

## What To Install

The package is split so the command line installs quickly. Choose what you need:

| Install | You get |
| --- | --- |
| `pip install .` | The command line: `mesa scan`, `mesa ci`, `mesa gate`, `mesa analyze`, `mesa evaluate`. Needs only networkx, pydantic, typer, rich and PyYAML. |
| `pip install ".[api]"` | Also the web API (FastAPI, Uvicorn) and its PostgreSQL and Neo4j storage. |
| `pip install ".[ai]"` | Also the live AI explainer (Anthropic SDK). Without it, MESA uses its built-in grounded explainer. |
| `pip install ".[all]"` | Both extras. The Docker image uses this. |
| `pip install -e ".[dev]"` | Everything, plus the test and build tools. |

The command is available as both `mesa` and `mesa-analyzer`. If a feature needs an extra that
is not installed, MESA says which one, for example
`pip install "mesa-analyzer[ai]"`.

MESA is not published on PyPI yet; install it from a clone of this repository.

## Docker Platform

The images build for your machine's own platform (arm64 on Apple silicon, amd64 on most other
machines and on GitHub's runners). To build for a different one, set Docker's standard
variable, for example `DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose up --build`.

## Database Access

PostgreSQL runs inside Compose and is not exposed by default. Access it with:

```bash
docker compose exec postgres psql -U mesa -d mesa
```

Neo4j Browser:

```text
http://localhost:7474
neo4j / mesa-password
```

## Important Path Note

When using Docker Compose, scan paths must use the API container path `/workspace/...`, not local macOS paths.
