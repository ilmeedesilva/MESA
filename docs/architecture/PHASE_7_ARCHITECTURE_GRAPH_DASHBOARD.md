# Phase 7: Architecture Graph Dashboard

Status: Implemented.

## Goal

Build the Architectural Digital Twin dashboard so MESA can visualize persisted architecture graph data, expose risk context, and link findings back to graph elements.

## Added

- Frontend loading of the Neo4j-backed architecture graph through `GET /scans/{scan_id}/graph`.
- Fallback rendering from the scan report graph if the digital twin API is unavailable.
- Digital twin node mapping for services, APIs, databases, config, libraries, brokers, and environment variables.
- Digital twin relationship mapping for dependency, API, database, and shared-resource relationships.
- Interactive Cytoscape node and edge inspection.
- Graph-level risk highlighting for cyclic dependencies, God Services, shared database usage, and hard-coded dependencies through linked findings.
- Graph inspector panel showing selected element metadata, linked findings, health score, and evidence properties.
- Improved graph layout with layered placement for service hubs, inbound/outbound services, APIs, databases, and supporting resources.
- Updated frontend layout so architecture graph, health scores, and findings dashboard remain visually separate and readable.

## UI Behavior

The dashboard now treats the graph as an architectural digital twin rather than a simple service diagram.

- Blue circular nodes represent services.
- Green diamond nodes represent per-service API groups, for example `APIs (5)`, instead of rendering every endpoint as a separate noisy node.
- Purple rounded nodes represent databases.
- Grey rounded nodes represent supporting resources such as config, libraries, brokers, or environment variables.
- Red, orange, or amber borders and edges indicate linked architectural risk.
- The canvas keeps labels intentionally compact; detailed wording and evidence are shown in the inspector after clicking a node or edge.
- Clicking a node opens a graph inspector with ownership, linked findings, and service health context.
- Clicking an edge opens dependency evidence and linked anti-pattern findings.

## Data Flow

1. User creates or selects a project.
2. User runs a scan from the dashboard.
3. Backend persists scan results and graph data.
4. Frontend loads the scan result.
5. Frontend calls `GET /scans/{scan_id}/graph` to retrieve the Neo4j architecture graph.
6. Frontend converts Neo4j nodes and relationships into Cytoscape elements.
7. Findings and health scores are joined onto graph elements for visual risk highlighting.

## Acceptance Criteria Mapping

- Graph loads from backend API: implemented through `loadDigitalTwinGraph()`.
- Nodes and edges are interactive: implemented through Cytoscape click handlers and `GraphInspector`.
- Findings are visually linked to graph elements: implemented through finding-to-service and finding-to-edge matching, risk coloring, and linked finding chips.

## How to Run

```bash
docker compose up --build
```

Open the frontend:

```text
http://localhost:5173
```

Use the default fixture paths or provide one service directory per line using Docker container paths such as:

```text
/workspace/tests/fixtures/god/platform-service
/workspace/tests/fixtures/god/order-service
/workspace/tests/fixtures/god/billing-service
/workspace/tests/fixtures/god/inventory-service
/workspace/tests/fixtures/god/user-service
/workspace/tests/fixtures/god/payment-service
/workspace/tests/fixtures/god/notification-service
```

## How to Test

Frontend build:

```bash
cd frontend
npm run build
```

Manual dashboard validation:

1. Start Docker Compose.
2. Open `http://localhost:5173`.
3. Create or select a project.
4. Run a scan against the `tests/fixtures/god` services.
5. Confirm the graph shows services, APIs or resources when present, databases, and dependency edges.
6. Click a service node and confirm the graph inspector shows linked findings and health score context.
7. Click a risky edge and confirm evidence/finding context appears.
8. Confirm the health score panel no longer overlaps the findings dashboard.

Backend graph API check:

```bash
curl http://localhost:8000/scans/<scan_id>/graph
```

## Limitations

- The dashboard performs deterministic client-side layout rather than using an advanced graph layout plugin.
- Finding-to-edge linking is heuristic and based on involved services and relationship type.
- API/config/library/broker visibility depends on what the current static analyzers extract into the Neo4j graph.
- The frontend bundle is larger than 500 kB because Cytoscape is bundled directly; this is acceptable for the current thesis/demo prototype.
