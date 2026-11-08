# MESA Evaluation Summary

Benchmark: `mesa-phase-11-synthetic-benchmarks`

## Detector Quality

- Precision: `1.0`
- Recall: `1.0`
- F1: `1.0`

## Service Discovery Quality

- Systems evaluated: `8`
- Precision: `0.9688`
- Recall: `1.0`
- F1: `0.9821`

## Explanation Quality

- Systems evaluated: `7`
- Helpfulness score: `0.9393`
- Grounding score: `1.0`
- Coverage score: `0.9786`

## Recommendation Quality

- Systems evaluated: `8`
- Usefulness score: `0.8558`
- Structured coverage: `1.0`
- Step quality score: `0.875`

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

### recall-stress-test

- Note: Unlike the other seeded fixtures (mostly one anti-pattern per system), this system deliberately interleaves five anti-patterns across 8 services in one scan: a 3-node CYCLIC_DEPENDENCY (checkout-service -> billing-gateway-service -> fulfillment-service -> checkout-service), a CHATTY_SERVICE pair (alert-service -> profile-service, 4 static call sites), a 3-service SHARED_DATABASE (checkout-service, billing-gateway-service, ledger-service all reference platform_ledger_db), a GOD_SERVICE hotspot (platform-hub-service, scoring exactly at the 70.0 HIGH-risk threshold with 10 endpoints and 7 distinct outbound targets), and source-level HARD_CODED_SERVICE_DEPENDENCY findings including 2 private-IP references in legacy-bridge-service.
- Note: The 3 services sharing platform_ledger_db (checkout-service, billing-gateway-service, ledger-service) each also produce a HARD_CODED_SERVICE_DEPENDENCY finding purely from the literal `db-host:5432` substring inside their database connection string: this is the existing generic host:port hard-coded-endpoint pattern matching independently of the separate database-connection extraction that produces the SHARED_DATABASE finding. Not a bug specific to this fixture - the same DB connection string is legitimately both a database reference and a literal host:port pattern - but worth noting since it means 'one line' can produce two different finding types.
- Note: This benchmark exists specifically to test recall (does MESA find everything that is really there) on a single system with multiple overlapping anti-patterns, complementing the real-repository benchmarks in benchmarks/real_repo_*.yml, which mostly tested precision on comparatively clean architectures. See docs/research/THREATS_TO_VALIDITY.md.
- Limitation: This is still a synthetic, hand-authored fixture, not a real repository; it demonstrates MESA can find multiple co-occurring anti-patterns in one scan, not that real messy systems look exactly like this.
