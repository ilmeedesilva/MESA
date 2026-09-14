# Threats to Validity

## Construct Validity

Some anti-patterns, such as chatty services, are runtime-observable in production. MESA uses static proxies such as call-site counts and topology, which estimate risk rather than actual runtime frequency.

## Internal Validity

Detector outputs depend on current extraction heuristics. Dynamically generated URLs, reflection, framework magic, and runtime configuration may be missed.

## External Validity

The original benchmark set was synthetic and small, useful for controlled evaluation but not evidence of real-world accuracy. Phase 7 (`docs/architecture/PHASE_15_REAL_REPOSITORY_EVALUATION.md`) added two manually reviewed real public repositories: Google's Online Boutique (`GoogleCloudPlatform/microservices-demo`, 12 services, Go/Python/Node/Java/C#) and a pure Java/Spring Boot sample (`piomin/sample-spring-microservices-new`, 6 services). This is still only two repositories and should be expanded further, but it already surfaced concrete external-validity threats that synthetic fixtures could not:

- **Language coverage.** MESA's extractor only parses Python, JavaScript/TypeScript, and Java. On Online Boutique, 6 of 12 real services are Go or C#, so their real gRPC inter-service calls are invisible to MESA. The near-zero anti-pattern findings on that system reflect extraction coverage, not architectural cleanliness — see `benchmarks/real_repo_online_boutique.yml` for the full reasoning.
- **Discovery false negatives.** Two real services (`frontend`, `cartservice`) were missed entirely by service discovery because neither has a manifest filename MESA recognizes and a bare Dockerfile alone falls below the minimum confidence cutoff.
- **Config Server misattribution.** On the Spring sample, MESA's per-file static extraction cannot distinguish a Config Server's hosted templates (YAML files it merely serves to other services) from its own runtime configuration, producing false-positive `CHATTY_SERVICE` and `CYCLIC_DEPENDENCY` findings and an inflated God Service score for `config-service`. This will recur on any real Spring Cloud Config-based system, not just this one.
- **A real crash.** The same evaluation surfaced (and led to a fix for) a `ValueError` crash in the hard-coded-dependency extractor on Spring's `${server.port}` placeholder syntax — a pattern no synthetic fixture had exercised.

## Conclusion Validity

High seeded synthetic-benchmark scores (precision/recall/F1 = 1.0) show correctness against known synthetic labels, not universal detector accuracy — those labels were authored by the same team that built the detectors. The Phase 7 real-repository results are lower and more honest: detector F1 of 1.0 on Online Boutique (2/2, but only 2 findings existed to find) and 0.96 on the Spring sample (precision 0.9231, dragged down by the two labeled false positives above), with discovery F1 of 0.91 and 0.86 respectively. Future work should expand real-repository coverage well beyond two repositories, and should specifically seek out repositories with intentional, known anti-patterns rather than production-quality reference architectures, to test recall under realistic conditions rather than mostly testing precision on largely clean systems.

## Reliability

Scans are deterministic for the same repository state and thresholds. Docker Compose improves reproducibility, but local path differences can affect source locations.
