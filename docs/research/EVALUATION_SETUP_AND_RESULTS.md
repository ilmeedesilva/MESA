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

These values reflect deterministic seeded synthetic fixtures. They demonstrate that MESA can reproduce known labels in controlled examples. They should not be interpreted as proof of general real-world accuracy without larger external validation.

## Exported Results

- `evaluation-results/mesa_evaluation_results.json`
- `evaluation-results/mesa_evaluation_results.csv`
- `evaluation-results/mesa_evaluation_summary.md`

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
