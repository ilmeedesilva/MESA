# Phase 9: Recommendation Layer

Status: Implemented.

## Goal

Move MESA beyond detection by generating actionable, evidence-grounded architectural guidance for every anti-pattern finding.

## Added

- Structured recommendation model attached to each finding.
- Rule-based recommendation engine in `src/mesa/analysis/recommendations.py`.
- Pipeline integration so every scan finding receives at least one structured recommendation.
- Optional LangGraph/LangChain-ready refinement hook that is disabled by default.
- Frontend finding drawer support for structured recommendations.
- Automated tests for evidence-grounded recommendation generation and no-LLM fallback behavior.

## Recommendation Fields

Each structured recommendation contains:

- root cause explanation
- architectural consequence
- affected services
- affected files
- refactoring steps
- expected impact
- priority
- estimated difficulty
- evidence references
- recommendation source

## Rule-Based Coverage

The rule engine currently covers all implemented anti-pattern detectors:

- Chatty Services
- Cyclic Dependencies
- Shared Database
- Hard-Coded Service Dependencies
- God Service

Each recommendation is generated from deterministic detector evidence and the finding's affected service list.

## Optional LLM Integration

MESA is designed to support LangGraph/LangChain-assisted recommendations without requiring an LLM at runtime.

Configuration flag:

```text
MESA_LLM_RECOMMENDATIONS=true
```

Current rules:

- Never generate recommendations without evidence.
- Always include source evidence from scan findings.
- AI may explain or refine rule-based guidance, but must not invent new facts.
- If LangGraph/LangChain dependencies or provider credentials are unavailable, MESA falls back to rule-based recommendations.

The Phase 9 implementation includes a conservative optional hook. It imports LangGraph/LangChain only when enabled and safely returns rule-based guidance when unavailable.

## Frontend Behavior

The finding drawer now shows:

- priority and estimated difficulty
- root cause
- architectural consequence
- expected impact
- affected files when available
- step-by-step refactoring guidance
- recommendation source

The previous single recommendation string remains available for backward compatibility.

## How to Run

```bash
docker compose up --build
```

Open:

```text
http://localhost:5173
```

Run a scan and click any finding in the Findings Dashboard to inspect its structured recommendation.

## How to Test

Backend tests:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider
```

Frontend build:

```bash
cd frontend
npm run build
```

Manual API check:

```bash
curl http://localhost:8000/scans/<scan_id>/findings
```

Confirm each finding contains both:

```json
"recommendation": "...",
"recommendations": [
  {
    "root_cause": "...",
    "architectural_consequence": "...",
    "refactoring_steps": ["..."]
  }
]
```

## Acceptance Criteria Mapping

- Every finding has at least one recommendation: implemented in `enrich_findings_with_recommendations` and covered by tests.
- Recommendations are evidence-grounded: each recommendation carries evidence references from the original finding.
- System works without LLM: rule-based engine is the default and tests remove LLM configuration.
- LLM integration is optional: controlled by `MESA_LLM_RECOMMENDATIONS` and safe optional imports.

## Limitations

- LLM provider calls are not enabled by default in Phase 9; this avoids introducing non-deterministic behavior into thesis evaluation.
- Recommendations are generated at finding level, not yet as a coordinated multi-finding remediation roadmap.
- Effort estimates are heuristic and based on anti-pattern type and severity.
