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

These values reflect deterministic seeded synthetic fixtures. They demonstrate that MESA can reproduce known labels in controlled examples. They should not be interpreted as proof of general real-world accuracy — see the real-repository results below for that.

## Exported Results

- `evaluation-results/mesa_evaluation_results.json`
- `evaluation-results/mesa_evaluation_results.csv`
- `evaluation-results/mesa_evaluation_summary.md`

## Real-Repository Evaluation (Phase 7)

Phase 7 (see `docs/architecture/PHASE_15_REAL_REPOSITORY_EVALUATION.md`) runs MESA against manually reviewed, real, third-party public repositories rather than seeded fixtures, using the same evaluation runner and metrics. Ground truth for each repository is a `benchmarks/real_repo_*.yml` file with `evaluator_notes` and `known_limitations` explaining every labeling decision.

```bash
PYTHONPATH=src python3 -m mesa.cli evaluate benchmarks/real_repo_online_boutique.yml --output-dir evaluation-results/real-repo-online-boutique
PYTHONPATH=src python3 -m mesa.cli evaluate benchmarks/real_repo_spring_sample.yml --output-dir evaluation-results/real-repo-spring-sample
```

| Repository | Services | Detector precision | Detector recall | Detector F1 | Discovery precision | Discovery recall | Discovery F1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Online Boutique (`GoogleCloudPlatform/microservices-demo`) | 12 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.8333 | 0.9091 |
| Spring sample (`piomin/sample-spring-microservices-new`) | 6 | 1.0000 | 1.0000 | 1.0000 | 0.7500 | 1.0000 | 0.8571 |

- **Online Boutique's detector F1 of 1.0 is not evidence of accuracy on this system** — only 2 findings existed to find (both the same `localhost:4317` OpenTelemetry endpoint), because 6 of its 12 real services are Go or C#, languages MESA's extractor does not parse. Discovery also missed 2 of 12 real services (`frontend`, `cartservice`) entirely. See `benchmarks/real_repo_online_boutique.yml` for the full reasoning.
- **The Spring sample's detector precision was originally 0.9231**: MESA produced 2 false positives (`CHATTY_SERVICE` and `CYCLIC_DEPENDENCY` between `config-service` and `discovery-service`) because its static extraction could not distinguish a Spring Cloud Config Server's hosted YAML templates (meant for other services) from its own runtime configuration. This was fixed in `src/mesa/analysis/extractor.py` (see `docs/architecture/PHASE_17_CONFIG_SERVER_MISATTRIBUTION_FIX.md`) — MESA now recognizes when a config file's name matches a sibling service and excludes its URLs from the hosting service's own call evidence. Precision is now 1.0000. Discovery precision of 0.75 is unrelated and still reflects 2 non-service paths it over-selected. See `benchmarks/real_repo_spring_sample.yml` for full reasoning and the historical false-positive record.
- Evaluating the Spring sample also surfaced a real crash (`ValueError` on a Spring Cloud Gateway `${server.port}` placeholder in YAML), fixed in `src/mesa/analysis/extractor.py` before this benchmark was finalized.

Both repositories' ground truth and local source copies are documented in `benchmarks/real-repos/README.md` (the source itself is gitignored; only the benchmark YAML and this documentation are committed).

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
