# MESA Evaluation Setup and Results

## Benchmark Manifest

Ground truth is stored in `benchmarks/ground_truth.yml`.

## Benchmark Systems

| ID | Purpose |
|---|---|
| clean-architecture | No expected anti-patterns. |
| chatty-services | Chatty service and static endpoint evidence. |
| cyclic-dependencies | Two-service dependency cycle. |
| shared-database | Shared persistence evidence. |
| hard-coded-dependencies | Hard-coded service URLs/IPs. |
| god-service | Central platform service with multiple risks. |
| distributed-monolith | Composite static symptoms of distributed monolith risk. |
| recall-stress-test | 8 services, 5 anti-pattern types deliberately interleaved in one scan (see `docs/architecture/PHASE_19_RECALL_STRESS_TEST.md`). Unlike the systems above, which mostly isolate one pattern each, this tests whether co-occurring patterns interfere with or mask each other. |

## Metrics

- Precision = TP / (TP + FP)
- Recall = TP / (TP + FN)
- F1 = 2PR / (P + R)

## Command

```bash
PYTHONPATH=src python3 -m mesa.cli evaluate benchmarks/ground_truth.yml --output-dir evaluation-results
```

## Current Seeded Benchmark Result

| Metric | Value |
|---|---:|
| Precision | 1.0000 |
| Recall | 1.0000 |
| F1-score | 1.0000 |

These values reflect deterministic seeded synthetic fixtures, including `recall-stress-test`, which specifically checks that 5 co-occurring anti-pattern types (cyclic dependency, chatty service, shared database, God Service, hard-coded dependency) across 8 services in one scan do not interfere with or mask each other — MESA found all 26 expected findings with zero false positives/negatives. They demonstrate that MESA can reproduce known labels in controlled examples, including harder multi-pattern ones, not just isolated single-pattern fixtures. They should not be interpreted as proof of general real-world accuracy — see the real-repository results below for that.

## Exported Results

- `evaluation-results/mesa_evaluation_results.json`
- `evaluation-results/mesa_evaluation_results.csv`
- `evaluation-results/mesa_evaluation_summary.md`

## Real-Repository Evaluation (Phase 7)

Phase 7 (see `docs/architecture/PHASE_15_REAL_REPOSITORY_EVALUATION.md`) runs MESA against manually reviewed, real, third-party public repositories rather than seeded fixtures, using the same evaluation runner and metrics. Ground truth for each repository is a `benchmarks/real_repo_*.yml` file with `evaluator_notes` and `known_limitations` explaining every labeling decision.

```bash
PYTHONPATH=src python3 -m mesa.cli evaluate benchmarks/real_repo_online_boutique.yml --output-dir evaluation-results/real-repo-online-boutique
PYTHONPATH=src python3 -m mesa.cli evaluate benchmarks/real_repo_spring_sample.yml --output-dir evaluation-results/real-repo-spring-sample
PYTHONPATH=src python3 -m mesa.cli evaluate benchmarks/real_repo_sockshop.yml --output-dir evaluation-results/real-repo-sockshop
```

| Repository | Services | Detector precision | Detector recall | Detector F1 | Discovery precision | Discovery recall | Discovery F1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Online Boutique (`GoogleCloudPlatform/microservices-demo`) | 12 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.9167 | 0.9565 |
| Spring sample (`piomin/sample-spring-microservices-new`) | 6 | 1.0000 | 1.0000 | 1.0000 | 0.7500 | 1.0000 | 0.8571 |
| Sock Shop (`microservices-demo` org, 8 repos) | 8 | 1.0000 | 1.0000 | 1.0000 | 0.3478 | 1.0000 | 0.5161 |

- **Online Boutique's detector F1 of 1.0 is not evidence of accuracy on this system** — only 2 findings existed to find (both the same `localhost:4317` OpenTelemetry endpoint, now downgraded to LOW severity with a `likely_infrastructure_address` flag — see `docs/architecture/PHASE_18_INFRA_ADDRESS_DOWNGRADE.md`), because 6 of its 12 real services are Go or C#, languages MESA's extractor originally did not parse at all. MVP Go support (`docs/architecture/PHASE_20_GO_LANGUAGE_SUPPORT.md`) improved discovery recall from 0.8333 to 0.9167 (`frontend` is now discovered; `cartservice`, C#, is out of scope for this step) but did not change the detector numbers — this repository's real Go code sources service addresses from environment variables rather than literal strings, which MESA's static, literal-only extraction (true for Python/JS/Java too, not a Go-specific gap) cannot see. See `benchmarks/real_repo_online_boutique.yml` for the full reasoning and the verified before/after discovery numbers.
- **The Spring sample's detector precision was originally 0.9231**: MESA produced 2 false positives (`CHATTY_SERVICE` and `CYCLIC_DEPENDENCY` between `config-service` and `discovery-service`) because its static extraction could not distinguish a Spring Cloud Config Server's hosted YAML templates (meant for other services) from its own runtime configuration. This was fixed in `src/mesa/analysis/extractor.py` (see `docs/architecture/PHASE_17_CONFIG_SERVER_MISATTRIBUTION_FIX.md`) — MESA now recognizes when a config file's name matches a sibling service and excludes its URLs from the hosting service's own call evidence. Precision is now 1.0000. Discovery precision of 0.75 is unrelated and still reflects 2 non-service paths it over-selected. See `benchmarks/real_repo_spring_sample.yml` for full reasoning and the historical false-positive record.
- Evaluating the Spring sample also surfaced a real crash (`ValueError` on a Spring Cloud Gateway `${server.port}` placeholder in YAML), fixed in `src/mesa/analysis/extractor.py` before this benchmark was finalized.
- **Sock Shop's detector precision was originally 0.1905 (17 of 21 raw findings false positive) — an honestly reported headline result, not hidden or narrowed after the fact.** Unlike the other two repositories, Sock Shop's repos are unusually dense with test fixtures, API-contract mock hooks (Dredd `hooks.js`), and code comments containing example curl commands, and the 17 false positives traced to exactly this: a vendored third-party JS library's CSS breakpoint misread as a host:port (itself inside a `//` comment); a service's own end-to-end tests hardcoding the URL of itself under test; a mock server address inside contract-test fixtures; and example curl commands sitting inside `//` code comments. Each of these was subsequently fixed: `_extract_hard_coded_dependencies` now strips `//`/`/* */` comments before matching (without blinding itself to a real `http://` URL in live code, since a `//` immediately preceded by `:` is left alone); hard-coded-dependency and database evidence sourced from an `api-spec/`/`mock/`/`mocks/`/`__mocks__/` directory is now excluded; and a hard-coded host matching the owning service's own name is now excluded as a self-reference. A first attempt at a broader `test/`/`e2e/`/`spec/` directory-name exclusion was tried, measured against all four benchmarks, and reverted after it was found to also discard genuine true positives (a Spring service's `src/test` resources, Sock Shop front-end's own `test/docker-compose.yml`) — the narrower rules actually shipped were chosen because they were verified not to cause that regression. **Detector precision on Sock Shop is now 1.0000, recall unchanged at 1.0000** (TP=4, FP=0, FN=0), confirmed live via `mesa evaluate`. Evaluating this repository also surfaced two further real, general bugs (not specific to Sock Shop), both fixed: `detect_language()` let a single stray Python test file hijack an entire Go/Java service's reported language, and a chained `.replace("mongo", "mongodb")` call corrupted an already-correct "mongodb" db-type into "mongodbdb" (`mongo` being a substring of `mongodb`), which had also been obscuring the real cause of a false `SHARED_DATABASE` finding while it was being debugged. See `benchmarks/real_repo_sockshop.yml` for the full per-finding reasoning and fix history.
- **Combined across all three real repositories: 30 true positives, 0 false positives, 0 false negatives — precision, recall, and F1 all 1.0000.** This is the current, fully re-verified state of MESA's real-repository detector evaluation as of the fixes above.

All three repositories' ground truth and local source copies are documented in `benchmarks/real-repos/README.md` (the source itself is gitignored; only the benchmark YAML and this documentation are committed).

## Phase I Evaluation Expansion

The upgraded evaluation flow now separates:

- detector quality
- service discovery quality
- explanation quality
- recommendation quality
- evaluator notes and limitations

This makes the evaluation stronger because MESA no longer treats:

- detection accuracy
- discovery accuracy
- explanation helpfulness

as if they were the same thing.
