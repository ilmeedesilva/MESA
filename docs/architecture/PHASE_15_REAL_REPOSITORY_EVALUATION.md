# Phase 15: Real Repository Evaluation

Status: Implemented (2 repositories; expandable).

## Goal

Close the biggest external-validity gap in MESA's evaluation: the only prior benchmark (`benchmarks/ground_truth.yml`) was synthetic fixtures authored by the same team that built the detectors, which cannot demonstrate real-world accuracy. Evaluate MESA against real, third-party public repositories with manually reviewed ground truth instead.

## Repositories Evaluated

| Repository | Why chosen | Services | Commit |
|---|---|---:|---|
| `GoogleCloudPlatform/microservices-demo` ("Online Boutique") | Google's own reference microservice architecture, single repo (no submodules), genuinely polyglot (Go/Python/Node/Java/C#) | 12 | `b9a978db9e01f4ad3dca9494a22cb9edc17548fe` |
| `piomin/sample-spring-microservices-new` | Pure Java/Spring Boot, small enough to fully hand-verify, exercises the Java+`pom.xml`+Spring detection path | 6 | `cc5c9fbe771772eb40d091ee2371286ecd099083` |

Fetched via MESA's own `GITHUB_URL` ingestion (`mesa.ingestion.repository.prepare_repository`), then copied to a stable local path under `benchmarks/real-repos/` (gitignored — see `benchmarks/real-repos/README.md`) since the ingestion cache uses per-run, UUID-suffixed, TTL-swept workspace directories not suitable for a committed benchmark file to reference.

## Process

For each repository:

1. Ran MESA's service discovery and full analysis pipeline against the real source.
2. Manually reviewed the repository's actual source/config (not just MESA's output) to classify every finding as a true or false positive, and to identify what MESA missed.
3. Wrote a `benchmarks/real_repo_*.yml` file (following the existing `benchmarks/public_repo_manual_review_template.yml` schema) with the resulting `ground_truth`, plus `evaluator_notes` and `known_limitations` documenting the reasoning behind every non-obvious labeling call.
4. Ran `mesa evaluate` against each file and exported results to `evaluation-results/real-repo-<name>/`.

## What It Found

- **A real crash**: the hard-coded-dependency extractor raised `ValueError` on Spring Cloud Gateway's `${server.port}` placeholder syntax in YAML (`urlparse().port` cannot parse a template as an integer). Fixed in `src/mesa/analysis/extractor.py` (catches the unparseable port, keeps the finding instead of crashing); regression covered by `tests/test_pipeline.py::test_hard_coded_dependency_detector_handles_unresolved_placeholder_ports`.
- **Discovery false negatives**: Online Boutique's `frontend` (Go) and `cartservice` (C#) were missed entirely — neither has a manifest filename MESA's discovery heuristic recognizes, and a bare Dockerfile alone falls below the 0.24 minimum-confidence cutoff.
- **Config Server misattribution**: on the Spring sample, MESA's per-file static extraction read Eureka URLs out of YAML files that `config-service` merely *hosts* for other services, not calls itself — producing false-positive `CHATTY_SERVICE` and `CYCLIC_DEPENDENCY` findings and an inflated (but sub-threshold) God Service score. This is a structural limitation, not a one-off scan artifact, and will recur on any real Spring Cloud Config-based system.
- **Language-coverage-driven silence**: Online Boutique's near-zero anti-pattern findings reflect that 6 of its 12 real services are in languages (Go, C#) MESA's extractor does not parse, not evidence the architecture is clean.

Full reasoning for every ground-truth label lives in the `evaluator_notes`/`known_limitations` fields of each benchmark YAML file, not just in this doc, so the evaluation stays auditable independent of prose summaries.

## Results

See `docs/research/EVALUATION_SETUP_AND_RESULTS.md` for the results table and `docs/research/THREATS_TO_VALIDITY.md` for how these results change the external/conclusion validity story versus the synthetic-only baseline.

## Limitations

- Two repositories is a start, not a representative sample. Both are also relatively well-architected reference/demo systems; neither was chosen for having known, intentional anti-patterns, so this evaluation mostly stress-tested precision (and coverage gaps) rather than recall under realistic anti-pattern conditions.
- Ground truth was reviewed by one person (this session, with the user's sign-off on the debatable calls), not cross-checked by an independent second reviewer — a common threat to validity for manually labeled benchmarks generally, worth stating plainly in the dissertation.
- Repositories evolve; the pinned commits above will drift out of date. `benchmarks/real-repos/README.md` documents how to refresh them and flags that labels need re-review if refreshed.
