# Detectors

MESA has five detectors. Each one reads the architecture graph (see
[How MESA works](architecture.md)), applies one explicit rule, and returns findings with:

- the rule that fired (`rule_id`) and the detector name
- the affected services
- evidence with source file and line where available, and an evidence chain showing each
  reasoning step
- a severity, a confidence score and the reason for that confidence
- the limits of what the finding proves
- a structured recommendation

All thresholds below are the defaults in the code.

| Detector | Rule | Severity |
| --- | --- | --- |
| [Chatty Service](#chatty-service) | Call sites from service A to service B >= threshold (default 3) | Low; Medium from 6; High from 10 call sites |
| [Cyclic Dependency](#cyclic-dependency) | A cycle in the service-to-service call graph | Critical for 2 services, High for 3, Medium for longer |
| [Shared Database](#shared-database) | One normalised database key used by 2 or more services | Critical for 2 services, High for more |
| [Hard-Coded Service Dependency](#hard-coded-service-dependency) | A literal service URL, service-like host, private or loopback IP, or `host:port` in code or config | By file type and repetition; known infrastructure ports are Low |
| [God Service](#god-service) | Weighted responsibility score >= 70 out of 100 | High from 70; Critical from 85 |

## Chatty Service

**What it finds:** one service calling another from many places in its code, which suggests
fine-grained synchronous coupling.

**How:** counts `api_call` edges between each ordered pair of services. A pair with at least
`--chatty-threshold` call sites (default 3) is reported. Confidence grows with the ratio of call
sites to the threshold, capped at 0.95.

**Limits:** call sites are counted statically. MESA does not know how often each call runs, or
whether the calls happen in the same request. Runtime traces are needed to confirm the
operational impact.

## Cyclic Dependency

**What it finds:** services that depend on each other in a loop, for example
`order -> payment -> order`. A cycle stops the services from being deployed independently.

**How:** projects the `api_call` edges onto a service-only directed graph and lists elementary
cycles with NetworkX `simple_cycles` (Johnson's algorithm). Rotations of the same cycle are
reported once. Confidence is 0.9.

**Limits:** a static edge does not prove that every part of the cycle is exercised at runtime.
The detector does not yet say which edge is cheapest to remove.

## Shared Database

**What it finds:** two or more services connecting to the same database, which blurs data
ownership.

**How:** every database connection string is normalised to `type://host/database`. Services are
grouped by that key; any key used by two or more services is reported. Confidence is 0.88.

**Limits:** a shared connection string does not prove the services share tables or
transactions. Connection strings built at runtime, or Spring `${var:default}` placeholders, are
not resolved.

## Hard-Coded Service Dependency

**What it finds:** literal service addresses in source or configuration, which tie deployments
to fixed hosts and bypass service discovery.

**How:** scans source and config files for literal URLs, service-like hostnames, private and
loopback IP addresses, and `host:port` pairs. Severity:

- **High:** a private IP or local development endpoint inside source code
- **Medium:** any other address in source code, or the same address repeated in config
- **Low:** a single address in a config file, or a known infrastructure port

Known infrastructure ports are downgraded to Low and flagged `likely_infrastructure_address`:
OpenTelemetry (4317, 4318), StatsD (8125), Prometheus (9090, 9091), Jaeger (6831, 6832, 14268),
Consul (8500) and Vault (8200). Override the list with `MESA_INFRA_PORT_ALLOWLIST`.

**Context filters.** These were added after measuring false positives on real repositories:

- In Java, JavaScript, TypeScript and Go, `//` and `/* */` comments are removed before matching.
  A `//` straight after a `:` is kept, so a real `http://` URL in live code is still found.
- Evidence from contract-test and mock directories (`api-spec/`, `mock/`, `mocks/`,
  `__mocks__/`) is ignored, for this detector and for database connections.
- A hard-coded host that matches the owning service's own name is ignored as a self-reference.

A broader rule that ignored all `test/`, `tests/`, `e2e/` and `spec/` folders was tried and
removed, because it also dropped real findings.

**Limits:** only literal values are found. Addresses built at runtime from environment variables
or string formatting are not visible to MESA.

## God Service

**What it finds:** a service that has collected too many responsibilities and dependencies.

**How:** a weighted score out of 100. Each indicator is normalised against a cap and multiplied
by its weight:

| Indicator | Weight | Full marks at |
| --- | --- | --- |
| API endpoints | 15 | 10 endpoints |
| Incoming dependencies | 15 | 5 services |
| Outgoing dependencies | 15 | 5 services |
| Files | 15 | 20 files |
| Databases | 10 | 3 databases |
| Domain keywords | 10 | 8 keywords |
| Degree centrality | 10 | - |
| Linked findings from other detectors | 10 | 5 findings |

Degree centrality is `(callers + callees) / (2 (n - 1))`, counting distinct services, where `n`
is the number of services scanned.
Services scoring 70 or more are reported. Every service's score and breakdown is returned in
`summary.god_service_scores`, including those below the threshold.

**Limits:** the score is a transparent heuristic, not a measured quality metric. File and
keyword counts depend on how a repository is organised.

## Config Server files

On Spring Cloud Config systems, a config service hosts YAML files meant for other services (for
example `config-service/.../discovery-service.yml`). If such a file's name matches another
service being scanned, its URLs are not counted as the config service's own calls. Without this,
the config service appeared to call every other service, producing false Chatty Service and
Cyclic Dependency findings.

## Adding a detector

See [CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-detector).
