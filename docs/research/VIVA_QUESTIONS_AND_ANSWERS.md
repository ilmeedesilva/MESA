# MESA Viva Questions and Answers

## 1. What is unique about MESA?

MESA builds a static architectural digital twin of a microservice ecosystem and uses it for detection, recommendations, health scoring, governance, evolution tracking, and evaluation. The uniqueness is the integrated, persistent, graph-based architecture intelligence workflow.

## 2. Why can't an AI agent simply replace this tool?

AI agents can inspect code, but MESA provides persistent architecture memory, reproducible metrics, source evidence, graph queries, policy enforcement, and snapshot trends. AI can complement MESA by interpreting its outputs, but MESA provides the structured evidence and repeatable measurement layer.

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
