# Threats to Validity

## Construct Validity

Some anti-patterns, such as chatty services, are runtime-observable in production. MESA uses static proxies such as call-site counts and topology, which estimate risk rather than actual runtime frequency.

## Internal Validity

Detector outputs depend on current extraction heuristics. Dynamically generated URLs, reflection, framework magic, and runtime configuration may be missed.

## External Validity

The current benchmark set is synthetic and small. It is useful for controlled evaluation but should be expanded with manually reviewed public microservice repositories.

## Conclusion Validity

High seeded benchmark scores show correctness against known synthetic labels, not universal detector accuracy. Future work should include larger datasets and expert validation.

## Reliability

Scans are deterministic for the same repository state and thresholds. Docker Compose improves reproducibility, but local path differences can affect source locations.
