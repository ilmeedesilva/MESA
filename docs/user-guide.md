# MESA user guide

MESA reads the source code and configuration of several microservices together and reports
architecture problems that only show up between services: dependency cycles, shared databases,
chatty calls, hard-coded service addresses and services that do too much. It also gives each
system a health score, recommendations, a remediation roadmap and an optional pass/fail gate.

MESA never runs the code it scans and does not connect to the services' databases. The only
network access is downloading a public GitHub repository when you give it a GitHub URL, and the
optional AI explainer if you turn it on.

## What MESA finds

| Problem | Example | Why it matters |
| --- | --- | --- |
| Chatty Service | `order-service` calls `user-service` from 8 places | Many fine-grained synchronous calls couple services and add latency |
| Cyclic Dependency | `order-service -> user-service -> order-service` | Services in a cycle cannot be deployed independently |
| Shared Database | Two services use `postgresql://db-host:5432/app_db` | Schema changes in one service can break another |
| Hard-Coded Service Dependency | `requests.get("http://user-service:8080/api/users")` | Deployments are tied to fixed addresses instead of configuration |
| God Service | One service owns most endpoints, data and dependencies | Changes concentrate in one place and slow every team down |

How each one is detected, with thresholds and limits, is in [Detectors](detectors.md).

## Start the app

```bash
docker compose up --build
```

| Service | Address |
| --- | --- |
| Web UI | `http://localhost:5173` |
| API and OpenAPI docs | `http://localhost:8000/docs` |
| Neo4j Browser | `http://localhost:7474` (development login `neo4j` / `mesa-password`) |

For a Python-only install without Docker, see [Installation](guides/installation.md).

## Run a scan in the UI

The scan page walks through five steps: **Project, Source, Review Services, Policies
(optional), Run Scan**. The banner at the top shows which step is done and what to do next.

1. Create or select a project.
2. Choose a source:
   - **Repository:** pick the source type, enter a local path, archive path or public GitHub URL,
     and click `Preview Discovery`.
   - **Manual:** leave the repository source empty and paste one service directory per line.
3. Review the discovered services and keep the ones you want, then click
   `Apply Selected Services`. Each candidate shows a confidence score, the detected language,
   and the reasons MESA thinks it is a service. High-confidence candidates are usually safe;
   check medium-confidence ones before keeping them.
4. Optionally edit and save governance policies.
5. Click `Run Scan` or `Run Repo Scan`.

With Docker Compose, paths must be the paths inside the API container, under `/workspace`:

```text
/workspace/tests/fixtures/god/platform-service
/workspace/tests/fixtures/god/order-service
/workspace/tests/fixtures/god/billing-service
```

## Read the results

### Summary cards

| Card | Meaning |
| --- | --- |
| Findings | Total findings in the scan |
| Services | Services included in the scan |
| System Health | Overall architecture score (see [Health score](guides/health-score.md)) |
| Highest Risk | The most severe finding |
| Hotspot Service | The service with the most linked findings |
| Focus First | The first issue MESA suggests reviewing |

### Beginner and Research views

A switch above the results changes how much detail is shown:

- **Beginner:** plain-language titles, why it matters, the first action to take, and what the
  result does not prove. Use it for a first pass or with non-specialists.
- **Research:** everything above plus detector names, raw evidence and technical context. Use it
  to check detector output or compare evidence between findings.

### A finding

Each finding opens in a drawer with these sections:

1. What MESA found
2. Why it matters
3. Why MESA thinks this (the evidence, with file and line)
4. What to do first
5. Expected impact
6. What this does not prove

Read the affected services and the evidence before acting, and check the last section so you
don't read more into a result than it supports. More detail: [Findings](guides/findings.md).

### Severity and confidence

They answer different questions:

- **Severity:** how serious the architectural risk could be.
- **Confidence:** how strongly the evidence supports the finding.

High confidence is a strong signal to plan a fix. With moderate confidence, review the evidence
first. Treat low confidence as an early signal that needs a manual check.

### Remediation roadmap

The roadmap groups recommendations into one plan. Read it in this order: summary, suggested
order, quick wins, medium-term changes, larger refactors, dependencies between steps. See
[Remediation roadmap](guides/remediation-roadmap.md).

## Use the CLI

```bash
# Analyze services and print a report
mesa analyze ./services/order-service ./services/user-service

# Save the full JSON report
mesa analyze ./services/order-service ./services/user-service -o report.json

# Only flag chatty services with 5 or more call sites (default 3)
mesa analyze ./services/* --chatty-threshold 5

# Pass/fail gate for CI: exit code 1 if the gate fails
mesa gate ./services/* --minimum-health-score 75 --maximum-critical-findings 0
```

`mesa analyze` takes service directories, not files. For a monorepo, pass each service
subdirectory. Use `mesa <command> --help` for every option. The gate is described in
[GitHub Action](guides/github-action.md).

## Repository scans over the API

The API accepts three source types: `LOCAL_PATH`, `ARCHIVE_PATH` and `GITHUB_URL`.

1. Preview a source with `POST /repo-scans/preview` and read `discovered_services`.
2. Keep the candidates you want and note their `relative_path` values.
3. Run a stored scan with `POST /projects/{project_id}/repo-scans`, or
   `POST /projects/{project_id}/repo-scans/async` for a background job that you poll with
   `GET /scan-jobs/{job_id}`.

Discovery is heuristic: it explains its choices but can be wrong, so review the candidates.
GitHub URLs need network access and a public repository. See [API](api.md) and
[Scanning public repositories](guides/scanning-public-repos.md).

## Getting better results

- **Keep config files in the repository**, with placeholder values if needed. `.env`,
  `application.yml` and Docker Compose files are where MESA finds database connections.
- **Use literal service names in URLs** where you can. MESA resolves
  `http://user-service:8080/api/users`, but not a URL built at runtime, such as
  `os.getenv("USER_SERVICE_URL") + "/api/users"`.
- **Scan at least two services.** Most detectors compare services with each other, so a single
  service only produces Hard-Coded Service Dependency and God Service results.

Supported languages and files are listed in [Supported inputs](guides/supported-inputs.md).

## Troubleshooting

**No findings, but you expected some.** Check that the calls use literal URLs or service names,
that config files with database URLs are present, and that the language is supported. Addresses
built from environment variables at runtime are not visible to MESA.

**A service shows 0 files.** You probably passed a file instead of its service directory, or a
path that does not exist inside the container (use `/workspace/...` with Docker Compose).

**A finding looks wrong.** Open its evidence: every finding points to the file and line it came
from. If two services really are meant to call each other often, raise `--chatty-threshold`. For
a hard-coded address on a known infrastructure port that MESA does not recognise, add the port
to `MESA_INFRA_PORT_ALLOWLIST`. Please report false positives as issues; they are the most useful
feedback for a static-analysis tool.

**`ModuleNotFoundError: No module named 'mesa'`.** Activate the virtual environment and run
`pip install -e .` from the repository root.

## FAQ

**Does MESA run my code?** No. It reads files as text and parses some of them. Nothing is
executed or installed.

**Does MESA send my code anywhere?** No, unless you turn on the optional AI explainer in a live
mode, which sends the evidence for a finding to the provider you configure.

**Does MESA support gRPC?** Literal gRPC dial targets in Go are found. Calls whose addresses come
from environment variables or service discovery at runtime are not.

**Does a service mesh affect the results?** No. MESA reads source and configuration, not network
traffic, and does not parse mesh configuration.
