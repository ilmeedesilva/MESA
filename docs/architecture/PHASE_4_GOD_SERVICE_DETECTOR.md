# Phase 4: God Service Detector

## Goal

Phase 4 detects services that are becoming too large, too central, or responsible for too many system capabilities. Unlike simple size checks, MESA uses a weighted architectural scoring model that combines API exposure, graph dependency position, ownership breadth, module volume, domain breadth, and already-detected architecture findings.

## Output

Every analyzed service receives a God Service score in the API response summary:

```json
"summary": {
  "god_service_scores": [
    {
      "service": "platform-service",
      "score": 78.5,
      "severity": "HIGH",
      "metrics": {},
      "contributions": {},
      "explanation": "...",
      "recommendation": "..."
    }
  ]
}
```

High-risk services also produce a finding with type:

```text
GOD_SERVICE
```

## Metrics

The score is calculated from eight weighted metrics. Each metric is normalized and capped so one dimension cannot dominate the whole result.

| Metric | Weight | Normalizer | Meaning |
| --- | ---: | ---: | --- |
| API exposure | 15 | 10 APIs | Number of exposed endpoints. |
| Inbound dependencies | 15 | 5 services | Other services depending on this service. |
| Outbound dependencies | 15 | 5 services | Services this service depends on. |
| Database ownership | 10 | 3 databases/entities | Persistence/data ownership breadth. |
| File/module volume | 15 | 20 files | Static size and implementation breadth. |
| Domain breadth | 10 | 8 keywords | Number of domain concepts handled. |
| Centrality | 10 | 1.0 | Directed graph centrality approximation. |
| Linked findings | 10 | 5 findings | Existing anti-pattern findings involving the service. |

Formula:

```text
score = min(sum(normalized_metric * metric_weight), 100)
```

Centrality is estimated as:

```text
(inbound_dependency_count + outbound_dependency_count) / (2 * (service_count - 1))
```

## Severity Thresholds

| Score | Severity | Behavior |
| ---: | --- | --- |
| 0-49.99 | LOW | Score reported only. |
| 50-69.99 | MEDIUM | Score reported only. |
| 70-84.99 | HIGH | God Service finding generated. |
| 85-100 | CRITICAL | God Service finding generated. |

## Evidence Extraction

MESA extracts supporting metrics statically:

- API count from endpoint decorators.
- Dependency counts from service graph edges.
- Database/entity count from database connection evidence.
- File/module count from analyzed source/config files.
- Domain keywords from file names, endpoint paths, database names, and outbound URL paths.
- Linked findings from previous detectors in the same scan.

## Recommendation Strategy

The generated recommendation explains why the service was flagged and suggests decomposition actions:

- Split cohesive capabilities into separate services or modules.
- Move read-heavy APIs behind query/read models.
- Reduce direct outbound dependencies through events or orchestration.
- Assign clear data ownership.
- Re-run MESA after each decomposition step to confirm the score decreases.

## API Behavior

No new API endpoint is required. Scores and findings appear in existing responses:

```text
POST /analyze
POST /projects/{project_id}/scans
GET /scans/{scan_id}
GET /scans/{scan_id}/findings
```

The Phase 1 persistence layer stores the generated `GOD_SERVICE` findings and full report JSON automatically.

## How to Run

```bash
docker compose up --build
```

Example request:

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

Check:

- `summary.god_service_scores`
- findings with `type = GOD_SERVICE`

## How to Test

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider
python3 -m ruff check src tests --no-cache
```

## Acceptance Criteria Status

- Each service receives a God Service score.
- High-risk services are flagged with `GOD_SERVICE` findings.
- Scoring logic is documented with weights and thresholds.
- Unit tests cover scoring thresholds and fixture-based detection.

## Current Limitations

- Domain keyword extraction is heuristic and intentionally conservative.
- Database table/entity ownership is approximated from database connection evidence until deeper ORM/schema extraction is added.
- Centrality uses NetworkX-derived service graph relationships from static evidence rather than runtime traffic volume.
- The detector recommends decomposition steps but does not automatically refactor code.
