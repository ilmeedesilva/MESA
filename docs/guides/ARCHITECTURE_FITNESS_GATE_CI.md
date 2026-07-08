# Architecture Fitness Gate CI Guide

MESA can produce a pass/fail architecture fitness gate report for CI/CD.

## Gate Rules

The default gate fails when:

- system health score is below `75`
- critical findings exceed `0`
- cyclic dependencies are detected
- governance policy violations are detected
- high-risk service coupling is detected

High-risk service coupling currently includes high or critical findings for chatty service communication, hard-coded service dependencies, and shared database access.

## CLI Usage

```bash
mesa gate services/order-service services/payment-service --output mesa-gate.json
```

Override thresholds:

```bash
mesa gate services/order-service services/payment-service \
  --minimum-health-score 80 \
  --maximum-critical-findings 0 \
  --output mesa-gate.json
```

Compare against a previous report:

```bash
mesa analyze services/order-service services/payment-service --output baseline-report.json
mesa gate services/order-service services/payment-service \
  --baseline-report baseline-report.json \
  --output mesa-gate.json
```

## API Usage

Default thresholds:

```bash
curl http://localhost:8000/scans/{scan_id}/gate
```

Custom thresholds:

```bash
curl -X POST http://localhost:8000/scans/{scan_id}/gate \
  -H 'Content-Type: application/json' \
  -d '{
    "thresholds": {
      "minimum_health_score": 80,
      "maximum_critical_findings": 0,
      "allow_new_cyclic_dependencies": false,
      "allow_governance_violations": false,
      "allow_new_high_risk_coupling": false
    }
  }'
```

## GitHub Actions Example

```yaml
name: MESA Architecture Gate

on:
  pull_request:

jobs:
  architecture-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install MESA
        run: pip install -e ".[dev]"

      - name: Run architecture gate
        run: |
          mesa gate services/order-service services/payment-service \
            --minimum-health-score 75 \
            --maximum-critical-findings 0 \
            --output mesa-gate.json

      - name: Upload gate report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mesa-gate-report
          path: mesa-gate.json
```

## Example Output

```json
{
  "status": "failed",
  "health_score": 68,
  "threshold": 75,
  "failed_rules": [
    "minimum_health_score",
    "critical_findings_exceeded",
    "cyclic_dependency_detected"
  ]
}
```

