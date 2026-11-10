# CI And The GitHub Action

MESA can check every pull request for new architecture problems: it comments with what is
new, where it is and how to fix it, and fails the check only when the change makes the
architecture worse. The easiest way is the MESA GitHub Action. The same check also runs with
the `mesa` command line in any CI system.

## GitHub Action

Add this workflow to a repository with microservices:

```yaml
# .github/workflows/architecture.yml
name: Architecture check

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write # for the pull request comment

jobs:
  mesa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: ilmeedesilva/MESA@<commit-sha> # pin a full commit SHA
```

Coming in 1.0: the Action as `uses: ilmeedesilva/mesa-action@v1` on the GitHub Marketplace,
installing MESA from PyPI. The inputs and outputs below stay the same.

On every pull request the Action:

1. installs MESA into its own environment (your job's Python is not changed),
2. scans the pull request and its base commit (it fetches the base commit itself, so `fetch-depth: 0` is not needed),
3. creates one comment on the pull request and updates it on later pushes,
4. writes the full report to the job summary and adds annotations for new findings,
5. uploads `report.md`, `gate.json`, `mesa.sarif` and both scans as the `mesa-reports` artifact,
6. fails the check when the change adds a problem (new-only mode, below).

MESA only reads files. It never installs or runs the repository's code, so it is safe for
pull requests from forks. Their token cannot write comments; the Action then reports in the job
summary only. Do not use `pull_request_target` for this.

### Example With Options

A monorepo with its services under `services/`, stricter about new problems, with findings
also shown in GitHub code scanning:

```yaml
permissions:
  contents: read
  pull-requests: write
  security-events: write # for the SARIF upload

jobs:
  mesa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: ilmeedesilva/MESA@<commit-sha>
        with:
          path: services
          fail-on-new-severity: MEDIUM
          max-health-drop: 2
          sarif: true
```

Code scanning must be available for the repository (it is for public repositories).

To try MESA without blocking anyone, set `fail-on-violation: false`: the comment and report
still appear, but the check always passes.

### Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `path` | `.` | Folder to scan (for monorepos). |
| `config` | (empty) | Config file; empty means `.mesa.yml` in `path`, if present. |
| `mode` | (config, `new-only`) | `new-only` or `absolute`. |
| `fail-on-violation` | `true` | `false` reports without failing the check. |
| `comment` | `true` | Create or update the pull request comment. |
| `sarif` | `false` | Upload `mesa.sarif` to code scanning (needs `security-events: write`). |
| `max-health-drop` | (config, `5`) | Largest allowed health score drop. |
| `fail-on-new-severity` | (config, `HIGH`) | `LOW`, `MEDIUM`, `HIGH` or `CRITICAL`. |
| `base-ref` | pull request base | Commit to compare with; `none` for absolute mode. |
| `python-version` | `3.12` | Python used to run MESA. |
| `artifact-name` | `mesa-reports` | Artifact name; empty skips the upload. |
| `github-token` | `github.token` | Token for the comment. |

### Outputs

`status` (`passed` or `failed`), `health-score`, `health-delta`, `new-findings`,
`fixed-findings`, `report-markdown`, `report-json`, `report-sarif`.

For example, to use the result in a later step, give the MESA step an `id: mesa` and read
`${{ steps.mesa.outputs.new-findings }}`.

### On The Main Branch

On a push (no pull request) the Action scans once with fixed thresholds and posts no comment.
Use `fail-on-violation: false` there if the main branch has existing problems.

## What Fails The Check

| Mode | Fails when | Use it for |
| --- | --- | --- |
| `new-only` | a change *adds* a problem: a new finding at or above a severity (default `HIGH`), a health score drop larger than allowed (default `5`), a new cycle or a new governance violation | pull requests. Problems that already existed do not block. |
| `absolute` | the whole scan breaks fixed thresholds (rules below) | the main branch, or a repository with no existing debt |

The Action and `mesa ci` use `new-only` when they have a base commit to compare with, and
`absolute` otherwise. `mesa gate` and the API use `absolute` unless you ask for `new-only`.

The absolute gate fails when:

- system health score is below `75`
- critical findings exceed `0`
- cyclic dependencies are detected
- governance policy violations are detected
- high-risk service coupling is detected

High-risk service coupling currently includes high or critical findings for chatty service communication, hard-coded service dependencies, and shared database access.

## Configuration File (`.mesa.yml`)

Optional, for the Action and the command line. Without it, the defaults below apply. Unknown
keys are errors, so typos are reported.

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
comparison is fair. Inputs given to the Action override the file.

## Without The Action (`mesa ci`)

The same check with the command line, in GitHub Actions or any other CI system:

```yaml
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # the base commit must be available
      - uses: actions/setup-python@v7
        with:
          python-version: "3.12"
      - run: pip install "mesa-analyzer @ git+https://github.com/ilmeedesilva/MESA@<commit-sha>"
      - run: mesa ci --base-ref "${{ github.event.pull_request.base.sha }}" --out-dir mesa-out
```

Coming in 1.0: `pip install mesa-analyzer` from PyPI.

`mesa ci` scans the working tree and the base commit, compares them, and fails only on new
problems:

```bash
mesa ci --base-ref origin/main --out-dir mesa-out
```

It finds the services itself (tests, fixtures, examples and docs folders are skipped), scans
the base commit in a temporary `git worktree` with the same settings, and writes to
`mesa-out/`:

| File | Contents |
| --- | --- |
| `report.md` | The pull request comment: new problems with file:line, why they matter and how to fix them; fixed and existing problems collapsed. Stays under GitHub's comment size limit. |
| `mesa.sarif` | SARIF 2.1.0 for GitHub code scanning (`github/codeql-action/upload-sarif`), so findings show inline on the changed files. |
| `gate.json` | The full gate result, including every new and fixed finding. |
| `head.json`, `base.json` | The two scans. |

On GitHub Actions it also writes the job summary (the same report, not shortened), the step
outputs `status`, `health-score`, `health-delta`, `new-findings`, `fixed-findings`,
`report-markdown`, `report-sarif` and `report-json`, and annotations for the first ten new
findings (`--annotations` turns them on elsewhere). File links in the report point at the
commit given with `--head-sha` (default: the checked-out commit). Posting the comment is done
by the Action, not by `mesa ci`; elsewhere, post `report.md` with your CI system's own tools.

Exit codes: `0` passed, `1` the gate failed (use `--no-fail` to only report), `2` a usage or
configuration error.

Options: `--path` (folder to scan inside the repository), `--config`, `--policy`, `--mode`,
`--max-health-drop`, `--fail-on-new-severity`.

## Other Commands

### Scan A Repository (`mesa scan`)

```bash
mesa scan .                      # finds the services and prints the findings
mesa scan . -o report.json       # JSON report with paths relative to the folder
mesa gate --report report.json   # check a saved report
mesa gate --report head.json --baseline-report base.json --mode new-only --format markdown
mesa gate --report report.json --format sarif -o mesa.sarif
```

`--format` is `json` (default), `text`, `markdown` (the pull request comment) or `sarif`.

### Gate Named Service Folders (`mesa gate`)

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

Example output (shortened):

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

## API Usage

For a scan stored on a MESA server. Default thresholds:

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
