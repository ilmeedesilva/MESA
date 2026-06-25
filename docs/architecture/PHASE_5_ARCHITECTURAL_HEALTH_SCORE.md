# Phase 5: Architectural Health Score

## Goal

Phase 5 introduces one of MESA's core novelty features: deterministic architectural health scoring. The health engine converts static analysis evidence, graph structure, and anti-pattern findings into explainable quality scores at three levels:

1. Service-level health score
2. Domain-level health score
3. System-level health score

This turns MESA from a detector into an architectural assessment platform suitable for tracking quality, comparing scans, and supporting architecture governance.

## Score Output

Health scores are returned in every analysis result under:

```json
"summary": {
  "health_scores": {
    "service": [],
    "domain": [],
    "system": {}
  }
}
```

Each score contains:

- numeric score from `0` to `100`
- grade: `Excellent`, `Good`, `Moderate`, `Poor`, or `Critical`
- dimension breakdown
- explanation
- improvement recommendations

## Score Levels

### Service-Level Score

Calculated for each analyzed service. Uses direct service facts, graph relationships, linked findings, and God Service score.

### Domain-Level Score

Groups services by inferred domain name. For the current implementation, the domain is derived from the service name prefix before `-service` or `_service`. Domain scores aggregate service health dimension by dimension.

### System-Level Score

Aggregates all service scores and applies small systemic penalties when the architecture contains cross-cutting risks such as cycles, shared persistence, or large domain score spread.

## Dimensions

MESA calculates nine health dimensions. Each dimension is scored from `0` to `100`, where `100` means healthier architecture.

| Dimension | Meaning |
| --- | --- |
| Coupling | How heavily a service depends on or is depended on by other services. |
| Cohesion | Whether a service appears focused on a bounded set of domain concepts. |
| Cyclic dependencies | Penalty for dependency cycles involving the service. |
| Shared database usage | Penalty for shared persistence relationships. |
| Hard-coded dependency risk | Penalty for hard-coded service URLs, private IPs, or local endpoints. |
| God Service risk | Inverse of the Phase 4 God Service risk score. |
| API complexity | Penalty for excessive API exposure. |
| Deployment independence | Whether a service can plausibly change/deploy independently. |
| Ownership clarity | Whether data/API/domain responsibility appears clearly owned. |

## Dimension Weights

The final score is a weighted average of the nine dimensions.

| Dimension | Weight |
| --- | ---: |
| Coupling | 0.14 |
| Cohesion | 0.12 |
| Cyclic dependencies | 0.12 |
| Shared database usage | 0.11 |
| Hard-coded dependency risk | 0.10 |
| God Service risk | 0.13 |
| API complexity | 0.09 |
| Deployment independence | 0.10 |
| Ownership clarity | 0.09 |

Formula:

```text
health_score = sum(dimension_score * dimension_weight)
```

## Grade Thresholds

| Score | Grade |
| ---: | --- |
| 85-100 | Excellent |
| 70-84.99 | Good |
| 50-69.99 | Moderate |
| 30-49.99 | Poor |
| 0-29.99 | Critical |

## Persistence

Health scores are persisted in two ways:

1. Full report JSON in the `reports` table.
2. Dedicated rows in the existing `scores` table.

The `scores` table stores:

- `scan_id`
- `scope`: `service`, `domain`, or `system`
- `target`: service/domain/system identifier
- `score`
- full score payload in `breakdown` JSONB

No new migration is required because Phase 1 already introduced the `scores` table.

## API Endpoints

Health scores appear in existing scan responses:

```text
POST /analyze
POST /projects/{project_id}/scans
GET /scans/{scan_id}
```

Phase 5 also adds a dedicated endpoint:

```text
GET /scans/{scan_id}/scores
```

This endpoint returns all persisted service, domain, and system scores for the scan.

## Example API Test

```bash
curl -X POST http://localhost:8000/analyze   -H 'Content-Type: application/json'   -d '{
    "service_paths": [
      "/workspace/tests/fixtures/god/platform-service",
      "/workspace/tests/fixtures/god/order-service",
      "/workspace/tests/fixtures/god/billing-service",
      "/workspace/tests/fixtures/god/inventory-service",
      "/workspace/tests/fixtures/god/user-service",
      "/workspace/tests/fixtures/god/payment-service",
      "/workspace/tests/fixtures/god/notification-service"
    ]
  }'
```

Look for:

```json
"health_scores": {
  "service": [...],
  "domain": [...],
  "system": {...}
}
```

## Persistent Scan Test

```bash
curl -X POST http://localhost:8000/projects   -H 'Content-Type: application/json'   -d '{"name":"Phase 5 Health Score Test"}'
```

Then run a persistent scan and query:

```bash
curl http://localhost:8000/scans/{scan_id}/scores
```

Expected result: a list containing at least one `system` score and one or more `service` scores.

## Determinism

The score calculation is deterministic because:

- service names are sorted before scoring
- domain groups are sorted
- dimension weights and penalties are constant
- scores are calculated only from static scan evidence and generated findings

## Acceptance Criteria Status

- Health score is generated after each scan.
- Scores are persisted in report JSON and dedicated score rows.
- API exposes scores through scan result responses and `/scans/{scan_id}/scores`.
- Score calculation is deterministic and explainable.
- Tests cover score generation, API exposure, and deterministic repeatability.

## Current Limitations

- Domain grouping is name-based and should be improved with explicit ownership metadata later.
- Cohesion uses domain keyword breadth as a static proxy, not semantic domain modeling.
- Database ownership clarity is inferred from database connection evidence until schema/table extraction is expanded.
- Runtime deployment independence is estimated from static coupling evidence only.
