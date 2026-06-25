# MESA Proposal Baseline

Status: Proposal text baseline provided by the project author.

## Title

MESA: A Cross-Service Static Analysis Tool for Detecting Microservices Architectural Anti-Patterns

## Research Problem

The research addresses the absence of automated approaches for discovering architectural anti-patterns in microservice architectures. Individual services may satisfy quality checks in isolation, while cross-service problems emerge only when services are considered as one system.

Core problem statement:

How can we automatically detect architectural anti-patterns that arise only when multiple microservices are considered together?

Key concerns:

- Excessive cross-service communication, such as Chatty Services.
- Dependency cycles that cannot be found by single-service analysis.
- Shared database usage across services.

## Original Objectives

- Develop a static analysis framework capable of consuming several microservice source repositories and generating an interaction model.
- Generate a unified service dependency graph by parsing source code, API calls, service endpoints, shared database configurations, and related metadata.
- Detect Chatty Services, Cyclic Dependencies, and Shared Database Coupling using graph-based algorithms and pattern rules.
- Build a Python command-line prototype that accepts multiple repositories and produces a structured report.
- Evaluate the tool's detection effectiveness using precision, recall, and F1-score on benchmark microservice projects.

## Research Questions

| ID | Research Question |
|---|---|
| RQ1 | What design factors must be considered when developing a static analysis framework that assesses multiple microservice repositories simultaneously to create an integrated model of inter-service interactions? |
| RQ2 | What graph-based algorithms and pattern matching rules can be applied to a service dependency graph to find Chatty Services, Cyclic Dependencies, and Shared Database anti-patterns with high reliability? |
| RQ3 | Can a static analysis framework be developed as a command-line tool that allows users to specify one or more repositories as input and produce a valid, actionable anti-pattern report? |
| RQ4 | How accurately can the proposed tool discover and characterize known microservice anti-patterns on benchmark projects using precision, recall, and F1-score? |

## Proposal Scope

In scope:

- Static repository analysis.
- Multiple microservice repositories as input.
- Chatty Services.
- Cyclic Dependencies.
- Shared Database anti-pattern.
- Command-line prototype.
- Textual or structured reports.
- Evaluation with public projects, known examples, or synthetic anti-patterns.

Out of scope:

- Runtime monitoring or dynamic tracing.
- Monolithic systems.
- Automatic refactoring or fixing.
- Security analysis.
- Performance monitoring beyond architectural communication patterns.
- Proprietary datasets.

## Methodology

1. Data collection from sample microservice systems, GitHub projects, or synthetic test cases.
2. Static code analysis using parsers and metadata extraction.
3. Dependency graph construction, with services as nodes and service communication or shared datastore relationships as edges.
4. Anti-pattern detection:
   - Chatty Services: identify service pairs exceeding a static communication threshold.
   - Cyclic Dependencies: use graph cycle detection for service dependency loops of length two or greater.
   - Shared Database: identify multiple services sharing database tables or schemas through configuration evidence.
5. Prototype implementation as a Python command-line tool.
6. Evaluation using ground-truth labels, precision, recall, F1-score, and comparison against single-service analysis limitations.

## Literature Positioning

The proposal is grounded in:

- Microservice anti-pattern catalogues and surveys.
- Static analysis research for cloud-native systems.
- Graph-based anti-pattern detection.
- Dynamic analysis and visualization approaches.
- The gap between single-service analysis tools and cross-service architectural analysis.

## References From Proposal

- Aziz, J., & Rasool, G. (2025). Microservice Antipatterns: Causes, Detection, and Refactoring Challenges.
- Braz, L. H. de, França, B. B. N. de, & Cafeo, B. B. P. (2025). Dynamic Analysis for Detecting Microservices Antipatterns.
- Cerny, T., Abdelfattah, A. S., Abdullah Al Maruf, Janes, A., & Taibi, D. (2023). Catalog and detection techniques of microservice anti-patterns and bad smells: A tertiary study.
- Černý, T., & Taibi, D. (2022). Static analysis tools in the era of cloud-native systems.
- Røhne, A. L., Pronk, B., & Akesson, B. (2024). Graph-based Anti-Pattern Detection in Microservice Applications.
- Parker, G., Kim, S., Abdullah Al Maruf, Cerny, T., Karel Frajtak, Pavel Tisnovsky, & Taibi, D. (2023). Visualizing Anti-Patterns in Microservices at Runtime: A Systematic Mapping Study.
- SonarQube Server documentation.

## Relationship to Current Architecture

The current MESA architecture preserves the proposal's static analysis, graph construction, command-line reproducibility, and evaluation goals. It extends the proposal with FastAPI, React + TypeScript, Neo4j, NetworkX, PostgreSQL, Tree-sitter, LibCST, optional JavaParser, architecture health scoring, evolution tracking, governance, and AI-assisted recommendations.
