# MESA Evaluator Quick Start

## Purpose

This page is the fastest way for an evaluator to understand what MESA is, how to try it, and how to judge its outputs.

## What MESA Is

MESA is an explainable microservice architecture analysis platform. It performs static, deterministic analysis of repository structure and service relationships, then presents:

- anti-pattern findings
- architecture graph views
- health scores
- governance policy violations
- recommendations
- scan history and evolution

## Recommended Evaluation Path

1. Open the application UI.
2. Review the guided workflow.
3. Run a scan on a demo fixture or supported repository source.
4. Review findings in `Beginner` mode first.
5. Switch to `Research` mode to inspect evidence and detector framing.
6. Open the documentation portal for methodology, limitations, and demo guidance.

## What To Inspect First

- `Findings Dashboard`
  - confirms whether MESA detected meaningful architecture risks
- `Architecture Graph`
  - shows service relationships and hotspots visually
- `Health Scores`
  - summarizes architecture quality dimensions
- `Architecture Evolution`
  - shows how architecture changed across scans

## What Makes MESA Credible

- detection remains deterministic
- results are evidence-based
- AI explanation is treated as a layer above detector output, not as the detector itself
- findings expose confidence and limitations

## Important Limitation

MESA performs static analysis only. It does not execute repository code and does not claim runtime truth.

## Suggested Reading

- `Getting Started`
- `How To Read Findings`
- `Health Score Guide`
- `Evaluation And Limitations`
- `Demo Guide`
