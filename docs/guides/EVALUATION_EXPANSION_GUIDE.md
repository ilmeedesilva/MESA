# Evaluation Expansion Guide

## Purpose

Phase I expands MESA evaluation beyond detector-only synthetic benchmarking.

The upgraded evaluation flow now separates:

- detector quality
- service discovery quality
- explanation quality
- recommendation quality
- evaluator notes and limitations

## What Changed

The benchmark runner still supports detector precision, recall, and F1.

It now also supports:

- `service_discovery`
  - evaluates discovered service candidates separately from detector findings
- `explanation_checks`
  - evaluates grounded explainer responses with a deterministic rubric
- `evaluator_notes`
  - records manual observations
- `known_limitations`
  - records validity concerns for each system

## Files Added For Phase I

- `benchmarks/public_repo_manual_review_template.yml`
  - template for manually reviewed public repository evaluation
- `evaluation-results/mesa_evaluation_summary.md`
  - exported human-readable summary

## Benchmark Schema

### Detector Evaluation

Keep using:

- `service_paths`
- `ground_truth`

### Service Discovery Evaluation

Add:

```yaml
service_discovery:
  root: ../tests/fixtures/chatty
  expected_candidates:
    - order-service
    - user-service
```

### Explanation Evaluation

Add:

```yaml
explanation_checks:
  - id: priority-check
    intent: PRIORITIZE_FIXES
    question: Explain simply what should be solved first.
    required_evidence_kinds: [finding]
    min_suggestions: 2
    min_follow_up_questions: 1
    min_limitations: 1
```

Optional targeting fields:

- `finding_type`
- `services`
- `score_target`
- `doc_query`
- `expected_phrases`

### Evaluator Notes

Add:

```yaml
evaluator_notes:
  - This fixture is easy to explain to beginners.
known_limitations:
  - Static signals do not prove runtime traffic volume.
```

## How Explanation Scoring Works

The current explanation evaluation is deterministic.

It scores grounded responses using:

- answer presence
- evidence coverage
- grounding signal
- suggestions count
- follow-up question count
- limitations count
- optional expected phrase checks

This keeps evaluation of the explainer separate from evaluation of the detector.

## How Recommendation Scoring Works

Recommendation quality is measured from structured recommendation content:

- root cause present
- architectural consequence present
- expected impact present
- affected services/files present
- refactoring steps present

This is exported as:

- usefulness score
- structured coverage
- step quality score

## How To Run It

```bash
PYTHONPATH=src python3 -m mesa.cli evaluate benchmarks/ground_truth.yml --output-dir evaluation-results
```

The CLI is the only way to export CSV/JSON/Markdown files to disk. To run an evaluation interactively without a terminal, use the API/UI path added in Phase 16 (`docs/architecture/PHASE_16_BENCHMARK_EVALUATION_API_AND_UI.md`): `GET /benchmarks` lists the available files, `POST /benchmarks/{id}/evaluate` runs one and returns the report as JSON, and the frontend's `Benchmarks` nav item wraps both.

## Exported Outputs

The runner now exports:

- `mesa_evaluation_results.json`
- `mesa_evaluation_results.csv`
- `mesa_evaluation_summary.md`

## How To Use The Public Repo Template

1. Clone a public repository locally.
2. Copy `benchmarks/public_repo_manual_review_template.yml`.
3. Replace:

- `repo_url`
- local `service_paths`
- `service_discovery.root`
- `expected_candidates`
- `ground_truth`

4. Add manual notes after review.
5. Run the same evaluation command against that new benchmark file.

## Interpretation Guidance

Use the tracks separately:

- detector score answers: did MESA detect the expected structural risks?
- discovery score answers: did MESA identify the right service boundaries?
- explanation score answers: did MESA explain the result clearly and with grounding?
- recommendation score answers: did MESA provide usable structured follow-up guidance?

Do not treat a strong detector score as proof that explanation quality is also strong.
