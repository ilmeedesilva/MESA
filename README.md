# MESA

Static analysis that finds architecture problems **between** microservices: dependency cycles,
shared databases, chatty calls, hard-coded service addresses and services that do too much.

Most static analysers look at one repository at a time, and tracing tools need a deployed
system with real traffic. MESA reads the code and configuration of several services together,
builds a graph of how they interact, and reports anti-patterns with the file and line that
caused each one, before anything is deployed. It never runs the code it scans.

## What MESA detects

| Problem | Example | Why it matters |
| --- | --- | --- |
| Cyclic Dependency | `order -> payment -> order` | Services in a cycle cannot be deployed independently |
| Shared Database | Two services use `postgresql://db:5432/app` | A schema change in one service can break another |
| Chatty Service | `order-service` calls `user-service` from 8 places | Fine-grained synchronous calls add coupling and latency |
| Hard-Coded Service Dependency | `http://user-service:8080` in source code | Deployments are tied to fixed addresses |
| God Service | One service owns most endpoints, data and dependencies | Change concentrates in one place |

Each finding includes its evidence, a confidence rationale, what it does not prove, and a
recommendation. Findings feed a health score, governance policies, a remediation roadmap and a
pass/fail gate for CI. Details: [Detectors](docs/detectors.md).

## Quick start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e .

# Analyze some services
mesa analyze tests/fixtures/chatty/order-service tests/fixtures/chatty/user-service

# Pass/fail gate for CI (exit code 1 on failure)
mesa gate tests/fixtures/cycle/order-service tests/fixtures/cycle/payment-service
```

Full stack with the web UI, PostgreSQL and Neo4j:

```bash
docker compose up --build
```

Then open `http://localhost:5173` for the UI and `http://localhost:8000/docs` for the API. With no
backend running, the UI loads built-in demo data.

## Results

Evaluated on eight seeded systems and three public microservice repositories (Google's Online
Boutique, a Spring Boot sample and Sock Shop):

- **Seeded benchmark:** 76 of 76 expected findings, no false positives.
- **Real repositories:** 30 of 30 labelled hard-coded dependencies, no false positives, after two
  context fixes found during the evaluation. Under 0.6 seconds per system.
- **Compared with general-purpose LLMs:** Claude Sonnet 5 and Claude Opus 5, given the same
  taxonomy and source, found at most 25% of the labelled dependencies in the real repositories,
  and neither gave the same answer on every run. MESA's output is identical on every run.

Limitations: MESA only sees values written literally in the files, so addresses built at runtime
are missed, and real-repository validation so far covers one anti-pattern type. See
[Evaluation](docs/research/evaluation.md), [AI baseline](docs/research/ai-baseline.md) and
[Methodology and threats to validity](docs/research/methodology.md).

## Documentation

| | |
| --- | --- |
| [User guide](docs/user-guide.md) | Running scans and reading results |
| [How MESA works](docs/architecture.md) | Pipeline, interfaces, storage |
| [Detectors](docs/detectors.md) | Rules, thresholds and limits for each detector |
| [Concepts](docs/concepts.md) | Short glossary |
| [Guides](docs/guides/) | Installation, scanning, findings, health score, governance, CI gate, AI explainer, demo |
| [API](docs/api.md) | REST endpoints (live reference at `/docs`) |
| [Contributing](CONTRIBUTING.md) | Development setup, checks, adding a detector |
| [Changelog](CHANGELOG.md) | Release history |

## Research

The research results come from the version tagged
[`v0.1.0-research`](https://github.com/ilmeedesilva/MESA/releases/tag/v0.1.0-research).
[REPRODUCE.md](docs/research/REPRODUCE.md) gives the exact commands and expected numbers, and
the committed results are in [`benchmarks/results/v0.1.0-research/`](benchmarks/results/v0.1.0-research/).

MESA began as my BSc (Hons) Computing final-year research project.
