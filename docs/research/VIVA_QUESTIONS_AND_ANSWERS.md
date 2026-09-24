# MESA Viva Questions and Answers

## 1. What is unique about MESA?

MESA builds a static architectural digital twin of a microservice ecosystem and uses it for detection, recommendations, health scoring, governance, evolution tracking, and evaluation. The uniqueness is the integrated, persistent, graph-based architecture intelligence workflow.

## 2. Why can't an AI agent simply replace this tool?

AI agents can inspect code, but MESA provides persistent architecture memory, reproducible metrics, source evidence, graph queries, policy enforcement, and snapshot trends. AI can complement MESA by interpreting its outputs, but MESA provides the structured evidence and repeatable measurement layer. This is measured, not just argued: MESA's AI baseline comparison (`docs/research/AI_BASELINE_COMPARISON.md`) runs the same prompt 5 times per benchmark system against a general-purpose LLM (Claude Sonnet 5) and reports an exact-match rate and mean pairwise Jaccard similarity across those runs, alongside precision/recall/F1 — MESA's equivalent numbers are deterministic by construction. Real result on a real repository (`spring-sample`): the LLM's exact-match rate was 40% and its F1 was 0.0000 (zero real anti-patterns found across 5 runs), against MESA's 1.0000/100%. This directly extends De Luca et al. (2026), who benchmarked LLMs against the static tool MARS but explicitly state their own repeated-run check "was not systematic across all repositories," and who do not analyze how accuracy changes as system size grows.

## 2a. Doesn't a tool like this already exist?

Yes, in part — and the dissertation should not claim otherwise. MARS (Tighilt et al., 2023) and DAMP (Mohammadi & Rasoolzadegan, 2026) are both static-analysis tools that detect overlapping sets of microservice anti-patterns (cyclic dependency, shared persistence, hard-coded endpoints, among others). A tertiary study (Cerny et al., 2023) and a 2025 systematic literature review each catalogue further detection tools and dozens of named anti-patterns. What does not already exist, and is where MESA's contribution actually sits, is the *combination*: a persistent architectural digital twin, evidence-confidence ledger, health scoring, evolution tracking across scans, a governance/fitness-gate policy engine, and a reproducible evaluation runner, all built around the same graph model — plus, distinct from any of the cited static tools, an empirical, repeated-run comparison against an LLM baseline that measures determinism and scale-sensitivity rather than asserting them. See `docs/research/COMPETITIVE_POSITIONING.md` for the full comparison table.

## 3. How are runtime-like anti-patterns detected statically?

MESA does not claim to measure runtime behavior. It estimates runtime-like risks from static evidence: call-site counts, API topology, dependency cycles, hard-coded endpoints, shared databases, centrality, and service ownership signals.

## 4. How does MESA provide recommendations?

Each finding is enriched with structured rule-based recommendations: root cause, consequence, affected services/files, refactoring steps, expected impact, priority, difficulty, and evidence. Optional LLM support can refine explanations but cannot invent facts.

## 5. How is accuracy evaluated?

MESA includes benchmark systems and ground-truth YAML. The evaluation runner compares predicted findings with ground truth using type and affected service set, then calculates precision, recall, F1-score, false positives, and false negatives.

## 6. What are the limitations?

MESA is static, so it may miss dynamic behavior. Current language/framework extraction is limited. Benchmarks are synthetic. Distributed monolith is evaluated through measurable symptoms rather than a dedicated detector. LLM integration is optional and conservative.

## 7. What is the future work?

Future work includes more languages/frameworks, deeper API contract analysis, DTO/entity ownership extraction, dedicated distributed monolith and service intimacy detectors, public benchmark validation, richer LLM workflows, and CI integration for architecture regression gates.
