# MESA User Personas and Flows

Status: Phase 1 foundation document.

Purpose: Define who MESA serves, what each user type needs, and what primary workflows the product must support.

## Personas

### 1. Research Evaluator

Profile:

- academic evaluator
- supervisor
- external reviewer
- examiner

Goals:

- understand what MESA does quickly
- verify the novelty and methodology
- run or review a guided demo
- see evaluation results and limitations clearly

Pain points today:

- too many internal concepts must be inferred from distributed documents
- usage may feel tool-centric rather than evaluator-centric
- technical input methods can create friction

What this persona needs from the upgraded product:

- a clear landing explanation
- a guided walkthrough
- built-in documentation
- easy demo mode
- direct links to methodology, results, and threats to validity

### 2. Beginner User

Profile:

- student
- junior developer
- first-time user of an architecture analysis tool

Goals:

- run the tool without deep infrastructure knowledge
- understand findings in simple language
- know what to fix first

Pain points today:

- service paths are manual
- finding terminology can feel advanced
- interpretation requires too much prior context

What this persona needs from the upgraded product:

- public repo or upload-based input
- automatic service discovery
- guided step-by-step workflow
- plain-English explanations
- links to help content where confusion naturally happens

### 3. Software Engineer or Architect

Profile:

- experienced practitioner
- technical lead
- architect

Goals:

- inspect cross-service dependencies
- identify architectural risk
- compare architecture across scans
- understand impact and remediation order

Pain points today:

- manual intake workflow does not scale well to unfamiliar repositories
- results are useful but could be prioritized more clearly

What this persona needs from the upgraded product:

- reproducible scans
- evidence-rich findings
- graph context
- governance integration
- roadmap-level remediation suggestions

### 4. Future Contributor

Profile:

- maintainer
- collaborator
- new developer joining the project

Goals:

- understand why the product is evolving
- see the build order
- know what architectural choices are fixed

Pain points today:

- roadmap intent may be visible, but implementation boundaries are not yet formalized in guide docs

What this persona needs from the upgraded product:

- stable product language
- explicit scope boundaries
- AI-specific constraints
- phase-by-phase implementation path

## Primary User Entry Modes

MESA should support three first-class entry modes.

### Public Repo Scan

Who it serves:

- evaluators
- beginners
- engineers exploring public systems

Target flow:

1. User pastes a public repository URL.
2. User optionally selects branch, tag, or commit.
3. MESA fetches a safe static snapshot.
4. MESA detects likely services.
5. User reviews the service set.
6. User runs the scan.
7. User reads findings, graph, health, and recommendations.
8. User optionally opens AI explanation.

### Private Upload or Trusted Local Scan

Who it serves:

- private-project users
- self-hosted users
- internal evaluation scenarios

Target flow:

1. User uploads archives or selects trusted local paths.
2. MESA detects likely services.
3. User confirms or edits the selection.
4. MESA runs the scan.
5. User reviews outputs.

### Demo Mode

Who it serves:

- first-time users
- evaluators
- demos and presentations

Target flow:

1. User opens a built-in example.
2. MESA presents a known architecture scenario.
3. User explores findings and explanation support.
4. User jumps into docs for interpretation if needed.

## Essential Product Journey

The future default journey should be:

1. Understand what MESA is.
2. Choose how to start.
3. Preview the input system.
4. Review discovered services.
5. Run analysis.
6. Interpret results.
7. Learn more or ask AI.
8. Compare scans or plan remediation.

## UX Requirements Derived From Personas

The product must:

- explain itself before asking for technical input
- avoid path-heavy onboarding for public scenarios
- expose evidence and limitations alongside findings
- support both beginner and research-heavy interpretation
- make docs visible where users get stuck

## Flow Constraints

The product must not require a first-time public user to:

- understand Docker-mounted paths
- manually enumerate service directories in advance
- read source code before understanding a finding
- leave the product to find critical documentation

## Acceptance Criteria

This document is successful if future implementation work can clearly answer:

- who each feature is for
- which flow it belongs to
- whether it helps evaluators, beginners, practitioners, or contributors
- what friction it is supposed to remove
