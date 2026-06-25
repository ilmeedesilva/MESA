# MESA Product Language and Terminology

Status: Phase 1 foundation document.

Purpose: Define the approved language that should be used across documentation, UI, and future implementation work.

## Product Name

Use:

- MESA

Optional expanded form:

- MESA architecture intelligence platform

## Preferred Product Description

Preferred:

- MESA is an architecture intelligence platform for microservice systems.
- MESA performs static cross-service analysis to detect architectural risks and explain them with evidence.
- MESA builds a digital architectural view of a system and uses it for detection, governance, scoring, and remediation guidance.

Avoid using as the only description:

- code smell detector
- static code checker
- dependency graph tool

## Preferred User-Facing Terms

Use:

- finding
- evidence
- confidence
- affected services
- affected files
- architectural risk
- health score
- recommendation
- remediation roadmap
- service discovery
- scan comparison
- governance policy
- AI explainer

## Terms That Need Explanation When Shown to Users

These terms may still appear, but should be explained in plain language when user-facing:

- chatty service
- cyclic dependency
- shared database
- hard-coded service dependency
- god service
- governance violation
- centrality
- architectural digital twin

## Interpretation Rules

Every user-facing finding should make these distinctions clear:

- evidence: what MESA directly observed
- inference: what MESA concludes from that evidence
- confidence: how strongly the evidence supports the conclusion
- limitation: what the result does not prove

## Severity Language

Severity should always be paired with a human explanation.

Example:

- `High severity` is acceptable only if accompanied by why the issue matters.

Preferred pattern:

- `High severity because this dependency pattern may reduce deployment independence.`

## AI Language Rules

When AI explanation is added, the assistant should:

- refer to MESA findings, not replace them
- explain evidence before giving advice
- separate direct facts from recommendations
- acknowledge uncertainty when evidence is incomplete

## Approved Messaging Themes

Preferred themes:

- explainable
- evidence-grounded
- deterministic detection
- beginner-friendly interpretation
- research-transparent
- architecture-focused

Avoid themes that imply unsupported claims:

- fully automatic architecture truth
- perfect real-world detection
- autonomous architecture redesign
- AI-powered detection engine as the primary identity

## Short Product Taglines

Approved options:

- Explain microservice architecture risk with evidence.
- Detect, explain, and improve cross-service architecture.
- Architecture intelligence for microservice systems.

## Current-to-Future Messaging Rule

When describing the current codebase, be precise:

- say `current implementation` when referring to existing capabilities
- say `target product` or `future workflow` when referring to planned capabilities

This avoids overstating what is already implemented.

## Acceptance Criteria

This terminology guide is successful if:

- future docs and UI changes can reuse a consistent language set
- contributors do not need to guess how to describe MESA
- the product avoids overstating AI or analysis capabilities
