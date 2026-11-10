# MESA Quick Start

## Purpose

This page is the fastest way to understand what MESA is, how to try it, and how to read its results.

## What MESA Is

MESA is an explainable microservice architecture analysis platform. It performs static, deterministic analysis of repository structure and service relationships, then presents:

- anti-pattern findings
- architecture graph views
- health scores
- governance policy violations
- recommendations
- scan history and evolution

## First Steps

1. Open the application UI.
2. Review the guided workflow.
3. Run a scan on a demo fixture or supported repository source.
4. Review findings with the `Simple` explanation level first.
5. Switch to `Technical` to see finding IDs, rules, exact file locations and raw evidence.
6. Open the documentation for scanning guides, how to read results, and the API reference.

## What To Inspect First

- `Findings`
  - confirms whether MESA detected meaningful architecture risks
- `Architecture Graph`
  - shows service relationships and hotspots visually
- `Health Scores`
  - summarizes architecture quality dimensions
- `History`
  - shows how architecture changed across scans

## What Makes MESA Credible

- detection remains deterministic
- results are evidence-based
- AI explanation is treated as a layer above detector output, not as the detector itself
- findings expose confidence and limitations

## Important Limitation

MESA performs static analysis only. It does not execute repository code and does not claim runtime truth.

## Suggested Reading

- `Getting started`
- `Findings`
- `Health score`
- `Supported inputs` (includes known limitations)
- `Demo data`
