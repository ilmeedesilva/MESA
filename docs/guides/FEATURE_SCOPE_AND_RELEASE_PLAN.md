# MESA Feature Scope and Release Plan

Status: Phase 1 foundation document.

Purpose: Lock the initial upgrade scope, identify non-goals, and define release-oriented milestone boundaries.

## Scope Objective

The MESA upgrade should be delivered in controlled phases so that each phase leaves the platform more coherent, more usable, and easier to build on.

## In Scope for the Upgrade Program

The upgrade program includes:

- product positioning refinement
- dynamic repository ingestion
- automatic service discovery
- guided multi-step workflow UX
- plain-language interpretation improvements
- integrated documentation portal
- AI explainer built on deterministic MESA outputs
- multi-finding remediation roadmap
- expanded research evaluation
- public demo deployment strategy

## Out of Scope for the First Upgraded Release

The first upgraded release should not require:

- replacing detectors with AI-based detection
- arbitrary code execution on scanned repositories
- enterprise-scale multi-user collaboration
- complex permissions systems
- broad multi-provider repo ingestion from day one
- perfect automatic service discovery across every repo layout
- production-grade hosted scaling for large-volume public traffic

## Product Scope Rules

1. Public GitHub-style ingestion is the first external repository target.
2. Service discovery must be reviewable by the user.
3. Findings must stay evidence-grounded.
4. The docs portal is part of the product, not a side artifact.
5. AI features are optional assistants layered on top of the core analysis.

## Release Milestones

### Milestone 1. Foundation and Dynamic Intake

Includes:

- product foundation documents
- repository ingestion design and implementation
- service discovery preview
- basic guided scan entry flow

Definition of done:

- user can start from a repository source instead of only manual path entry
- service discovery exists as a visible step

### Milestone 2. Guided Product Experience

Includes:

- full multi-step scan workflow
- improved interpretation layer
- integrated docs portal
- clearer product language across the UI and docs

Definition of done:

- first-time users can complete a meaningful flow with minimal outside guidance

### Milestone 3. AI Explanation and Roadmapping

Includes:

- AI explainer
- scan summarization
- scan comparison explanation
- multi-finding remediation roadmap

Definition of done:

- users can ask for guided interpretation without compromising deterministic analysis

### Milestone 4. Research and Demo Maturity

Includes:

- expanded real-world evaluation
- evaluator experience improvements
- public-facing demo and documentation deployment

Definition of done:

- MESA can be demonstrated, evaluated, and explained without requiring deep setup knowledge

## Non-Goals by Milestone

### Milestone 1 non-goals

- final AI experience
- final docs portal polish
- advanced public hosting

### Milestone 2 non-goals

- full remediation planning intelligence
- large-scale hosted backend optimization

### Milestone 3 non-goals

- replacing deterministic recommendations entirely
- training a dedicated detector model

### Milestone 4 non-goals

- solving every infrastructure or enterprise deployment scenario

## Readiness Gates

The project should not move to the next milestone unless:

- current milestone docs are updated
- acceptance criteria are satisfied
- risks are understood
- the next milestone has a clear dependency path

## Priority Tiers

### Must Have

- dynamic repository intake
- service discovery
- guided workflow
- interpretation clarity
- docs discoverability

### Should Have

- AI explainer
- remediation roadmap
- polished evaluator journey

### Nice to Have

- advanced hosting options
- deeper AI customization
- broader repository provider support

## Acceptance Criteria

This document is successful if:

- scope creep is easier to detect
- future implementation choices can be checked against milestone boundaries
- non-goals are explicit enough to prevent accidental overbuilding
