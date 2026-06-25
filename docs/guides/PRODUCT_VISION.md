# MESA Product Vision

Status: Phase 1 foundation document.

Purpose: Define what MESA is becoming, who it is for, what problems it solves, and what decisions should guide future implementation work.

## Product Statement

MESA is an architecture intelligence platform for microservice systems. It builds a static architectural view of a system, detects cross-service anti-patterns, explains risks in plain language, tracks architecture evolution, supports governance policies, and provides actionable remediation guidance.

## Vision

MESA should evolve from a path-based research prototype into a dynamic, user-friendly, explainable platform that can:

- analyze public or local microservice repositories
- automatically discover likely services
- detect architectural anti-patterns through deterministic analysis
- explain findings clearly to non-experts
- support researchers and evaluators with transparent methodology and limitations
- provide optional AI-assisted interpretation grounded in MESA evidence

## Positioning

MESA should be described as:

- an architecture intelligence platform
- a microservice architecture risk analyzer
- a digital twin-based architecture governance and remediation tool

MESA should not be described only as:

- a static analyzer
- a code smell detector
- a graph dashboard

## Target Users

- Research evaluators who need a clear way to understand, use, and assess the tool.
- Students and beginners who need step-by-step guidance and plain-English explanations.
- Software engineers and architects who need reproducible analysis, governance, and remediation support.
- Future contributors who need a stable architectural direction and extension path.

## Core Problems MESA Solves

1. Cross-service architectural risks are difficult to detect when services are inspected in isolation.
2. Microservice anti-patterns are often explained in abstract terms rather than with system-specific evidence.
3. Architecture quality is difficult to track consistently across scans and over time.
4. Existing research tools are often hard for non-experts to evaluate and operate.
5. AI-generated advice is useful, but it needs deterministic evidence and product-specific context to stay trustworthy.

## Product Outcomes

MESA should eventually enable a user to:

1. paste a public repository URL or choose a local/demo source
2. review automatically discovered services
3. run an explainable architecture scan
4. understand findings without reading source code first
5. compare scans over time
6. ask for AI-assisted explanation when needed
7. access all guidance and documentation from inside the product

## Product Principles

1. Deterministic analysis is the source of truth.
2. AI explains and prioritizes; it does not replace detector logic.
3. Every important claim should be traceable to evidence.
4. The beginner experience must be intentional, not accidental.
5. Documentation must be integrated into the product story.
6. Public repository analysis must be safe and static-only.
7. Research honesty is part of the user experience.

## Current Product Reality

The current implementation already includes:

- static multi-service analysis
- graph-based architecture modeling
- findings and recommendations
- governance policies
- scan history and evolution features
- benchmark evaluation support

The current implementation does not yet fully include:

- public repository ingestion
- automatic service discovery workflow
- docs portal inside the UI
- user-facing AI explainer
- guided first-run workflow for non-experts

## First Upgraded Release Goals

The first upgraded release should focus on:

- product clarity
- dynamic repository intake design
- service discovery design
- guided workflow design
- integrated documentation direction

It should not yet attempt to solve every hosting, scaling, or advanced collaboration problem.

## Non-Negotiable Design Decisions

1. MESA remains a deterministic detector platform.
2. AI is layered on top for explanation and guidance.
3. Public repository analysis never executes repository code.
4. Evaluation of detection quality and evaluation of AI explanation quality must remain separate.

## Success Definition

Phase 1 is successful if:

- the product has a stable identity and language
- future implementation work can refer to one canonical vision
- there is no ambiguity about whether AI replaces rule-based detection
- later phases can proceed without revisiting the product fundamentals
