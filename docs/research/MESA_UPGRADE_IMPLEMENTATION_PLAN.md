# MESA Upgrade Implementation Plan

Status: Proposed.

Purpose: This document is the canonical implementation roadmap for evolving MESA from a path-based research prototype into a dynamic, user-friendly, explainable architecture intelligence platform.

Primary use:

- Human planning reference for phased delivery.
- AI-readable build specification for future implementation work.
- Alignment document for product, research, engineering, UX, and evaluation decisions.

## 1. Executive Summary

MESA already provides meaningful research value through static cross-service analysis, graph-based architecture modeling, health scoring, recommendations, governance, and evaluation. The next major evolution is to make MESA:

- dynamic instead of path-hardcoded
- usable on public external repositories
- easy for non-experts to understand
- trustworthy through evidence-grounded interpretation
- easier to evaluate through in-app documentation and guided workflows
- optionally enhanced by an AI explainer that does not replace deterministic detection

This plan defines the target architecture, product direction, phased build order, technical scope, evaluation strategy, and acceptance criteria needed to implement that evolution correctly.

## 2. Problem Statement

The current MESA implementation is strong as a research artifact, but several characteristics limit broader adoption and evaluator usability:

- analysis is currently centered on local service paths
- the main UI assumes technical familiarity with repository paths and Docker-mounted paths
- service selection is largely manual
- findings are technically meaningful but still require interpretation effort
- the documentation exists, but it is distributed across markdown files and not integrated into the product experience
- AI support is only partially prepared and not yet exposed as a user-facing architecture explainer
- public users cannot easily try MESA on an external public repository without local setup

These limitations make the tool harder to demonstrate, harder to evaluate by third parties, and less accessible to non-expert users.

## 3. Product Vision

MESA should become:

> A static architecture intelligence platform that can ingest public or local microservice repositories, automatically discover services, detect architectural anti-patterns, explain risks in plain language, recommend prioritized remediation steps, track evolution over time, enforce governance policies, and optionally provide AI-assisted interpretation grounded in scan evidence.

## 4. Core Product Positioning

MESA should not be positioned only as:

- a static analyzer
- a code smell detector
- a graph visualization tool

MESA should be positioned as:

- an architectural intelligence platform
- an explainable microservice architecture risk analyzer
- a digital twin-based architecture governance and remediation platform

## 5. Guiding Principles

All implementation decisions in future phases should follow these principles:

1. Detection must remain deterministic and evidence-based.
2. AI must explain and prioritize, not invent detector facts.
3. The product must be usable by non-experts without prior knowledge of repository layouts.
4. Every major finding should be interpretable in plain language.
5. Public demos must work even when the full backend is not available.
6. Research credibility must be preserved by clearly separating measured detection quality from AI explanation quality.
7. Every automated inference should expose evidence and limitations.
8. Documentation must be accessible from inside the product.
9. The system should be safe when analyzing public repositories: static read-only analysis only, no execution.
10. The build order should reduce risk by solving ingestion and workflow problems before adding more AI complexity.

## 6. Current State Summary

Current MESA strengths:

- multi-service static analysis
- anti-pattern detection
- graph-based architecture model
- recommendation engine
- governance policy support
- scan history and evolution support
- benchmark and evaluation runner
- research documentation set

Current gaps to address:

- repo URL ingestion is missing
- service discovery is not yet a first-class workflow
- UI is still admin-oriented rather than guided
- docs are not integrated into an in-app documentation portal
- AI explainer is not exposed as a product feature
- hosted public evaluation path is not yet optimized

## 7. Target User Types

### 7.1 Research Evaluator

Needs:

- fast understanding of project purpose
- clear usage instructions
- ability to run demo scenarios
- visibility into methodology and limitations
- easy access to evaluation outputs

### 7.2 Student or Beginner User

Needs:

- simple onboarding
- plain-English explanations
- guided workflow
- “what should I do next?” assistance

### 7.3 Software Engineer or Architect

Needs:

- architecture graph
- reproducible scans
- governance enforcement
- actionable remediation
- scan comparison and trend analysis

### 7.4 Future Research Collaborator

Needs:

- clear architecture
- implementation roadmap
- extension points
- testing strategy
- evaluation strategy

## 8. Target User Flows

MESA should support three primary entry flows.

### 8.1 Public Repo Scan

1. User pastes one or more public repository URLs.
2. User chooses branch, tag, or commit if desired.
3. MESA fetches repository snapshots into a temporary workspace.
4. MESA discovers likely services automatically.
5. User reviews or edits the detected service set.
6. MESA runs static analysis.
7. User reviews findings, graph, health, and recommendations.
8. User optionally opens the AI explainer for a guided interpretation.

### 8.2 Private Upload or Local Scan

1. User uploads ZIP archives or points MESA to local paths in a trusted/self-hosted environment.
2. MESA detects services.
3. User confirms service selection.
4. MESA runs analysis and shows results.

### 8.3 Demo Mode

1. User clicks a built-in demo.
2. MESA loads a curated benchmark or example project.
3. User sees a complete working result without setup.
4. User can read interpretation help and documentation while exploring.

## 9. Key Product Outcomes

After this upgrade program, MESA should allow a user to:

- try the product without local setup
- scan a public repository without manually typing service directories
- understand why a finding exists without reading source code first
- ask for AI-assisted explanation of scan outputs
- compare architectural evolution across scans
- access documentation and guidance inside the product
- evaluate the research artifact more easily

## 10. Architectural Decisions

### 10.1 Detection Strategy

Decision: Keep detection deterministic and rule-based.

Reason:

- preserves reproducibility
- keeps research evaluation credible
- avoids mixing detector quality with AI behavior
- makes findings auditable

### 10.2 AI Strategy

Decision: Use AI as an explainer, summarizer, policy helper, and remediation planner on top of deterministic outputs.

AI must:

- read findings, scores, graph context, and documentation
- explain results in simple language
- prioritize risks
- compare scans
- generate roadmap-style guidance

AI must not:

- generate detector outputs independently
- claim evidence that is not present in MESA outputs
- replace deterministic evaluation metrics

### 10.3 Repository Analysis Safety

Decision: Public repository analysis must remain static and read-only.

The system must never:

- execute arbitrary repository code
- install repository dependencies as part of public repo analysis
- run repository services

### 10.4 Documentation Strategy

Decision: Existing markdown documentation remains the source of truth, but the frontend must expose a dedicated documentation UI.

### 10.5 Hosting Strategy

Decision: Split public demo hosting from the full analysis backend when necessary.

This means:

- docs and demo frontend can be statically hosted
- full dynamic repo scanning can remain self-hosted or separately hosted
- public-facing demo quality should not depend on full infrastructure availability

## 11. High-Level System Evolution

Target logical architecture:

```text
Frontend
  Marketing / landing page
  New scan workflow
  Service review step
  Results and explanation views
  Scan comparison
  Documentation portal
  AI explainer UI

Backend API
  Project and scan APIs
  Repository ingestion APIs
  Service discovery APIs
  Analysis APIs
  Documentation metadata APIs
  AI explainer orchestration APIs

Ingestion Layer
  Public repo fetcher
  Archive fetcher
  Workspace manager
  Repo metadata normalizer
  Safety guardrails

Discovery Layer
  Service candidate detector
  Confidence scoring
  Explainable service classification

Analysis Core
  Extractors
  Graph builder
  Detectors
  Health scoring
  Recommendations
  Governance
  Evolution

Persistence
  Scan metadata
  Repo metadata
  Findings
  Scores
  Snapshots
  Docs metadata
  Architecture graph

AI Layer
  Tool adapters over MESA data
  Structured explainer outputs
  Docs question answering
  Remediation roadmap generation
```

## 12. Required New Capability Areas

The following capability groups must be implemented to achieve the target product:

1. Dynamic repository ingestion
2. Automatic service discovery
3. Guided scan workflow
4. Plain-language interpretation layer
5. In-app documentation portal
6. AI explainer
7. Multi-finding remediation roadmap
8. Expanded real-world evaluation
9. Public demo deployment path

## 13. Phased Build Plan

This section is the primary build order. Each phase contains goals, implementation scope, outputs, and acceptance criteria.

### Phase A. Product Foundation and Scope Lock

Goal: establish the future product model and lock core decisions before implementation expands.

Work:

- define supported user types
- define the three entry modes: public repo, private upload, demo
- define product positioning language
- define non-goals for the first upgraded release
- define terminology for findings, confidence, evidence, and limitations
- define separation between deterministic analysis and AI explanation

Deliverables:

- product vision document
- UX flow map
- feature scope list
- release milestone map

Acceptance criteria:

- there is one approved product language set used across README, docs, and UI
- future phases no longer need to debate whether AI replaces detection

### Phase B. Dynamic Repository Ingestion

Goal: make MESA capable of analyzing public external repositories without manual local path preparation.

Backend work:

- add `src/mesa/ingestion/`
- implement public repository fetcher for GitHub first
- support archive-based download or shallow clone workflow
- normalize repository metadata
- persist repository URL, branch, tag, commit SHA, and fetch timestamp
- create a temporary workspace lifecycle manager
- enforce limits:
  - maximum repository size
  - maximum file count
  - maximum analysis duration
  - host allowlist
- clean up temporary workspaces after scans when appropriate

API work:

- `POST /repo-scans/preview`
- `POST /repo-scans/run`
- `GET /repo-scans/{scan_id}`
- optional `POST /repo-scans/validate`

Data model additions:

- repository source type
- repository URL
- branch
- tag
- commit SHA
- scan origin
- fetch status
- fetch diagnostics

Acceptance criteria:

- user can paste a public repository URL and preview a scan
- system stores enough metadata to make results reproducible
- system never executes repository code

### Phase C. Automatic Service Discovery

Goal: replace manual service path entry with explainable, reviewable service discovery.

Backend work:

- add `src/mesa/discovery/`
- detect service candidates using signals such as:
  - `Dockerfile`
  - `docker-compose.yml`
  - `pyproject.toml`
  - `requirements.txt`
  - `package.json`
  - `pom.xml`
  - framework entrypoints
  - deployment manifests
  - common service naming patterns
- compute a confidence score and supporting reasons per candidate
- allow detection of service language and probable framework
- support nested monorepos and multiple top-level applications

UI work:

- add a service review page
- show candidate service name, path, language, confidence, and detection reasons
- allow include/exclude toggles
- allow renaming labels without modifying source directories

Acceptance criteria:

- user can analyze an unfamiliar repo without manually discovering every service directory
- discovery results are explainable and editable

### Phase D. Guided Scan Workflow

Goal: redesign the user experience into a clear sequence instead of a dashboard-first flow.

Required frontend pages:

- landing page
- new scan page
- repo preview page
- service review page
- run analysis state page
- results overview page
- findings detail page
- compare scans page
- docs page

Flow:

1. choose input mode
2. provide repository or upload
3. preview repository
4. review detected services
5. run scan
6. inspect results
7. optionally compare scans
8. optionally ask AI for explanation

Acceptance criteria:

- a first-time user can complete a scan without reading codebase internals
- the UI no longer requires Docker-mounted path knowledge for the public-repo scenario

### Phase E. Interpretation and Explainability Layer

Goal: make results understandable by beginners and evaluators.

Required finding presentation structure:

- what MESA found
- why MESA thinks so
- evidence
- confidence
- severity
- affected services
- affected files
- what to do first
- expected architectural impact
- what this does not prove

Required scan summary cards:

- total findings
- highest-risk service
- strongest coupling hotspot
- most urgent issue
- system health score
- key trend against previous scan when available

Required product modes:

- beginner mode
- research mode

Beginner mode should:

- use simple language
- reduce raw metric density
- emphasize recommended next steps

Research mode should:

- expose raw detector evidence
- expose thresholds
- expose methodology-linked details

Acceptance criteria:

- a non-expert user can explain a finding after reading the UI alone
- the product clearly communicates where static inference ends and uncertainty begins

### Phase F. Documentation Portal

Goal: create a separate documentation experience inside the product.

Decision:

- keep markdown docs as source-of-truth
- render them in a dedicated docs UI

Required docs categories:

- getting started
- how MESA works
- supported inputs
- public repo scan guide
- local scan guide
- how to read findings
- health score guide
- governance guide
- AI explainer guide
- evaluation and limitations
- API reference
- research docs
- demo guide

Required documentation UX features:

- left navigation
- search/filter
- next/previous links
- links from results pages into relevant docs
- evaluator quick-start page

Acceptance criteria:

- a user can learn the tool from inside the product
- an evaluator can find method, limitations, and demo guidance without searching the repo manually

### Phase G. AI Explainer

Goal: add a domain-specific AI assistant for interpretation without replacing deterministic analysis.

Core decision:

- do not train a separate detector model first
- create a MESA-specific assistant using MESA tools, documentation, schema, and evidence

Capabilities:

- explain a finding in plain English
- summarize a scan
- answer “what should I fix first?”
- compare two scans
- explain a health score
- help write or refine governance policies
- summarize documentation pages for the user

AI architecture requirements:

- model interacts with structured MESA tools
- all outputs must reference available evidence
- all outputs must use a stable response schema
- documentation Q&A should retrieve from MESA docs, not rely on model memory alone
- long-running roadmap generation should be asynchronous when needed

Suggested internal tool surface:

- `get_scan_summary`
- `get_findings`
- `get_finding_detail`
- `get_service_profile`
- `get_graph_context`
- `get_score_breakdown`
- `get_policy_set`
- `compare_scans`
- `search_docs`
- `get_doc_page`

Required safeguards:

- AI cannot report unsupported detector facts
- AI must distinguish evidence from inference
- AI must expose confidence and limitations in human-readable form
- AI must fall back gracefully when insufficient context exists

Acceptance criteria:

- the AI explainer makes scan outputs easier to interpret
- AI answers remain grounded in deterministic scan data and documentation

### Phase H. Multi-Finding Remediation Roadmap

Goal: combine isolated findings into a prioritized architectural improvement plan.

Required outputs:

- quick wins
- medium-term structural changes
- high-effort architectural refactors
- expected benefit by action
- dependencies between actions
- suggested order of execution

Possible rule-based inputs:

- severity
- confidence
- affected service centrality
- number of linked findings
- system health impact
- governance violations

Acceptance criteria:

- users receive one coherent roadmap, not only individual recommendations
- roadmap order is explainable and evidence-based

### Phase I. Evaluation Expansion

Goal: improve research quality beyond seeded synthetic fixtures.

Work:

- expand benchmark coverage to public real-world repositories
- create a manually reviewed evaluation set
- evaluate service discovery quality separately from detector quality
- evaluate AI explanation quality separately from detector quality
- document false positives and false negatives
- record evaluator notes and limitations

Evaluation dimensions:

- detector precision, recall, F1
- service discovery precision and recall
- usability observations
- explanation helpfulness
- recommendation usefulness

Acceptance criteria:

- research claims are stronger and more realistic
- evaluation clearly separates deterministic analysis from AI explanation

### Phase J. Public Demo and Deployment

Goal: make MESA easy to access for demonstration and evaluation.

Recommended deployment split:

- public static site for landing page, documentation, and demo UI
- full backend deployed separately when needed
- self-hosted mode remains supported for local/private evaluation

Required public features:

- demo scans that always work
- embedded documentation
- architecture screenshots or example results
- evaluator walkthrough

Acceptance criteria:

- anyone can try MESA without setting up the full research stack first
- the public experience remains useful even if advanced backend features are limited

## 14. Suggested Repository Changes

This section describes likely codebase organization changes.

### 14.1 New Backend Modules

Add:

- `src/mesa/ingestion/`
- `src/mesa/discovery/`
- `src/mesa/ai/`
- `src/mesa/docs/` if metadata helpers are needed

Possible files under ingestion:

- `repo_fetcher.py`
- `archive_fetcher.py`
- `workspace_manager.py`
- `metadata.py`
- `limits.py`

Possible files under discovery:

- `service_candidates.py`
- `signals.py`
- `confidence.py`
- `preview.py`

Possible files under AI:

- `explainer.py`
- `tools.py`
- `schemas.py`
- `roadmap.py`
- `docs_qa.py`

### 14.2 Frontend Restructure

Current frontend is concentrated in a single main file. The upgraded UI should be decomposed into route-oriented modules.

Suggested route groups:

- `frontend/src/routes/home`
- `frontend/src/routes/new-scan`
- `frontend/src/routes/repo-preview`
- `frontend/src/routes/review-services`
- `frontend/src/routes/results`
- `frontend/src/routes/compare`
- `frontend/src/routes/docs`
- `frontend/src/routes/demo`

Suggested shared components:

- layout shell
- progress stepper
- findings cards
- evidence panel
- graph panel
- summary cards
- AI chat panel
- docs renderer

### 14.3 Persistence Changes

Add persistence support for:

- repository metadata
- discovered services preview
- scan source type
- user-confirmed service selection
- AI explanation requests if saved
- docs index metadata if needed

## 15. Data Model Additions

The upgraded system will likely need new entities or fields.

Recommended additions:

- repository source record
- service candidate record
- discovery reason record
- analysis origin enum
- user-selected services list
- explanation request record
- roadmap result record
- docs page metadata

Important metadata fields:

- `source_type`
- `repo_url`
- `repo_provider`
- `branch`
- `tag`
- `commit_sha`
- `subdirectory`
- `fetch_status`
- `fetch_error`
- `discovery_confidence`
- `discovery_reasons`
- `selection_confirmed`

## 16. UX Requirements

The product should feel approachable, not academic-only.

Required UX properties:

- clear onboarding
- minimal first-run friction
- obvious next actions
- transparency about uncertainty
- built-in examples
- built-in help
- easy terminology

Required message style:

- plain language first
- technical detail available on demand
- never show internal-only terminology without explanation
- always connect a metric to user impact

Examples:

- instead of only `CHATTY_SERVICE`, show `This service may rely too heavily on repeated calls to another service`
- instead of only `HIGH severity`, show `High risk because deployment independence may be reduced`

## 17. Documentation Requirements

The documentation portal must support both learning and evaluation.

Minimum pages:

- overview
- installation
- public repo scan walkthrough
- private scan walkthrough
- findings interpretation guide
- graph interpretation guide
- health score interpretation guide
- governance policy guide
- AI explainer guide
- methodology
- evaluation results
- threats to validity
- API reference
- demo guide

Each major page should answer:

- what this feature is
- why it exists
- how to use it
- what the user should expect
- what the limitations are

## 18. AI Assistant Decision

This section records the recommended AI strategy for future implementation.

### 18.1 Recommended Approach

Build a MESA-specific AI assistant that is specialized by:

- access to MESA scan outputs
- access to MESA documentation
- access to MESA graph and score context
- access to structured tools
- enforced response schemas

### 18.2 Not Recommended as the First Step

Do not start by training a separate custom detector model for this tool.

Reasons:

- detector behavior should stay deterministic and research-measurable
- training adds cost and complexity before the core product flow is mature
- AI is more valuable first as an explainer than as a detector replacement
- explanation quality can be improved through prompting, tool use, retrieval, and schemas before model training is justified

### 18.3 Future Optional AI Enhancements

Only after the platform is stable, consider:

- style fine-tuning for more consistent explanations
- limited domain adaptation for terminology consistency
- policy authoring assistance tuned on MESA policy examples

These are future enhancements, not prerequisites for the main roadmap.

## 19. Research Integrity Requirements

The upgraded tool must preserve research honesty.

Required rules:

- detector accuracy claims must refer to detector evaluation only
- AI explanation quality must be evaluated separately
- seeded benchmark results must not be presented as real-world generalization
- static inference must be described as risk estimation where appropriate
- docs and UI must state limitations clearly

## 20. Security and Safety Requirements

These requirements are mandatory for public repo analysis.

- no arbitrary code execution
- no dependency installation from analyzed repos
- no secret retention from fetched repos beyond analysis need
- temp workspace cleanup
- repo host allowlist
- archive and file size limits
- request timeout controls
- log sanitization where necessary

## 21. Testing Strategy

Each phase should include explicit verification.

### Backend tests

- ingestion validation tests
- service discovery tests
- repo metadata persistence tests
- API tests for new scan flows
- AI tool adapter tests
- roadmap generation tests

### Frontend tests

- happy-path scan workflow
- service review interactions
- findings interpretation rendering
- docs portal navigation
- AI explainer UI state transitions

### Research validation tests

- synthetic benchmark regression tests
- real-world benchmark spot checks
- evaluator scenario scripts

## 22. Definition of Done by Capability

A capability should not be considered complete unless:

- backend behavior is implemented
- frontend behavior is implemented
- documentation exists
- tests exist
- error states are handled
- evaluator usability is considered

## 23. Delivery Dependencies

Recommended dependency order:

1. product foundation
2. repository ingestion
3. service discovery
4. guided scan workflow
5. interpretation layer
6. documentation portal
7. AI explainer
8. remediation roadmap
9. evaluation expansion
10. public deployment

Reason:

- ingestion and discovery are foundational
- workflow should be simplified before adding AI
- AI is most useful after the product has stable data and UX surfaces

## 24. Priority Classification

### Must Have

- public repo ingestion
- service discovery
- guided scan workflow
- plain-language findings
- docs portal
- clear evaluator path

### Should Have

- AI explainer
- remediation roadmap
- scan comparison improvements
- public demo mode

### Nice to Have

- advanced hosted backend
- style tuning for AI explanations
- richer collaboration features

## 25. Risks and Mitigations

### Risk: service discovery has false positives

Mitigation:

- show confidence
- show reasons
- require user review before scan

### Risk: AI overstates certainty

Mitigation:

- schema-enforced responses
- mandatory limitations field
- evidence-grounded tool access only

### Risk: public repo ingestion increases complexity

Mitigation:

- support GitHub first
- support public repos first
- use size/time guardrails

### Risk: research focus gets diluted by product work

Mitigation:

- keep detector and AI evaluation separate
- preserve methodology and validity documentation

### Risk: public hosting cannot support full stack cheaply

Mitigation:

- split static docs/demo from full analysis backend

## 26. Suggested Milestone Outputs

Milestone 1:

- dynamic repo ingestion preview
- service discovery preview
- basic new scan flow

Milestone 2:

- full guided scan workflow
- improved results interpretation
- docs portal

Milestone 3:

- AI explainer
- remediation roadmap
- richer comparison views

Milestone 4:

- expanded evaluation on public repos
- polished public demo deployment

## 27. AI-Readable Build Instructions

Future AI agents implementing this roadmap should follow these rules:

1. Do not replace deterministic detectors with LLM-based detection.
2. Treat current analysis and detector modules as the source of truth.
3. Add repository ingestion as a new layer before analysis, not as an ad hoc shortcut.
4. Add service discovery as a reviewable system with confidence and reasons.
5. Decompose the current frontend into route-based workflow pages before adding major UX complexity.
6. Preserve existing markdown documentation as source content and render it in-product.
7. Build AI features around structured tool access and schema-safe outputs.
8. Expose limitations and uncertainty clearly in both UI and AI outputs.
9. Keep evaluation artifacts reproducible and separate from subjective explanation features.
10. Favor phased delivery over large all-at-once rewrites.

## 28. Immediate Recommended Next Tasks

The next practical implementation tasks should be:

1. create a product vision and flow spec if one does not already exist
2. design repository ingestion data models and API contracts
3. design service discovery heuristics and preview responses
4. restructure the frontend into multi-page workflow routes
5. define the documentation portal rendering approach
6. define the AI explainer tool schema and response schema

## 29. Conclusion

This roadmap is intended to guide the next generation of MESA. The key strategic decision is simple:

- keep architecture detection deterministic
- make analysis dynamic through repository ingestion and service discovery
- make results easier through guided UX and plain-language interpretation
- make learning easier through an in-app documentation portal
- make understanding deeper through an evidence-grounded AI explainer

If implemented in this order, MESA can evolve from a strong research prototype into a compelling, distinctive, and much more usable architecture intelligence platform.
