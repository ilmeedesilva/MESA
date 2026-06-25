# Phase 2: Neo4j Architecture Graph

## Goal

Phase 2 converts MESA from a report-only static analyzer into an architectural knowledge graph system. PostgreSQL remains the durable system of record for projects, scans, findings, reports, and snapshots. Neo4j stores a queryable digital twin of each scan so MESA can answer architecture questions such as dependency paths, cycles, service centrality, shared database relationships, and high-risk dependency clusters.

## Implemented Scope

### Neo4j Connection Layer

MESA now includes `Neo4jArchitectureStore`, configured by environment variables:

- `MESA_NEO4J_ENABLED=true` enables graph persistence from the FastAPI scan endpoint.
- `MESA_NEO4J_URI`, default `bolt://localhost:7687`.
- `MESA_NEO4J_USER`, default `neo4j`.
- `MESA_NEO4J_PASSWORD`, default `mesa-password`.

Docker Compose enables Neo4j graph persistence for the API container.

### Persisted Graph Model

Each persistent scan writes a scan-scoped architecture graph to Neo4j.

Node labels currently populated from extracted static evidence:

- `Project`
- `Scan`
- `Service`
- `API`
- `Database`
- `Config`
- `Library`
- `MessageBroker`
- `EnvironmentVariable`

Relationship types currently populated:

- `HAS_SCAN`
- `CONTAINS`
- `OWNS`
- `DEPENDS_ON`
- `CALLS`
- `EXPOSES_API`
- `CONSUMES_API`
- `READS_FROM`
- `WRITES_TO`
- `SHARES_DATABASE_WITH`

`DEPENDS_ON` is the service-level query projection used for paths, cycles, centrality, and risk clusters. It is derived from static API calls and shared database coupling, while lower-level evidence remains available through `CALLS`, `READS_FROM`, `WRITES_TO`, and `SHARES_DATABASE_WITH`.

MESA only creates these nodes when static evidence is present. For example, libraries come from `requirements.txt`, environment variables come from `.env`/configuration-style files, and message brokers come from broker URL patterns such as `amqp://`, `kafka://`, and `mqtt://`.

## API Endpoints

The following endpoints query the Neo4j architecture graph for a completed scan:

```text
GET /scans/{scan_id}/graph
GET /scans/{scan_id}/graph/paths?source={service}&target={service}&max_depth=4
GET /scans/{scan_id}/graph/cycles?max_depth=6
GET /scans/{scan_id}/graph/centrality
GET /scans/{scan_id}/graph/shared-databases
GET /scans/{scan_id}/graph/high-risk-clusters?degree_threshold=3
```

If `MESA_NEO4J_ENABLED` is not enabled, graph query endpoints return `503` with a clear message. The existing `/analyze` endpoint remains a lightweight non-persistent analysis endpoint and does not write to Neo4j.

## How to Run

Start the full stack:

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:5173`
- FastAPI docs: `http://localhost:8000/docs`
- Neo4j Browser: `http://localhost:7474`

Neo4j credentials in the development Docker stack:

```text
username: neo4j
password: mesa-password
```

## Manual Verification Workflow

Create a project:

```bash
curl -X POST http://localhost:8000/projects   -H 'Content-Type: application/json'   -d '{"name":"Phase 2 Demo"}'
```

Run a persistent scan using the returned project id:

```bash
curl -X POST http://localhost:8000/projects/{project_id}/scans   -H 'Content-Type: application/json'   -d '{
    "service_paths": [
      "/workspace/tests/fixtures/chatty/order-service",
      "/workspace/tests/fixtures/chatty/user-service"
    ],
    "chatty_threshold": 3
  }'
```

Query the persisted architecture graph using the returned scan id:

```bash
curl http://localhost:8000/scans/{scan_id}/graph
curl 'http://localhost:8000/scans/{scan_id}/graph/paths?source=order-service&target=user-service'
curl http://localhost:8000/scans/{scan_id}/graph/cycles
curl http://localhost:8000/scans/{scan_id}/graph/centrality
```

In Neo4j Browser, inspect the scan graph:

```cypher
MATCH (n {scan_id: "{scan_id}"})-[r]->(m {scan_id: "{scan_id}"})
RETURN n, r, m;
```

Find dependency cycles directly in Neo4j:

```cypher
MATCH path=(s:Service {scan_id: "{scan_id}"})-[:DEPENDS_ON*2..6]->(s)
RETURN [node IN nodes(path) | node.name] AS cycle;
```

Find dependency paths:

```cypher
MATCH path=(a:Service {scan_id: "{scan_id}", name: "order-service"})
  -[:DEPENDS_ON*1..4]->
  (b:Service {scan_id: "{scan_id}", name: "user-service"})
RETURN [node IN nodes(path) | node.name] AS path, length(path) AS length;
```

## Acceptance Criteria Status

- After a persistent scan, Neo4j receives a scan-scoped architecture graph.
- Cycles can be queried through `/graph/cycles` and direct Cypher.
- Service dependency paths can be queried through `/graph/paths` and direct Cypher.
- Graph data is derived from the same `AnalysisResult.graph` used by PostgreSQL persistence and detector findings.

## Tests

Run local tests without a live Neo4j instance:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider
python3 -m ruff check src tests --no-cache
```

The API tests use a fake architecture store to verify that scans write to the graph boundary and that the graph query routes are exposed. End-to-end Neo4j validation is performed through Docker Compose and the manual verification workflow above.

## Current Limitations

- `Library`, `MessageBroker`, and `EnvironmentVariable` extraction is intentionally lightweight and pattern-based; deeper package-lock, Maven, Gradle, Docker Compose, and Kubernetes extraction belongs in a later phase.
- `READS_FROM` and `WRITES_TO` are conservative static relationships from database connection evidence. The current extractor does not yet distinguish read-only from write-only database usage.
- Centrality is currently degree-based from `DEPENDS_ON` relationships. Richer graph metrics can be added in later phases.
- The frontend still visualizes the API analysis result directly; wiring it to persisted Neo4j graph query endpoints is a future UI enhancement.
