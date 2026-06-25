# Phase 3: Hard-Coded Service Dependencies Detector

## Goal

Phase 3 adds a detector for services that directly reference other services using hard-coded URLs, IP addresses, ports, or service-like hostnames. This addresses the microservices anti-pattern where service communication is coupled to fixed deployment addresses instead of service discovery, configuration boundaries, or environment-specific infrastructure.

## Implemented Scope

MESA now extracts hard-coded dependency evidence from:

- Python files
- JavaScript / TypeScript files
- Java files
- `.env` files
- Docker Compose YAML
- Kubernetes/application YAML-style configuration
- `application.yml` / `application.yaml`
- `package.json`
- `pom.xml`
- `.properties`, `.json`, and `.xml` files

Detected examples include:

- `http://user-service:8080`
- `http://localhost:3001`
- `10.0.0.5:8080`
- service-like hostnames such as `payment-service` or `inventory-service`
- duplicated service URLs across a scanned service

## Detection Design

The extractor records `HardCodedDependency` evidence on each `ServiceFacts` object. The graph builder attaches this evidence to service nodes, and `HardCodedServiceDependencyDetector` converts the evidence into findings.

The detector reports:

- anti-pattern name
- severity
- confidence score
- affected service
- file path
- line number when available
- concrete evidence value
- explanation
- recommendation

## False Positive Controls

The detector intentionally ignores ordinary external URLs such as `https://docs.example.com/reference` unless they resemble local/service infrastructure. A host is treated as suspicious only when it is one of the following:

- `localhost`, `127.0.0.1`, or `0.0.0.0`
- private or loopback IP address
- service-style hostname ending in `-service`, `-svc`, or `service`
- single-label hyphenated hostname such as `inventory-api`

Database URLs are handled by the existing shared persistence logic and are not treated as HTTP service dependencies.

## Severity and Confidence

Source-code findings are higher risk than configuration findings because they usually require code edits to change deployment topology.

- `HIGH`: source files containing private IPs or local endpoints.
- `MEDIUM`: source files containing service hostnames, or duplicated endpoints.
- `LOW`: configuration-level endpoint evidence with no duplication.

Confidence increases when evidence is in source code, uses local/private infrastructure, or appears more than once.

## Persistence and API Behavior

No new PostgreSQL migration is required. Phase 1 already persists all findings and full report JSON. Therefore Phase 3 findings automatically appear in:

```text
POST /analyze
POST /projects/{project_id}/scans
GET /scans/{scan_id}
GET /scans/{scan_id}/findings
```

The finding type is:

```text
HARD_CODED_SERVICE_DEPENDENCY
```

## How to Run

Start the application:

```bash
docker compose up --build
```

Run a scan from the API docs at:

```text
http://localhost:8000/docs
```

Example non-persistent API request:

```bash
curl -X POST http://localhost:8000/analyze   -H 'Content-Type: application/json'   -d '{
    "service_paths": [
      "/workspace/tests/fixtures/hardcoded/order-service",
      "/workspace/tests/fixtures/hardcoded/billing-service"
    ]
  }'
```

## How to Test

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider
python3 -m ruff check src tests --no-cache
```

## Acceptance Criteria Status

- Hard-coded service URLs are detected.
- Obvious external URL false positives are avoided.
- Findings are persisted through the existing Phase 1 report/finding persistence path.
- Findings appear in API responses.

## Current Limitations

- JavaScript, TypeScript, Java, YAML, JSON, XML, and Maven files are scanned with regex-based text analysis. Deeper AST/parser-specific extraction can be added later.
- The detector classifies service-like hostnames conservatively. Some valid internal DNS names without hyphens or service suffixes may not be flagged yet.
- The current phase detects hard-coded dependencies but does not automatically rewrite them into service discovery or configuration abstractions.
