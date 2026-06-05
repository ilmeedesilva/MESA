# Phase 10: Governance Policy Engine

Status: Implemented.

## Goal

Add architecture governance capability so users can define project-specific rules and have MESA enforce them during scans.

## Added

- Project-scoped governance policy models.
- PostgreSQL `policies` table and in-memory policy storage.
- YAML/JSON policy document import.
- Policy create, edit, list, and import APIs.
- Scan-time policy evaluation.
- Governance policy violations stored as normal MESA findings.
- Structured recommendations for governance violations.
- Frontend policy editor in the dashboard side rail.
- Automated API coverage for policy import, edit, scan execution, and persisted violation findings.

## API Endpoints

```text
GET /projects/{project_id}/policies
POST /projects/{project_id}/policies
PUT /projects/{project_id}/policies/{policy_id}
POST /projects/{project_id}/policies/import
```

Policy violations appear through existing scan endpoints:

```text
POST /projects/{project_id}/scans
GET /scans/{scan_id}/findings
GET /scans/{scan_id}
```

## Policy Format

Policies can be imported as YAML or JSON.

```yaml
policies:
  - id: no-cycles
    name: No cyclic dependencies
    rule: dependency_cycle_count == 0
    severity: critical
  - id: max-outbound-dependencies
    name: Maximum outbound dependencies
    rule: outbound_dependencies <= 5
    severity: high
  - id: no-hardcoded-service-urls
    name: No hard-coded service URLs
    rule: hard_coded_service_url_count == 0
    severity: high
```

Lowercase severities are accepted and normalized to MESA severities.

## Supported Metrics

System-level metrics:

- `dependency_cycle_count`
- `shared_database_violation_count`
- `hard_coded_service_url_count`
- `god_service_count`
- `finding_count`
- `service_count`
- `api_versioning_required`
- `unapproved_shared_library_count`

Service-level metrics:

- `outbound_dependencies`
- `inbound_dependencies`

Supported operators:

```text
== != <= >= < >
```

## Scan-Time Behavior

1. User creates or imports policies for a project.
2. User runs a project scan.
3. MESA performs normal static analysis and anti-pattern detection.
4. MESA evaluates all enabled project policies against the scan result.
5. Failed policies become `GOVERNANCE_POLICY_VIOLATION` findings.
6. Findings are persisted with the scan report and appear in the UI.

## Frontend Behavior

The dashboard side rail includes a Governance Policies editor.

Users can:

- edit policy YAML
- save policies to the selected project
- run a scan
- view policy violations in the Findings Dashboard

## How to Run

```bash
docker compose up --build
```

Open:

```text
http://localhost:5173
```

Create/select a project, save policies, then run a scan.

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

Manual API check:

```bash
curl -X POST http://localhost:8000/projects/<project_id>/policies/import   -H 'Content-Type: application/json'   -d '{"content":"policies:
  - id: no-cycles
    name: No cyclic dependencies
    rule: dependency_cycle_count == 0
    severity: critical
"}'
```

## Acceptance Criteria Mapping

- Policies can be created and edited: implemented by `POST /policies`, `PUT /policies/{policy_id}`, and YAML import upsert.
- Policies run during scan: implemented in `run_project_scan` before persistence.
- Policy violations are stored as findings: implemented as `GOVERNANCE_POLICY_VIOLATION` findings in the persisted scan result.
- UI includes policy editor: implemented in the dashboard side rail.

## Limitations

- Rule parsing intentionally supports simple comparison expressions only.
- Policy evaluation is static and uses MESA scan metrics, not runtime telemetry.
- Shared library approval is approximated by detecting libraries used by more than one service; an explicit allowlist can be added in a future phase.
- API versioning checks use endpoint path patterns such as `/v1/...`.
