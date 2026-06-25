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
