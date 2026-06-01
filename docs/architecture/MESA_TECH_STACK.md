# MESA Technology Stack

Status: Current approved stack reference.

## Core Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI |
| Static Analysis Engine | Tree-sitter, Python AST, LibCST, JavaParser for Java projects only |
| Graph Engine | Neo4j, NetworkX |
| Database | PostgreSQL |
| Frontend | React + TypeScript |
| Visualization | Cytoscape.js |
| AI Recommendation Layer | LangGraph, LangChain, OpenAI, Claude, local LLMs |
| Containerization | Docker |
| CI/CD | GitHub Actions |

## Architectural Rationale

MESA remains faithful to the proposal's Python static-analysis prototype while expanding into a research-grade platform. FastAPI keeps the backend and analysis engine in the same language family, Tree-sitter provides multi-language AST coverage, Python AST and LibCST support deeper Python analysis, and JavaParser is reserved for Java projects where Java-specific parsing improves precision.

Neo4j stores the persistent architectural digital twin. NetworkX supports in-memory graph algorithms, detector experiments, and evaluation workflows. PostgreSQL stores project metadata, scans, findings, policies, metrics, reports, and snapshot records.

The AI recommendation layer must be evidence-grounded. LangGraph should orchestrate recommendation workflows, LangChain should abstract model providers, and OpenAI, Claude, or local LLMs should only explain and structure recommendations from deterministic detector evidence.

## Implementation Position

The proposal's command-line prototype remains a valid interface and evaluation path. The platform should expose the same core analysis through:

- CLI commands for reproducible research evaluation.
- FastAPI endpoints for the web application.
- React + TypeScript dashboard for graph visualization, findings, health scores, evolution, recommendations, and governance.

## Superseded Assumptions

The current architecture does not use Spring Boot as the backend framework. JavaParser is not the primary platform runtime; it is an optional analyzer for Java repositories. OpenRewrite is not part of the approved core stack unless added later as a specific refactoring-analysis extension.
