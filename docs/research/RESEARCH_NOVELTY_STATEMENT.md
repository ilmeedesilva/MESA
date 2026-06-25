# MESA Research Novelty Statement

## Project

MESA: A Cross-Service Static Analysis Tool for Detecting Microservices Architectural Anti-Patterns.

## Core Novelty

MESA is not only a static analyzer, dependency graph visualizer, or smell detector. Its novelty is the construction of a static architectural digital twin for microservice ecosystems and the use of that persistent graph model for detection, health scoring, architecture evolution tracking, recommendation generation, governance policy enforcement, and research evaluation.

## Research Contributions

1. Cross-service static architecture analysis: MESA analyzes multiple service repositories together and detects risks that are invisible when each service is inspected in isolation.
2. Architectural digital twin: MESA converts source, configuration, API, database, dependency, and environment evidence into graph entities and relationships.
3. Static prediction of runtime-like risks: MESA estimates risks such as chatty services and deployment coupling from static call sites, dependency topology, hard-coded endpoints, shared persistence, and graph centrality.
4. Architectural health scoring: MESA calculates service, domain, and system-level health scores using explainable dimensions.
5. Evolution tracking: MESA stores scan snapshots and compares changes across scans to detect new risks, resolved risks, dependency changes, cycle changes, and score trends.
6. Evidence-grounded recommendations: MESA generates structured root causes, consequences, affected files/services, refactoring steps, priority, difficulty, and expected impact.
7. Governance engine: MESA allows users to define architecture policies in YAML/JSON and turns violations into scan findings.
8. Reproducible evaluation runner: MESA includes synthetic benchmark systems, ground truth labels, and precision/recall/F1 export.

## Why MESA Remains Useful When AI Agents Improve

AI agents can inspect code and produce advice, but they are often session-based, non-deterministic, and difficult to compare across releases. MESA complements AI by providing persistent architectural memory, repeatable metrics, source evidence, graph queries, policy enforcement, and trend analysis. An AI agent can use MESA output as trusted architecture evidence, but MESA supplies the structured model and reproducible measurements.

## Final Positioning Sentence

MESA is a static architectural intelligence platform that builds a digital twin of a microservice ecosystem and uses it to detect, explain, govern, and evaluate cross-service architectural risk before deployment.
