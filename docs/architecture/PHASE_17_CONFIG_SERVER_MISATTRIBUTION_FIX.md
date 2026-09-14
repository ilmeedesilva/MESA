# Phase 17: Config Server Misattribution Fix

Status: Implemented.

## Goal

Close the most significant real-world false-positive class found during Phase 15 real-repository evaluation: MESA could not tell "this config file is hosted here for another service" from "this config file is this service's own runtime configuration."

## Problem

`extract_service_facts()` (`src/mesa/analysis/extractor.py`) is called once per service, independently, with no knowledge of sibling services in the same scan. When a Spring Cloud Config Server (`config-service`) hosts a YAML file named after another service (`discovery-service.yml`) containing that service's own Eureka registration address, MESA read the URLs in that file as `config-service`'s own outbound calls. On `piomin/sample-spring-microservices-new` this produced a false-positive `CHATTY_SERVICE` finding (config-service → discovery-service, 4 static call sites ≥ threshold) and a false-positive `CYCLIC_DEPENDENCY` finding (config-service → discovery-service → config-service), plus an inflated (sub-threshold) God Service score for `config-service`.

## Fix

- `analyze_services()` (`src/mesa/analysis/pipeline.py`) now computes the set of sibling service names being scanned together and passes it to each `extract_service_facts()` call.
- `extract_service_facts()` (`src/mesa/analysis/extractor.py`) accepts an optional `sibling_service_names` parameter. For each YAML/properties/`.env*` file, `_stem_matches_other_service()` checks whether the file's name (normalized — trailing `-docker`/`-prod`/`-production`/`-local`/`-dev`/`-staging` suffixes stripped) matches a *sibling* service name other than the current service's own name. If so, the file is still scanned normally for environment variables, database connections, and message broker evidence, but its URLs are excluded from `facts.calls` — so they no longer create graph edges that feed `CHATTY_SERVICE`/`CYCLIC_DEPENDENCY` detection.
- **Deliberately unaffected**: `_extract_hard_coded_dependencies()` runs unconditionally on every analyzed text file regardless of this check, so `HARD_CODED_SERVICE_DEPENDENCY` findings on the same files are unchanged — this matches the real-world ground truth, where those findings were correctly labeled true positives (a hard-coded `discovery-service:8061` address is still hard-coded, even if it doesn't represent `config-service`'s own outbound traffic).

## Result

Re-running `mesa evaluate benchmarks/real_repo_spring_sample.yml`:

| Metric | Before | After |
|---|---:|---:|
| Detector precision | 0.9231 | 1.0000 |
| Detector recall | 1.0000 | 1.0000 |
| Detector F1 | 0.9600 | 1.0000 |

Discovery metrics (0.75/1.0/0.8571) are unrelated to this fix (a separate over-triggering issue on two non-service paths) and unchanged.

## Verification

- `tests/test_pipeline.py::test_stem_matches_other_service_ignores_self_and_matches_hosted_variants` — unit test for the matching heuristic (self-name never matches; `-docker`/etc. suffixes are stripped before comparison).
- `tests/test_pipeline.py::test_config_server_hosted_files_do_not_create_false_chatty_or_cyclic_findings` — end-to-end fixture (`tests/fixtures/config-server/`) reproducing the real pattern: a `config-service` hosting a `discovery-service.yml` with 4 URLs, and a `discovery-service` with its own genuine 1-URL reference back to `config-service`. Asserts no `CHATTY_SERVICE`/`CYCLIC_DEPENDENCY` finding, while the hard-coded-dependency finding on `config-service` still fires.
- Full suite: 76 passed, `ruff check` clean.
- Real-repo re-evaluation numbers above, cross-checked against the JSON export.

## Limitations

- The heuristic is name-based (file stem vs. sibling service name), not content-based — it will not catch config-hosting patterns that don't follow a "one file per service, named after that service" convention (e.g. a single combined `all-services.yml`). This covers the Spring Cloud Config convention specifically, which is the pattern actually observed; other config-distribution conventions (Consul KV, etcd, a custom config API) are not addressed and would need their own heuristics if evidenced by a future real-repo evaluation.
- `benchmarks/real_repo_spring_sample.yml`'s `evaluator_notes` keep the original false-positive description as a historical record rather than deleting it — the point of real-repo evaluation is to show what was found and fixed, not just the final clean number.
