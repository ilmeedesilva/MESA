# MESA Final Demo Script

## Goal

Demonstrate that MESA can analyze multi-service repositories, build an architectural digital twin, detect anti-patterns, provide recommendations, enforce policies, track evolution, and produce evaluation metrics.

## Preparation

```bash
docker compose up --build
```

Open:

- `http://localhost:5173`
- `http://localhost:8000/docs`
- `http://localhost:7474`

## Demo Flow

### 1. Introduce MESA

Say: MESA is a static architectural intelligence platform for microservice systems. It builds a graph-based digital twin from source and configuration evidence.

### 2. Create Project

Create `MESA Demo Project` in the UI.

### 3. Add Governance Policies

Use the default YAML policies and save them.

### 4. Run Scan

Use fixture paths:

```text
/workspace/tests/fixtures/god/platform-service
/workspace/tests/fixtures/god/order-service
/workspace/tests/fixtures/god/billing-service
/workspace/tests/fixtures/god/inventory-service
/workspace/tests/fixtures/god/user-service
/workspace/tests/fixtures/god/payment-service
/workspace/tests/fixtures/god/notification-service
```

### 5. Show Findings Dashboard

Point out cyclic dependencies, hard-coded dependencies, God Service, and governance policy violations.

### 6. Open Finding Details

Show structured recommendation: root cause, consequence, affected files, refactoring steps, priority, and difficulty.

### 7. Show Architecture Graph

Click a service and an edge. Explain how graph evidence links findings to services and dependencies.

### 8. Show Health Scores

Explain system score and weakest dimensions.

### 9. Show Evolution

Run a second scan or select previous scan history. Explain snapshot comparison.

### 10. Show Evaluation Runner

Run:

```bash
PYTHONPATH=src python3 -m mesa.cli evaluate benchmarks/ground_truth.yml --output-dir evaluation-results
```

Show CSV/JSON outputs for thesis tables.

## Viva Closing Statement

MESA is unique because it is not just detecting smells. It creates a persistent architecture model, evaluates it with reproducible metrics, tracks change over time, and turns evidence into governance and recommendations.
