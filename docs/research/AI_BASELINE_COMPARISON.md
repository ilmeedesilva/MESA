# AI Baseline Comparison

Status: Harness implemented and verified with mocked HTTP calls; the real, billed evaluation run has not been executed yet (blocked on OpenAI/Anthropic account credit as of this writing). This document is written now so the methodology and related-work grounding are fixed before the numbers exist — deliberately mirroring the dissertation's own practice (Chapter 3, Artifact Evaluation Strategy) of treating a pre-defined but not-yet-executed evaluation as a documented plan, not a result.

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

- Systems: `god-service` (8 services, synthetic), `cyclic-dependencies` (2 services, synthetic, control case), `spring-sample` (6 services, real repository, post config-server-misattribution fix — see `docs/architecture/PHASE_17_CONFIG_SERVER_MISATTRIBUTION_FIX.md`).
- For each system, the LLM is given MESA's own anti-pattern taxonomy (from `docs/research/DETECTION_ALGORITHMS.md`) and the system's concatenated source (capped at 60,000 characters — itself a data point: `spring-sample`'s real source exceeds this cap and is truncated, illustrating a hard LLM context-window ceiling that static, per-file extraction does not have).
- Each system is run 5 times with an identical prompt. Findings are scored against the same ground truth MESA is scored against, using the same `compare_labels()` function MESA's own evaluation runner uses (`src/mesa/evaluation/runner.py`) — so there is no risk of "different math" between MESA's score and the LLM's score.
- Determinism is reported as: exact-match rate (fraction of the 5 runs producing an identical finding-set) and mean pairwise Jaccard similarity across the 5 runs' finding-sets.
- Supports both OpenAI and Anthropic as the LLM provider (`src/mesa/evaluation/ai_baseline.py`, CLI: `mesa evaluate-ai-baseline <benchmark.yml> --systems <ids> --runs 5 --provider openai|anthropic`), so the study is not tied to one vendor's model behavior.

## Results

Pending. Real API credit is required to run this (each provider account attempted so far had insufficient credit as of 2026-09-21). Estimated cost: ~$0.10–$0.25 total for all 15 calls depending on provider/model. This section will be filled in with the real per-system precision/recall/F1 (mean ± stdev) and determinism table once the run completes.

## Verification

- `tests/test_ai_baseline.py`: 12 tests, all using mocked HTTP/SDK responses (no real spend) — cover source bundling (including the character cap), determinism-statistics math on identical vs. divergent runs, provider dispatch (OpenAI/Anthropic), missing-API-key and unknown-system/provider error handling, and export output.
- Full suite passes (94 tests), `ruff check` clean, as of this writing.
