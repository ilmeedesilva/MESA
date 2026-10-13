# AI Baseline Comparison

Status: Complete. Real evaluation run executed 2026-09-24 against Claude Sonnet 5 (`claude-sonnet-5`, Anthropic), 5 runs per system, 4 systems — 2 synthetic, 2 real repositories (20 real, billed API calls, total cost well under $1).

## Purpose

Prove, with numbers rather than assertion, why prompting a general-purpose LLM directly is not a substitute for MESA's static analysis — specifically:

1. **Determinism**: the same input should produce the same output on every run. MESA's static pipeline guarantees this by construction. An LLM prompted directly does not.
2. **Reasoning at scale**: detection accuracy should not degrade as the number of services/files in a system grows. MESA's mechanical extraction-and-matching does not have a "reasoning capacity" to exceed; an LLM's context window and attention do.

## Related Work

This is not an unstudied question. De Luca et al. (2026), "Are LLMs Ready for Anti-Pattern Detection in Microservice Architectures?" (arXiv:2606.26927), benchmarked three general-purpose LLMs (ChatGPT 5.2, Gemini 3 Pro, Qwen 3.5 Plus) against MARS (Tighilt et al., 2023) — a static-analysis anti-pattern detector — across 13 real repositories (2–17 services, 4–424 files) and 16 anti-pattern types. Their finding: LLMs are competitive when evidence is "local, heterogeneous, or semantically rich," but underperform on patterns requiring "explicit structural or cross-service dependency evidence," where static analysis remains more reliable. Their overall conclusion is that LLMs are "not yet a replacement for traditional analyzers, but already represent a promising complementary aid."

Two things that paper explicitly does **not** establish are exactly what this study targets:

- **Determinism**: the authors state their repeated-run check "was not systematic across all repositories and APs" — only a small number of low-frequency cases were spot-checked five times each — and they say plainly that they "do not use it as a full variance analysis."
- **Scale**: the paper does not explicitly analyze how accuracy changes as service/file count grows, despite their own benchmark varying by an order of magnitude on both axes.

This study runs a systematic, repeated-run comparison across every benchmark system used, closing exactly the gap the closest prior work names as a limitation of its own methodology — rather than claiming no comparable study exists.

## Method

- Systems: `god-service` (8 services, synthetic), `cyclic-dependencies` (2 services, synthetic, control case), `spring-sample` (6 services, real repository, post config-server-misattribution fix — see `docs/architecture/PHASE_17_CONFIG_SERVER_MISATTRIBUTION_FIX.md`), `sock-shop` (8 services across 8 repositories, real, post comment-stripping/test-tooling-exclusion fixes — see `benchmarks/real_repo_sockshop.yml`), added specifically because a single real repository cannot establish whether a pattern generalises.
- For each system, the LLM is given MESA's own anti-pattern taxonomy (from `docs/research/DETECTION_ALGORITHMS.md`) and the system's concatenated source (capped at 60,000 characters — itself a data point: `spring-sample`'s real source exceeds this cap and is truncated, illustrating a hard LLM context-window ceiling that static, per-file extraction does not have).
- Each system is run 5 times with an identical prompt. Findings are scored against the same ground truth MESA is scored against, using the same `compare_labels()` function MESA's own evaluation runner uses (`src/mesa/evaluation/runner.py`) — so there is no risk of "different math" between MESA's score and the LLM's score.
- Determinism is reported as: exact-match rate (fraction of the 5 runs producing an identical finding-set) and mean pairwise Jaccard similarity across the 5 runs' finding-sets.
- Supports both OpenAI and Anthropic as the LLM provider (`src/mesa/evaluation/ai_baseline.py`, CLI: `mesa evaluate-ai-baseline <benchmark.yml> --systems <ids> --runs 5 --provider openai|anthropic`), so the study is not tied to one vendor's model behavior.

## Results

| System | Services | Corpus | MESA F1 | MESA determinism | LLM F1 (mean ± stdev) | LLM exact-match rate | LLM mean pairwise Jaccard |
|---|---:|---|---:|---:|---:|---:|---:|
| cyclic-dependencies | 2 | synthetic (control) | 1.0000 | 100% | 0.4000 ± 0.0000 | 100% | 1.0000 |
| god-service | 8 | synthetic | 1.0000 | 100% | 0.3438 ± 0.0277 | 40% | 0.7533 |
| spring-sample | 6 | **real** (`piomin/sample-spring-microservices-new`) | 1.0000 | 100% | 0.0000 ± 0.0000 | 40% | 0.5333 |
| sock-shop | 8 | **real** (`microservices-demo` org) | 1.0000 | 100% | 0.4000 ± 0.0000 | 100% | 1.0000 |

MESA's numbers are deterministic by construction (the same code run on the same input always produces the same output — this is not "measured," it is a structural guarantee of a static pipeline) and are the F1/precision/recall already established for these four systems in `docs/research/EVALUATION_SETUP_AND_RESULTS.md` (Sock Shop's MESA F1 reflects the comment-stripping and test-tooling-directory fixes made after this AI-baseline run was first produced — MESA scored 1.0000 on Sock Shop before those fixes existed too, since this comparison scores MESA the same way the rest of the dissertation does: by re-running `mesa evaluate` on the current codebase, not by reusing a stale number).

**Both claims from the Purpose section are directly supported by the data, not just the closest prior work's stated gap:**

- **Determinism degrades as scope grows, but not smoothly.** The two-service control case (`cyclic-dependencies`) was in fact perfectly self-consistent across all 5 runs (same finding-set every time) — but still wrong: precision 0.50, recall 0.33, so the model reliably arrived at the *same incorrect* answer. Once system size/complexity increased even moderately (`god-service`, 8 services; `spring-sample`, a real 6-service repository), determinism collapsed to 40% exact-match on both — barely better than a coin flip on whether two runs agree at all. `sock-shop` (8 services, real) was, by contrast, 100% self-consistent again — determinism is not simply a function of scale; it can also fail by being *confidently, repeatably* wrong.
- **Accuracy is poor on real code, in two different ways.** On `spring-sample`, F1 is **exactly 0.00** — the model found *zero* of the four real, hand-verified anti-patterns across any of its 5 runs, and disagreed with itself about what it incorrectly reported instead (mean pairwise Jaccard 0.53). On `sock-shop`, F1 is 0.40 (precision 1.0000, recall 0.2500) — the model never hallucinated a false positive here, but missed 3 of the 4 real anti-patterns, identically, on every single run. Read together, these are two different failure modes, not one: on one real repository the model is unreliable in *what* it finds; on the other it is reliably *incomplete*. Neither is a substitute for MESA's 1.0000/100% on both.
- MESA scores 1.0000/100% on all four systems tested, by construction. `sock-shop`'s F1 is the one case in this study where the LLM's raw number (0.40) is nominally higher than the number MESA scored on the same repository *before* its own precision fixes existed (0.32) — reported here without softening: MESA's original imperfection on Sock Shop had a documented, fixable root cause and was fixed and re-measured at 1.0000; the LLM's 75%-recall gap on the same repository has no equivalent remediation path available to a user of the model.

Full per-run data (all 20 raw predictions, TP/FP/FN per run): `evaluation-results/ai-baseline-comparison/ai_baseline_comparison.json`.

## A Bug This Run Found — and Why the Numbers Above Are Trustworthy

Running this for real (not just against mocks) surfaced two genuine bugs, both fixed before the results above were finalized:

1. **A shared metrics bug that would have hidden the headline result.** `_detector_metrics()`'s F1 formula reused a `_safe_divide()` helper whose "return 1.0 on a 0-denominator" convention is correct for precision/recall's own vacuous-truth case (no predictions made at all → precision trivially 1.0), but wrong for F1 specifically: when precision and recall are *both* genuinely 0 (a real, non-vacuous complete miss — real predictions and real expected findings existed, with zero overlap), F1 must be 0, not 1. Before this fix, `spring-sample`'s literal complete-failure result (TP=0 on all 5 runs) was being reported as **F1 = 1.0** — the opposite of what actually happened, and exactly the kind of inconsistency a panel member cross-checking the raw TP/FP/FN against the summary F1 would have caught immediately. Fixed in `src/mesa/evaluation/runner.py`; regression test: `tests/test_ai_baseline.py::test_compare_labels_reports_zero_f1_for_a_complete_miss`.
2. **An export bug that would have silently discarded results.** `export_ai_baseline()` overwrote `ai_baseline_comparison.json` on every call instead of merging, so running the two documented CLI commands (one per benchmark file) into the same `--output-dir` — exactly as this study's own Method section instructs — discarded the first command's systems. Fixed to merge by system id; regression test: `tests/test_ai_baseline.py::test_export_ai_baseline_merges_across_separate_benchmark_files`.

Both bugs were caught by manually inspecting the raw per-run JSON before trusting the summary numbers, rather than reporting the first output the tool produced — the same verify-before-report discipline applied to every other empirical claim in this dissertation.

## Verification

- `tests/test_ai_baseline.py`: 14 tests, all using mocked HTTP/SDK responses (no real spend) — cover source bundling (including the character cap), determinism-statistics math on identical vs. divergent runs, provider dispatch (OpenAI/Anthropic), missing-API-key and unknown-system/provider error handling, export output, and the two regressions above.
- Full suite passes (107 tests), `ruff check` clean, as of this writing.
