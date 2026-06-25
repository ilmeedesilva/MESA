# MESA Methodology

## Research Approach

MESA follows design science research: identify a practical software engineering problem, build an artifact, evaluate the artifact, and document limitations. The artifact is a working static analysis platform for microservice architecture assessment.

## Process

1. Requirement analysis from proposal and defense feedback.
2. Incremental phased implementation from persistence to evaluation.
3. Static evidence extraction from service source code and configuration.
4. Architecture graph construction with NetworkX and Neo4j.
5. Rule-based detector execution over graph and service facts.
6. Health score, recommendation, governance, and evolution analysis.
7. Evaluation against seeded benchmark systems with ground truth.

## Data Sources

MESA uses local service directories containing Python, Java, JavaScript/TypeScript, YAML, `.env`, Docker Compose, and common config/build files. Runtime telemetry is not required.

## Evaluation Method

The evaluation runner compares detector output against ground truth labels using type and affected service set. It reports true positives, false positives, false negatives, precision, recall, and F1-score at system and overall levels.
