# Phase 1: Persistence Foundation

Status: Implemented.

## Goal

Persist project metadata, scan history, scan reports, services, dependencies, findings, scores, and snapshots instead of keeping scan results only in memory.

## Added

- PostgreSQL migration: `src/mesa/storage/migrations/001_persistence_foundation.sql`.
- Persistence repository abstraction.
- In-memory repository for tests and local fallback.
- PostgreSQL repository for durable persistence.
- FastAPI project and scan endpoints.
- Docker Compose API configuration for PostgreSQL persistence.

## Tables

- `projects`
- `scans`
- `services`
- `dependencies`
- `findings`
- `scores`
- `reports`
- `snapshots`

## API Endpoints

Legacy non-persistent endpoint remains available:

- `POST /analyze`

Persistent workflow endpoints:

- `POST /projects`
- `GET /projects/{project_id}`
- `POST /projects/{project_id}/scans`
- `GET /projects/{project_id}/scans`
- `GET /scans/{scan_id}`
- `GET /scans/{scan_id}/findings`

## Run With PostgreSQL Persistence

```bash
docker compose up --build
```

The API container uses:

```text
MESA_PERSISTENCE=postgres
MESA_POSTGRES_DSN=postgresql://mesa:mesa@postgres:5432/mesa
```

Open:

```text
http://localhost:8000/docs
```

## Example Persistent Flow

Create a project:

```bash
curl -X POST http://localhost:8000/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo Project"}'
```

Run a scan using the returned project ID:

```bash
curl -X POST http://localhost:8000/projects/<project_id>/scans \
  -H 'Content-Type: application/json' \
  -d '{
    "service_paths": [
      "/workspace/tests/fixtures/chatty/order-service",
      "/workspace/tests/fixtures/chatty/user-service"
    ]
  }'
```

Get scan history:

```bash
curl http://localhost:8000/projects/<project_id>/scans
```

Get scan result after restart:

```bash
curl http://localhost:8000/scans/<scan_id>
```

Get findings only:

```bash
curl http://localhost:8000/scans/<scan_id>/findings
```

## Tests

```bash
python3 -m pytest
python3 -m ruff check src tests
```

The automated tests use the in-memory persistence repository so CI does not require a live PostgreSQL service. The Docker Compose runtime uses PostgreSQL.

## Limitations

- No Alembic migration runner yet; Phase 1 uses a plain SQL migration executed by the repository initializer.
- The frontend still calls the legacy `/api/analyze` endpoint; wiring the UI to project/scan history is a follow-up phase.
- PostgreSQL persistence is implemented for scan/report data. Neo4j graph persistence remains an existing adapter scaffold and should be completed in the graph persistence phase.
- Scores table exists for the upcoming health score phase but is not populated yet.


## Docker Troubleshooting

If Docker fails with a BuildKit error such as:

```text
file sync error: sync /var/lib/docker/buildkit/containerd-overlayfs/metadata_v2.db: input/output error
```

This usually indicates Docker Desktop cache or disk-state corruption, not an application code error.

Recommended recovery:

```bash
docker compose down
```

Then restart Docker Desktop. If the error continues, clean the builder cache:

```bash
docker builder prune
```

Then rebuild:

```bash
docker compose build --no-cache
docker compose up
```

If Docker still fails, use Docker Desktop -> Troubleshoot -> Clean / Purge data. This removes local images, containers, volumes, and builder cache, so only use it when ordinary restart/prune does not work.


### Port 5432 Already In Use

If Compose fails with:

```text
listen tcp 0.0.0.0:5432: bind: address already in use
```

another PostgreSQL instance is already running on your Mac. MESA does not need PostgreSQL exposed to the host for normal Docker Compose usage, because the API reaches it through the Docker network using `postgres:5432`. The Compose file therefore uses `expose: 5432` instead of publishing `5432:5432`.

After this change, restart:

```bash
docker compose down
docker compose up --build
```


## Accessing PostgreSQL

The Compose file does not publish PostgreSQL to host port `5432` to avoid conflicts with local PostgreSQL installations. Access it through the running container:

```bash
docker compose exec postgres psql -U mesa -d mesa
```

Useful checks:

```sql
\dt
SELECT id, name, created_at FROM projects;
SELECT id, project_id, status, service_count, finding_count, created_at FROM scans;
SELECT scan_id, type, severity, description FROM findings;
SELECT scan_id, name, language, endpoint_count, outbound_call_count FROM services;
```

To exit `psql`:

```sql
\q
```

If you want to connect from a desktop database client, publish PostgreSQL on a non-conflicting host port, for example:

```yaml
ports:
  - "55432:5432"
```

Then connect to `localhost:55432` with database `mesa`, username `mesa`, password `mesa`.

## Frontend Path Notes

When running through Docker Compose, service paths must use the API container's mounted repo path:

```text
/workspace/tests/fixtures/chatty/order-service
/workspace/tests/fixtures/chatty/user-service
```

Using local relative paths such as `../tests/...` from the browser will not work reliably because the analysis runs inside the API container, not in the browser.
