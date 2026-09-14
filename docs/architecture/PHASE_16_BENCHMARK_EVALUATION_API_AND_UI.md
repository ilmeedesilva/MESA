# Phase 16: Benchmark Evaluation API and UI

Status: Implemented.

## Goal

The Phase 7/11 ground-truth evaluation workflow (`mesa evaluate <benchmark.yml>`) was CLI-only. Expose it over the API and add a UI panel so precision/recall/F1 against a benchmark can be run without a terminal.

## Added

- `src/mesa/evaluation/runner.py`: `list_available_benchmarks()` (lists `ground_truth.yml` and `real_repo_*.yml` files under `benchmarks/`, deliberately excluding `public_repo_manual_review_template.yml` so an unreviewed template is never offered for evaluation), `resolve_benchmark_path(benchmark_id)` (strict allow-list resolution — rejects path traversal and anything outside `benchmarks/` or outside the listable patterns), and `missing_benchmark_service_paths(path)` (pre-flight check: `analyze_services` silently returns an empty/degenerate result for a nonexistent path rather than erroring, which would otherwise make a missing local repo copy look like a low-recall result instead of a setup problem).
- `GET /benchmarks` and `POST /benchmarks/{benchmark_id}/evaluate` (`src/mesa/api/main.py`): the latter runs `evaluate_benchmark` and returns the full report as JSON (no export-to-disk side effect from an HTTP request); returns 404 for an unknown/disallowed id, 400 with a clear message if the benchmark references local paths that do not exist (pointing at `benchmarks/real-repos/README.md`).
- `Dockerfile`: added `COPY benchmarks ./benchmarks` — the API image previously did not include `benchmarks/` at all, so `mesa evaluate`'s default ground-truth path (and now this endpoint) would not have resolved inside a container.
- Frontend (`frontend/src/main.tsx`): new `Benchmarks` nav item (Research group), not project-scoped. `BenchmarksPanel` lists available benchmarks, runs one on demand, and displays detector/discovery metrics plus the benchmark's own `evaluator_notes`/`known_limitations` text.

## What Did Not Change

- `mesa evaluate` (CLI) still works exactly as before and still writes CSV/JSON/Markdown exports to disk; the new endpoint is a read-only, JSON-only sibling for interactive use, not a replacement.
- The separate "Research Evaluation" panel (per-scan manual TP/FP/FN recording, matched only against `benchmarks/ground_truth.yml`) is unchanged and unrelated to this feature.

## Verification

- `tests/test_evaluation.py`: `list_available_benchmarks` excludes the template and includes `ground_truth`; `resolve_benchmark_path` rejects traversal/unlisted ids; `missing_benchmark_service_paths` correctly flags a nonexistent path and returns empty for the real fixture-backed benchmark.
- `tests/test_api.py`: `GET /benchmarks` excludes the template; `POST /benchmarks/ground_truth/evaluate` returns real metrics; 404 for an unknown or disallowed (template) id; 400 with a "do not exist locally" message when a benchmark's service paths are missing (using a monkeypatched `BENCHMARKS_DIR`, so this test does not depend on `benchmarks/real-repos/` being present).
- Manual: ran the real backend + vite dev server and exercised `GET /api/benchmarks`, `POST /api/benchmarks/ground_truth/evaluate`, `POST /api/benchmarks/real_repo_online_boutique/evaluate` (this one succeeded because this machine already had `benchmarks/real-repos/` populated from Phase 15 — on a fresh machine without it, expect the 400 path instead), and the unknown-id 404 path — all through the vite `/api` proxy against the live server. Confirmed the dev server serves the new `BenchmarksPanel` code. `npm run build` and `tsc --noEmit` both pass.
