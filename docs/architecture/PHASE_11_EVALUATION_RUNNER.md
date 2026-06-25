# Phase 11: Evaluation Runner

Status: Implemented.

## Goal

Make MESA research-defensible by adding a repeatable evaluation runner that compares detector output with ground-truth benchmark labels and exports thesis-ready metrics.

## Added

- Synthetic benchmark manifest: `benchmarks/ground_truth.yml`.
- Clean architecture fixture with no expected anti-patterns.
- Reuse of seeded anti-pattern fixtures for chatty services, cyclic dependencies, shared database, hard-coded dependencies, God Service, and distributed-monolith-style composite coupling.
- Evaluation runner module: `src/mesa/evaluation/runner.py`.
- CLI command: `mesa evaluate`.
- Precision, recall, F1-score, false positive, and false negative calculation.
- CSV and JSON export.
- Automated tests for metric calculation and export generation.

## Benchmark Systems

The Phase 11 benchmark manifest includes:

- `clean-architecture`
- `chatty-services`
- `cyclic-dependencies`
- `shared-database`
- `hard-coded-dependencies`
- `god-service`
- `distributed-monolith`

The distributed monolith benchmark is represented as a composite static architecture scenario where cyclic dependencies, central platform ownership, and hard-coded service coupling indicate distributed-monolith risk. Since MESA does not yet expose a dedicated `DISTRIBUTED_MONOLITH` detector type, this benchmark evaluates the implemented measurable symptoms.

## Ground Truth Format

Ground truth is YAML:

```yaml
benchmark: mesa-phase-11-synthetic-benchmarks
version: 1
matching: type_and_service_set
systems:
  - id: chatty-services
    name: Chatty services
    category: chatty services
    service_paths:
      - ../tests/fixtures/chatty/order-service
      - ../tests/fixtures/chatty/user-service
    ground_truth:
      - type: CHATTY_SERVICE
        services: [order-service, user-service]
```

Repeated labels are allowed and counted as separate expected occurrences. This matters for hard-coded dependency findings where multiple concrete endpoints may appear in the same service.

## Matching Strategy

A prediction matches ground truth when both are equal by:

```text
(finding type, sorted affected service set)
```

The runner uses occurrence counts, so duplicate findings are evaluated as duplicate labels.

## Metrics

For each benchmark system and overall:

```text
precision = TP / (TP + FP)
recall    = TP / (TP + FN)
F1-score  = 2 * precision * recall / (precision + recall)
```

The report includes:

- true positives
- false positives
- false negatives
- precision
- recall
- F1-score
- false-positive labels
- false-negative labels
- predicted findings

## CLI Usage

```bash
PYTHONPATH=src python3 -m mesa.cli evaluate benchmarks/ground_truth.yml --output-dir evaluation-results
```

When installed as a package:

```bash
mesa evaluate benchmarks/ground_truth.yml --output-dir evaluation-results
```

Outputs:

```text
evaluation-results/mesa_evaluation_results.json
evaluation-results/mesa_evaluation_results.csv
```

## Programmatic Usage

```python
from mesa.evaluation import evaluate_benchmark, export_evaluation

report = evaluate_benchmark("benchmarks/ground_truth.yml")
paths = export_evaluation(report, "evaluation-results")
```

## How to Test

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider
```

Frontend build remains unchanged but can be verified with:

```bash
cd frontend
npm run build
```

## Acceptance Criteria Mapping

- Evaluation runner compares detector output with ground truth: implemented by `evaluate_benchmark`.
- Precision, recall, and F1 are calculated: implemented per system, overall, and by finding type.
- Results can be used in thesis tables: implemented CSV and JSON export.

## Limitations

- Benchmarks are synthetic and intentionally small, which is appropriate for controlled undergraduate evaluation but should be expanded with public microservice repositories for stronger external validity.
- Matching is based on finding type and affected service set, not exact file/line evidence.
- The distributed monolith benchmark evaluates measurable symptoms with current detectors rather than a dedicated distributed-monolith detector.
- Current ground truth is deterministic for the included seeded fixtures; future benchmark expansion should include manually reviewed public projects.
