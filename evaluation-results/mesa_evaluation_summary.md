# MESA Evaluation Summary

Benchmark: `mesa-phase-11-synthetic-benchmarks`

## Detector Quality

- Precision: `1.0`
- Recall: `1.0`
- F1: `1.0`

## Service Discovery Quality

- Systems evaluated: `7`
- Precision: `1.0`
- Recall: `0.9524`
- F1: `0.9714`

## Explanation Quality

- Systems evaluated: `7`
- Helpfulness score: `0.9393`
- Grounding score: `1.0`
- Coverage score: `0.9786`

## Recommendation Quality

- Systems evaluated: `7`
- Usefulness score: `0.8373`
- Structured coverage: `1.0`
- Step quality score: `0.8571`

## Evaluator Notes

### clean-architecture

- Note: Clean fixtures are useful to confirm MESA does not invent findings in a simple baseline.
- Limitation: This system is synthetic and smaller than a real service repository.

### chatty-services

- Note: Chatty services are still inferred from static call-site count, not real runtime traffic.
- Limitation: Repeated hard-coded findings are counted by occurrence rather than by unique endpoint family.

### cyclic-dependencies

- Note: Two-service cycles are especially useful for evaluator demos because the cause is easy to explain.

### shared-database

- Limitation: Shared database evidence is static and does not measure runtime transaction coupling.

### hard-coded-dependencies

- Note: Discovery may surface utility-style directories alongside service directories in mixed roots.

### god-service

- Note: This fixture behaves like a concentrated hotspot and is useful for roadmap, health, and priority evaluation together.
- Limitation: It is still a synthetic benchmark even though it combines multiple anti-pattern signals.

### distributed-monolith

- Note: This benchmark is a useful stand-in for distributed monolith symptoms, but it is not a real production repository.
