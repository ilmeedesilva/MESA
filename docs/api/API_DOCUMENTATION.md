# MESA API Documentation

FastAPI interactive documentation is available at:

```text
http://localhost:8000/docs
```

## Health

```text
GET /health
```

## One-Off Analysis

```text
POST /analyze
```

Body:

```json
{"service_paths": ["tests/fixtures/chatty/order-service", "tests/fixtures/chatty/user-service"]}
```

## Repository Ingestion Preview

```text
POST /repo-scans/preview
```

Body examples:

Local directory:

```json
{
  "source_type": "LOCAL_PATH",
  "location": "/workspace/tests/fixtures/chatty"
}
```

Archive file:

```json
{
  "source_type": "ARCHIVE_PATH",
  "location": "/workspace/snapshots/chatty.zip"
}
```

GitHub repository:

```json
{
  "source_type": "GITHUB_URL",
  "location": "https://github.com/example-org/example-repo",
  "ref": "main"
}
```

## Projects and Scans

```text
POST /projects
GET /projects/{project_id}
POST /projects/{project_id}/scans
POST /projects/{project_id}/repo-scans
GET /projects/{project_id}/scans
GET /scans/{scan_id}
GET /scans/{scan_id}/findings
GET /scans/{scan_id}/scores
```

Repository-backed project scan example:

```json
{
  "source_type": "LOCAL_PATH",
  "location": "/workspace/tests/fixtures/chatty",
  "service_paths": ["order-service", "user-service"]
}
```

## Graph APIs

```text
GET /scans/{scan_id}/graph
GET /scans/{scan_id}/graph/paths?source=<service>&target=<service>
GET /scans/{scan_id}/graph/cycles
GET /scans/{scan_id}/graph/centrality
GET /scans/{scan_id}/graph/shared-databases
GET /scans/{scan_id}/graph/high-risk-clusters
```

## Evolution APIs

```text
GET /projects/{project_id}/snapshots
GET /projects/{project_id}/evolution
GET /projects/{project_id}/evolution/compare?base_scan_id=<old>&target_scan_id=<new>
```

## Governance APIs

```text
GET /projects/{project_id}/policies
POST /projects/{project_id}/policies
PUT /projects/{project_id}/policies/{policy_id}
POST /projects/{project_id}/policies/import
```

Policy import body:

```json
{
  "content": "policies:
  - id: no-cycles
    name: No cyclic dependencies
    rule: dependency_cycle_count == 0
    severity: critical
"
}
```
