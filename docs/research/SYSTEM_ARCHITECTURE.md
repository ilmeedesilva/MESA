# MESA System Architecture

## Logical Architecture

```text
React + TypeScript Frontend
  Project workflow
  Scan history
  Findings dashboard
  Architecture graph dashboard
  Health scores
  Evolution panel
  Governance policy editor

FastAPI Backend
  Project APIs
  Scan APIs
  Policy APIs
  Graph query APIs
  Evolution APIs
  Evaluation CLI integration

Analysis Core
  Static extractors
  Graph builder
  Anti-pattern detectors
  Health score engine
  Recommendation engine
  Governance evaluator
  Evolution comparator

Persistence
  PostgreSQL: projects, scans, findings, reports, scores, snapshots, policies
  Neo4j: architectural digital twin graph
  NetworkX: in-memory graph algorithms
```

## Key Runtime Flow

1. User creates/selects a project.
2. User optionally saves governance policies.
3. User runs a scan with service paths.
4. Backend extracts static facts and builds a graph.
5. Detectors produce findings.
6. Recommendation engine enriches findings.
7. Governance engine adds policy violations.
8. PostgreSQL persists scan results.
9. Neo4j persists architecture graph.
10. Frontend displays findings, graph, scores, evolution, and policies.

## Deployment

Docker Compose runs FastAPI, React frontend, PostgreSQL, and Neo4j. The API container mounts the repository at `/workspace`, so scan paths in the UI should use `/workspace/...` paths.
