# Phase 18: Infrastructure Address Suppression / Downgrade

Status: Implemented.

## Goal

Close the second real-world nuance found during Phase 15 real-repository evaluation: `HARD_CODED_SERVICE_DEPENDENCY` treated a local observability/infrastructure sidecar address (`localhost:4317`, the OpenTelemetry Collector's gRPC port, found in Online Boutique's `emailservice` and `recommendationservice`) the same as a genuine cross-service business dependency. The address is genuinely hard-coded, so the finding stays — but it's a materially different kind of risk than a hard-coded call to another business service, and a human evaluator had to notice and write that down by hand every time.

## Fix

`src/mesa/detectors/hard_coded_dependency.py`:

- A default table (`_DEFAULT_INFRA_PORTS`) of well-known local infrastructure ports: OpenTelemetry Collector (`4317`/`4318`), StatsD (`8125`), Prometheus (`9090`/`9091`), Jaeger (`6831`/`6832`/`14268`), Consul (`8500`), Vault (`8200`).
- `_infra_service_label(host, port)`: returns the matched service's label when the dependency's host is a loopback address (`localhost`, `127.0.0.1`, `0.0.0.0`, `::1`) **and** the port is in the table; `None` otherwise.
- When matched, `_finding()`: downgrades severity to `LOW` (instead of the normal file-type/duplicate-based severity), adds `likely_infrastructure_address: true` and `infrastructure_service_guess: "<label>"` to the finding's evidence, and appends a limitation explaining the match and naming the override variable. Confidence is left unchanged — the address is still genuinely hard-coded, only the severity/framing changes.
- Overridable via `MESA_INFRA_PORT_ALLOWLIST` (comma-separated `port` or `host:port` entries). If the env var is set at all — including empty — it fully replaces the default table, so a user can also disable the behavior entirely by setting it to an empty string.

## Result

Re-running `mesa evaluate benchmarks/real_repo_online_boutique.yml`: precision/recall/F1 unchanged (1.0/1.0/1.0 — the fix changes severity and evidence, not whether a finding matches ground truth), but both `HARD_CODED_SERVICE_DEPENDENCY` findings for `localhost:4317` now report `severity: LOW` with `likely_infrastructure_address: true`, instead of the previous `HIGH` severity with no such signal.

## Verification

- `tests/test_pipeline.py::test_hard_coded_dependency_detector_downgrades_known_infra_ports` — new `tests/fixtures/hardcoded/otel-service/` fixture referencing `localhost:4317`; asserts `LOW` severity, the evidence flags, and a limitation mentioning the port.
- `tests/test_pipeline.py::test_hard_coded_dependency_detector_leaves_non_infra_ports_unaffected` — existing `order-service` fixture (non-infra port) has no `likely_infrastructure_address` key in its evidence.
- `tests/test_pipeline.py::test_infra_port_allowlist_env_override` — setting `MESA_INFRA_PORT_ALLOWLIST` to an unrelated port removes the downgrade for `4317`.
- Full suite: 79 passed, `ruff check` clean.
- Real-repo re-evaluation cross-checked against the JSON export (see Result above).

## Limitations

- The table is host+port based, not protocol-aware — a service that happens to run its *own* business logic on port `9090` (a common default for many things, not just Prometheus) on a loopback-bound address inside a container would also be downgraded. This trades a small false-negative-on-severity risk for removing a much more common false-positive-on-severity pattern; the finding itself is never hidden, only its severity and framing change.
- The list is deliberately small and curated from what was actually observed (Online Boutique's OTel usage) plus a few other very common sidecars — it is not an exhaustive catalog of every observability tool's default port, and should grow as future real-repo evaluations surface more examples.
