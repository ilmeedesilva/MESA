# Remediation Roadmap Guide

## Purpose

The remediation roadmap turns separate MESA findings into one grouped improvement plan.

Instead of reading each finding alone, you can use the roadmap to answer:

- what should be fixed first
- which fixes are quick wins
- which fixes are deeper architecture work
- which actions depend on earlier actions

## What The Roadmap Shows

Each roadmap is built per scan and includes:

- `Quick Wins`
  - low-effort fixes that reduce noise or operational coupling early
- `Medium-Term Changes`
  - boundary or interaction improvements that need more design work
- `High-Effort Refactors`
  - structural changes such as cycle removal, shared database separation, or God Service decomposition
- `Suggested Order`
  - the recommended action sequence
- `Dependencies`
  - actions that should happen only after another action is complete

## How MESA Builds The Roadmap

The roadmap is deterministic.

It uses real scan evidence from:

- finding severity
- finding confidence
- affected services
- service centrality in the graph
- linked finding concentration
- health score pressure
- governance policy violations

The current implementation groups findings into broader action types such as:

- hard-coded endpoint cleanup
- chatty interaction reduction
- cycle removal
- shared database ownership fixes
- God Service decomposition
- governance compliance actions

## How To Read The Buckets

### Quick Wins

Use these first when you want progress quickly with low implementation friction.

Typical examples:

- externalizing hard-coded URLs
- moving endpoint values into configuration

### Medium-Term Changes

Use these when you need to improve boundaries or coordination but do not yet need a major migration.

Typical examples:

- reducing chatty service interactions
- resolving governance rules after underlying fixes are complete

### High-Effort Refactors

Use these for the architectural changes that reshape service ownership or dependency structure.

Typical examples:

- breaking cycles
- removing shared database access
- decomposing a God Service

## How To Interpret Priority Correctly

Priority is not based on severity alone.

MESA also considers:

- how central the affected service is
- how many findings are concentrated around it
- whether the service health score is already weak
- whether the action is part of a bigger structural hotspot

Practical interpretation:

- high score + no dependency
  - usually a strong candidate to start soon
- high score + has dependencies
  - important, but should begin after prerequisite work
- lower score + quick win
  - still valuable if it removes noise and helps later work

## How To Use It In The UI

1. Run or load a scan.
2. Open the `Remediation Roadmap` panel in the analysis view.
3. Read the roadmap summary first.
4. Check the `Suggested Order`.
5. Review dependencies before planning implementation.
6. Open the findings drawer if you need deeper per-finding detail.
7. Use the AI explainer if you want a simpler explanation of why an action matters.

## How To Test It Step By Step

### UI Test

1. Start the stack:

```bash
docker compose up --build
```

2. Open:

```text
http://localhost:5173
```

3. Create a project.
4. Run a scan.
5. Confirm that the `Remediation Roadmap` panel appears.
6. Check that these sections render:

- summary
- quick wins
- medium-term changes
- high-effort refactors
- suggested order
- dependencies

7. Load an older scan from history and confirm the roadmap updates with that scan.

### API Test

Call:

```text
GET /scans/{scan_id}/roadmap
```

Expected response shape:

- `summary`
- `quick_wins`
- `medium_term_changes`
- `high_effort_refactors`
- `suggested_order`
- `dependencies`

### Automated Test

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider tests/test_api.py
```

The roadmap test checks that:

- a mixed scan returns grouped actions
- all roadmap buckets are populated when expected
- suggested order is returned
- dependency links are returned

## Current Scope

The current roadmap is intentionally rule-based and explainable.

It does not yet:

- learn from historical remediation outcomes
- estimate engineering time in days
- assign owners automatically
- generate implementation tickets automatically

Those can be added later, but the current version keeps the roadmap auditable and easy to validate for research.
