# Initial Build Plan

This first implementation is a vertical slice, not the final research system.

## Implemented First

- CLI and FastAPI entry points sharing one analysis pipeline.
- Python static extraction for endpoints, HTTP calls, URLs, and database strings.
- NetworkX graph construction.
- Initial detectors:
  - Chatty Services.
  - Cyclic Dependencies.
  - Shared Database.
- React + TypeScript dashboard with Cytoscape.js graph rendering.
- Docker Compose for API, frontend, PostgreSQL, and Neo4j.
- GitHub Actions for backend and frontend checks.

## Next Engineering Steps

- Add Tree-sitter parser adapters.
- Add LibCST extraction for richer Python metadata and exact source locations.
- Add JavaParser adapter for Java projects.
- Persist scan metadata in PostgreSQL.
- Persist architectural digital twin snapshots in Neo4j.
- Add health scoring and evolution comparison.
- Add LangGraph/LangChain recommendation workflow.
- Expand detectors beyond the proposal's three core patterns.

