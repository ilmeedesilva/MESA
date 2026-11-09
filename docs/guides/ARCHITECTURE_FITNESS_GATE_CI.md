# Architecture Fitness Gate CI Guide

MESA can produce a pass/fail architecture fitness gate report for CI/CD.

## Two Modes

| Mode | Fails when | Use it for |
| --- | --- | --- |
| `new-only` | a change *adds* a problem: a new finding at or above a severity (default `HIGH`), a health score drop larger than allowed (default `5`), a new cycle or a new governance violation | pull requests. Problems that already existed do not block. |
| `absolute` | the whole scan breaks fixed thresholds (rules below) | the main branch, or a repository with no existing debt |

`mesa ci` uses `new-only` when it has a base commit to compare with, and `absolute` otherwise.
`mesa gate` and the API use `absolute` unless you ask for `new-only`.

## Gate Rules

The default (absolute) gate fails when:

- system health score is below `75`
- critical findings exceed `0`
- cyclic dependencies are detected
- governance policy violations are detected
- high-risk service coupling is detected

High-risk service coupling currently includes high or critical findings for chatty service communication, hard-coded service dependencies, and shared database access.

## Check A Pull Request (`mesa ci`)

`mesa ci` scans the working tree and the base commit, compares them, and fails only on new
problems:

```bash
mesa ci --base-ref origin/main --out-dir mesa-out
```

It finds the services itself (tests, fixtures, examples and docs folders are skipped), scans
the base commit in a temporary `git worktree` with the same settings, and writes
`head.json`, `base.json`, `gate.json` and `summary.md` to `mesa-out/`. On GitHub Actions it
also writes the step summary and the step outputs `status`, `health-score`, `health-delta`,
`new-findings` and `fixed-findings`.

Exit codes: `0` passed, `1` the gate failed (use `--no-fail` to only report), `2` a usage or
configuration error.

Options: `--path` (folder to scan inside the repository), `--config`, `--policy`, `--mode`,
`--max-health-drop`, `--fail-on-new-severity`.

## Scan A Repository (`mesa scan`)

```bash
mesa scan .                      # finds the services and prints the findings
mesa scan . -o report.json       # JSON report with paths relative to the folder
mesa gate --report report.json   # check a saved report
```

## Configuration File (`.mesa.yml`)

Optional. Without it, the defaults below apply. Unknown keys are errors, so typos are reported.

```yaml
services:
  include: ["services/*"]      # default: automatic discovery
  exclude: ["legacy/**"]       # added to the default excludes
  default_excludes: true       # skip tests, fixtures, examples, docs, vendor, ...
gate:
  mode: new-only               # or absolute
  max_health_drop: 5.0
  fail_on_new_severity: HIGH   # LOW, MEDIUM, HIGH or CRITICAL
  minimum_health_score: 75     # absolute mode
  maximum_critical_findings: 0 # absolute mode
chatty_threshold: 3
policies: .mesa/policies.yml   # optional governance rules, relative to this file
```

On a pull request, the configuration from the pull request is used for both scans, so the
comparison is fair.

## CLI Usage With Service Paths

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
name: Architecture check

on:
  pull_request:

permissions:
  contents: read

jobs:
  mesa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # the base commit must be available

      - uses: actions/setup-python@v7
        with:
          python-version: "3.12"

      - name: Install MESA
        run: pip install "mesa-analyzer @ git+https://github.com/ilmeedesilva/MESA@main"

      - name: Run architecture check
        run: mesa ci --base-ref "${{ github.event.pull_request.base.sha }}" --out-dir mesa-out

      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mesa-reports
          path: mesa-out/
```

A ready-made GitHub Action that also comments on the pull request is planned.

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
