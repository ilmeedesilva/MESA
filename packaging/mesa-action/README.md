<!-- Draft for the public ilmeedesilva/mesa-action repository, copied there on release day.
     Before publishing: set MESA_VERSION in action.yml, add the LICENSE, and check every link. -->

# MESA Architecture Check

**Find architecture problems in your microservices before they reach main.**

This Action checks every pull request for new microservice architecture problems: cyclic
dependencies, shared databases, hard-coded service addresses, chatty services and god
services. It posts one comment on the pull request with each new problem, the file and line,
why it matters and how to fix it, and fails the check only when the change makes the
architecture worse. Problems that were already there do not block you.

It is static analysis: your code is never run, and the check needs no API keys or external
service. It runs [MESA](https://github.com/ilmeedesilva/MESA), installed from PyPI at a fixed
version.

## Use it in 30 seconds

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
      - uses: ilmeedesilva/mesa-action@v1
```

On every pull request the Action:

1. installs MESA into its own Python environment (your job's Python is not changed),
2. scans the pull request and its base commit (it fetches the base commit itself, so `fetch-depth: 0` is not needed),
3. creates one comment on the pull request and updates it on later pushes,
4. writes the full report to the job summary and adds annotations for new findings,
5. uploads `report.md`, `gate.json`, `mesa.sarif` and both scans as the `mesa-reports` artifact,
6. fails the check when the change adds a problem.

`@v1` follows the latest 1.x release. To pin an exact release, use a tag such as `@v1.0.0` or
a full commit SHA.

## Example with options

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
      - uses: ilmeedesilva/mesa-action@v1
        with:
          path: services
          fail-on-new-severity: MEDIUM
          max-health-drop: 2
          sarif: true
```

To try it without blocking anyone, set `fail-on-violation: false`: the comment and report still
appear, but the check always passes.

## Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `path` | `.` | Folder to scan, relative to the repository root (for monorepos). |
| `config` | (empty) | Config file; empty means `.mesa.yml` in `path`, if present. |
| `mode` | (config, `new-only`) | `new-only` blocks only new problems; `absolute` uses fixed thresholds. |
| `fail-on-violation` | `true` | `false` reports without failing the check. |
| `comment` | `true` | Create or update one comment on the pull request. |
| `sarif` | `false` | Upload `mesa.sarif` to code scanning (needs `security-events: write`). |
| `max-health-drop` | (config, `5`) | Largest allowed health score drop (new-only mode). |
| `fail-on-new-severity` | (config, `HIGH`) | New findings at this severity or above fail the check: `LOW`, `MEDIUM`, `HIGH` or `CRITICAL`. |
| `base-ref` | pull request base | Commit to compare with; `none` for no comparison (absolute mode). |
| `python-version` | `3.12` | Python used to run MESA. Your job's own Python is not changed. |
| `artifact-name` | `mesa-reports` | Name of the reports artifact; empty skips the upload. |
| `github-token` | `github.token` | Token used for the pull request comment. |

## Outputs

| Output | Meaning |
| --- | --- |
| `status` | `passed` or `failed`. |
| `health-score` | System health score of the scanned code. |
| `health-delta` | Change of the health score against the base commit (empty without one). |
| `new-findings` | Number of findings that are new compared with the base commit. |
| `fixed-findings` | Number of base-commit findings that are gone. |
| `report-markdown` | Path of the Markdown report (the pull request comment). |
| `report-json` | Path of the gate result JSON. |
| `report-sarif` | Path of the SARIF file. |

Give the step an `id` (for example `id: mesa`) to read them, such as
`${{ steps.mesa.outputs.new-findings }}`.

## Permissions

| Permission | Needed for |
| --- | --- |
| `contents: read` | Reading the code (always). |
| `pull-requests: write` | The pull request comment. Without it, the report is only in the job summary. |
| `security-events: write` | Only with `sarif: true`. Code scanning must be available for the repository (it is for public repositories). |

## Pull requests from forks

MESA only reads files. It never installs or runs the repository's code, so it is safe on pull
requests from forks. GitHub gives those runs a read-only token, so the Action cannot comment;
it reports in the job summary instead and the check still passes or fails as usual. Do not
switch to `pull_request_target` for this.

## On the main branch

On a push (no pull request) the Action scans once with fixed thresholds and posts no comment.
Use `fail-on-violation: false` there if the main branch has existing problems.

## Configuration

An optional `.mesa.yml` in the scanned folder sets which folders are services, the gate mode
and thresholds, and governance policies. Inputs given to the Action override it. See
[CI and the GitHub Action](https://github.com/ilmeedesilva/MESA/blob/main/docs/guides/ARCHITECTURE_FITNESS_GATE_CI.md)
for every option, what fails the check, and how to run the same check with the `mesa`
command line in other CI systems.

## What it detects, and its limits

What MESA detects, how it works, its benchmark results and its known limitations (for
example, Python calls whose URL is an f-string are not followed) are described in the
[MESA README](https://github.com/ilmeedesilva/MESA#readme).

## Questions and problems

Open an issue in the [MESA repository](https://github.com/ilmeedesilva/MESA/issues).
