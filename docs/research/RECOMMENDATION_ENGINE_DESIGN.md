# MESA Recommendation Engine Design

## Goal

Every finding should lead to actionable guidance, not just detection.

## Output Schema

Each structured recommendation includes root cause, architectural consequence, affected services, affected files, refactoring steps, expected impact, priority, difficulty, evidence, and source.

## Rule-Based Core

MESA uses deterministic rule-based recommendations for all implemented finding types. This ensures recommendations are available without LLM credentials and are reproducible for evaluation.

## Optional LLM Integration

The optional LLM hook is controlled by `MESA_LLM_RECOMMENDATIONS`. If LangGraph/LangChain or credentials are unavailable, MESA falls back to rule-based recommendations. LLMs may refine wording but must not invent facts and must use finding evidence.

## Evidence Grounding

Recommendations reuse finding evidence such as file paths, line numbers, services, cycles, database keys, and scoring metrics. This supports traceability in the viva and thesis.
