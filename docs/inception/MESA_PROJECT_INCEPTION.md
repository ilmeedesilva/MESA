# MESA Project Inception

Project: MESA: A Cross-Service Static Analysis Tool for Detecting Microservices Architectural Anti-Patterns

Status: Inception artifact updated with proposal baseline and approved core technology stack.

## 1. Requirement Analysis

### Current Document and Proposal Baseline

The repository currently contains three guides:

- `AI_DEVELOPER_GUIDE.md`: describes MESA as a Python CLI static analysis prototype.
- `USER_GUIDE.md`: describes command-line usage, three anti-patterns, and evaluation output.
- `PRESENTATION_GUIDE.md`: frames the original research around cross-service static analysis, SonarQube comparison, and F1-based evaluation.

The proposal defines MESA as a static analysis research prototype for automatically detecting architectural anti-patterns that arise only when multiple microservices are considered together. Its original objectives are:

- Consume several microservice source code repositories.
- Generate a unified service dependency graph from APIs, service calls, endpoints, and shared database configuration.
- Detect Chatty Services, Cyclic Dependencies, and Shared Database Coupling.
- Build a Python command-line prototype that outputs actionable textual or structured reports.
- Evaluate detection effectiveness using precision, recall, and F1-score on benchmark or synthetic microservice projects.

The proposal research questions are:

- RQ1: What design factors are required for a static analysis framework that assesses multiple repositories simultaneously?
- RQ2: What graph algorithms and pattern rules can detect Chatty Services, Cyclic Dependencies, and Shared Database anti-patterns reliably?
- RQ3: Can the static analysis framework be developed as a command-line tool that accepts one or more repositories and produces a valid actionable report?
- RQ4: How accurately can the tool discover and characterize known microservice anti-patterns using precision, recall, and F1-score?

The updated project direction keeps the proposal's research core but expands the product architecture and novelty:

- FastAPI backend in Python.
- Tree-sitter for multi-language AST parsing.
- Python AST and LibCST for Python-specific analysis.
- JavaParser only when analyzing Java projects.
- Neo4j and NetworkX graph engines.
- PostgreSQL persistence.
- React + TypeScript frontend.
- Cytoscape.js visualization.
- LangGraph and LangChain based AI recommendation layer with OpenAI, Claude, or local LLM providers.
- Docker deployment and GitHub Actions CI.
- Architectural risk prediction, health scoring, evolution tracking, refactoring advisor, digital twin, and governance engine.

### Inception Decision

MESA should be repositioned as a Python-based graph architectural intelligence platform. The original command-line prototype remains aligned with the proposal and should be preserved as a supported interface or first-class workflow. The expanded implementation should use FastAPI, React + TypeScript, Neo4j, NetworkX, PostgreSQL, Tree-sitter, Python AST, LibCST, and optional JavaParser so the research remains faithful to the proposal while supporting the required novelty claims.

### Key Stakeholders

- Student researcher: must defend novelty, method, implementation, and evaluation.
- Academic supervisors and examiners: require clear research contribution and threats to validity.
- Developer users: need actionable architecture findings and evidence.
- Organizations adopting microservices: need governance, early detection, and evolution visibility.

### Problem Statement

Microservice systems often pass single-service quality checks while still containing cross-service architectural risks such as excessive coupling, cyclic dependencies, shared data ownership, and deployment fragility. Existing tools either analyze individual services, require runtime telemetry, or provide generic AI review without a persistent architectural model. MESA addresses this gap by building a static, graph-based architectural digital twin and using it to detect, predict, explain, and govern cross-service architectural anti-patterns before execution.

### Scope Boundaries

In scope:

- Multi-language static analysis with Python and Java as priority targets.
- Command-line analysis workflow aligned with the proposal.
- FastAPI service layer for project, scan, graph, finding, recommendation, and report APIs.
- Static extraction of services, APIs, calls, database access, configuration, events, and dependency metadata.
- Graph-based analysis in Neo4j and NetworkX.
- Ten defined anti-pattern detectors.
- Recommendations and impact analysis.
- Architecture snapshots and evolution comparisons.
- Architecture governance policies.
- Evaluation using synthetic systems, curated open-source systems, and seeded mutations.

Out of scope for the first approved implementation:

- Runtime tracing, load testing, or production telemetry ingestion.
- Fully automated refactoring execution.
- Guaranteed semantic understanding of dynamically generated endpoints.
- Complete support for all languages and frameworks.
- Replacing SonarQube, ArchUnit, CodeScene, or AI coding agents.

## 2. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Register a project containing multiple microservice repositories or service directories. | Must |
| FR-02 | Parse multiple languages using Tree-sitter where grammars are available. | Must |
| FR-03 | Parse Python projects using Python AST and LibCST for syntax-aware and codemod-safe extraction. | Must |
| FR-04 | Parse Java projects using JavaParser when Java services are analyzed. | Should |
| FR-05 | Extract REST APIs, HTTP clients, RPC calls where statically visible, configured base URLs, and service-discovery references. | Must |
| FR-06 | Extract database connections, repositories, entities, table names, schema names, and ownership indicators. | Must |
| FR-07 | Extract build dependencies from Python, Java, JavaScript/TypeScript, Maven, Gradle, npm, and common dependency manifests where supported. | Must |
| FR-08 | Extract configuration from `.env`, YAML/properties files, Docker Compose, Kubernetes manifests, and environment references. | Must |
| FR-09 | Extract message broker topics, producers, consumers, queues, and event ownership where statically visible. | Should |
| FR-10 | Build an architectural digital twin graph with services, APIs, calls, databases, tables, DTOs, libraries, topics, owners, and dependencies. | Must |
| FR-11 | Store persistent graph model in Neo4j, run in-memory graph algorithms in NetworkX, and store analysis metadata in PostgreSQL. | Must |
| FR-12 | Detect Chatty Services using static call-site and interaction-topology heuristics. | Must |
| FR-13 | Detect Cyclic Dependencies using directed graph cycle analysis and strongly connected components. | Must |
| FR-14 | Detect Shared Persistence using database, schema, table, repository, and connection evidence. | Must |
| FR-15 | Detect God Service using service size, endpoint count, dependency fan-in/fan-out, domain spread, and growth history. | Must |
| FR-16 | Detect Distributed Monolith using deployment coupling, dense dependency clusters, synchronous call chains, and shared release indicators. | Must |
| FR-17 | Detect Inappropriate Service Intimacy using shared DTOs, internal endpoint access, cross-service entity leakage, and excessive private-data exchange. | Must |
| FR-18 | Detect Shared Libraries Abuse using dependency overlap, internal library imports, and domain model sharing. | Must |
| FR-19 | Detect API Versioning Violations using route versioning, client usage, deprecated endpoint usage, and breaking contract changes. | Must |
| FR-20 | Detect Data Ownership Violations using entity/table ownership and cross-service persistence access. | Must |
| FR-21 | Detect Hard-Coded Service Dependencies using literal URLs, hostnames, ports, and environment bypasses. | Must |
| FR-22 | Generate service-level, domain-level, and system-level architectural health scores from 0 to 100. | Must |
| FR-23 | Predict future architectural risks using current metrics and snapshot trends. | Must |
| FR-24 | Generate recommendations with root causes, files, services, APIs, expected impact, and remediation sequence. | Must |
| FR-25 | Compare architecture snapshots and report new, resolved, worsened, and improved risks. | Must |
| FR-26 | Evaluate architecture governance policies such as no direct database sharing and no cycles. | Must |
| FR-27 | Provide FastAPI REST APIs for project management, scans, findings, scores, recommendations, snapshots, and policies. | Must |
| FR-28 | Provide React + TypeScript views for graph visualization, findings, recommendations, health score, evolution trends, and policy results. | Must |
| FR-29 | Export reports as JSON and PDF or HTML. | Should |
| FR-30 | Support plugin-style detector registration for future anti-patterns. | Must |
| FR-31 | Provide reproducible CLI evaluation commands and datasets. | Must |

## 3. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Accuracy | Each detector must expose evidence and confidence. Accuracy must be measured with precision, recall, and F1 where ground truth exists. |
| Explainability | Every finding must include graph evidence, source locations, rule rationale, and recommendation rationale. |
| Reproducibility | Scans must be deterministic for the same repository state and configuration. |
| Traceability | Findings must link to files, line numbers where possible, services, APIs, graph nodes, and snapshots. |
| Extensibility | New detectors and governance rules must be addable without modifying the core scan pipeline. |
| Performance | Initial target: analyze 10 to 30 services within undergraduate project constraints on a developer machine. |
| Usability | UI must prioritize architecture map, risks, recommendations, and evolution trends, not marketing content. |
| Security | Repository paths, secrets, and connection strings must be masked in reports unless explicitly configured otherwise. |
| Maintainability | The backend must separate analysis extraction, graph modeling, detection, scoring, recommendations, and persistence. |
| Portability | Docker Compose must run FastAPI, React, PostgreSQL, and Neo4j locally. |
| Auditability | Analysis configuration, thresholds, policy versions, and detector versions must be persisted with each snapshot. |

## 4. Research Novelty Analysis

The original novelty claim, "cross-service static analysis detects issues SonarQube cannot see", is useful but no longer strong enough. The defense feedback correctly challenges it because AI agents and existing architecture tools can increasingly inspect repositories.

The stronger novelty is:

MESA creates a persistent, queryable architectural digital twin from static source evidence, then uses it for detection, prediction, governance, evolution tracking, and recommendation generation.

Novel contributions:

1. Static architectural digital twin for microservice ecosystems.
2. Runtime-risk prediction from static signals, especially for Chatty Services and Distributed Monolith risk.
3. Architectural health score computed across service, domain, and system levels.
4. Architecture evolution tracking through versioned graph snapshots.
5. Refactoring advisor combining deterministic rule evidence with optional LLM-assisted explanation.
6. Governance engine for custom architecture policies.
7. Evidence-backed recommendations that complement AI agents rather than competing with them.

Why this remains valuable when AI agents improve:

- AI agents are often session-based; MESA provides persistent architectural memory.
- AI agents can make qualitative judgments; MESA provides repeatable scoring and evidence.
- AI agents may detect issues; MESA tracks whether they are getting better or worse over time.
- AI agents can suggest fixes; MESA estimates architectural impact and policy compliance.
- AI agents usually inspect code; MESA models the architecture as a graph that can be queried, compared, and governed.

## 5. Architecture Design

### Proposed Logical Architecture

```text
React + TypeScript Frontend
  Architecture Graph View
  Findings Dashboard
  Health Score View
  Evolution Timeline
  Recommendation Workspace
  Governance Policy View

FastAPI Backend
  Project Management API
  Scan Orchestration API
  Findings API
  Recommendation API
  Evolution API
  Governance API
  CLI Adapter / Command Runner

Analysis Core
  Repository Loader
  Static Extractors
    Tree-sitter Extractors
    Python AST Extractors
    LibCST Extractors
    JavaParser Extractors for Java Projects
    Config Extractors
    Build Extractors
    API Contract Extractors
  Graph Builder
  Detector Registry
  Risk Prediction Engine
  Health Score Engine
  Recommendation Engine
  Governance Engine
  Snapshot Comparator

Persistence
  PostgreSQL: projects, scans, findings, metrics, reports, policies
  Neo4j: architectural digital twin graph and snapshot graph model
  NetworkX: in-memory graph algorithms and detector computations
```

### Primary Components

- Repository Loader: accepts local paths first, with Git integration later.
- Static Extraction Engine: produces normalized architectural facts using Tree-sitter, Python AST, LibCST, and JavaParser where appropriate.
- Digital Twin Graph Builder: converts facts into Neo4j nodes and relationships and prepares NetworkX projections for algorithms.
- Detector Registry: runs anti-pattern detectors over the graph.
- Risk Prediction Engine: computes likelihood scores using metrics and trends.
- Health Score Engine: calculates weighted architecture scores.
- Recommendation Engine: creates deterministic remediation plans, optionally orchestrated with LangGraph and LangChain and enhanced by OpenAI, Claude, or local LLMs.
- Evolution Engine: compares graph snapshots.
- Governance Engine: evaluates custom policy rules.
- Frontend Visualization: displays graph, risks, and trends.

### Core Graph Model

Node types:

- `Project`
- `Snapshot`
- `Service`
- `Endpoint`
- `ApiContract`
- `Database`
- `Table`
- `Entity`
- `Dto`
- `Library`
- `Topic`
- `Queue`
- `Team`
- `Finding`
- `Policy`

Relationship types:

- `CONTAINS_SERVICE`
- `EXPOSES_ENDPOINT`
- `CALLS`
- `DEPENDS_ON`
- `USES_DATABASE`
- `READS_TABLE`
- `WRITES_TABLE`
- `OWNS_DATA`
- `SHARES_DTO`
- `PUBLISHES`
- `CONSUMES`
- `USES_LIBRARY`
- `OWNED_BY`
- `VIOLATES_POLICY`
- `HAS_FINDING`
- `EVOLVED_FROM`

## 6. Technology Justification

| Technology | Justification |
|---|---|
| Python | Aligns with the proposal's prototype direction and provides strong static analysis, graph, AI, and API ecosystem support. |
| FastAPI | Provides a lightweight, typed backend API layer while keeping the analysis engine and CLI in Python. |
| Tree-sitter | Provides robust multi-language parsing and incremental AST extraction for heterogeneous microservice repositories. |
| Python AST | Provides reliable built-in parsing for Python source structure, imports, function calls, and decorators. |
| LibCST | Preserves Python concrete syntax and metadata, supporting precise source locations and future codemod-safe refactoring recommendations. |
| JavaParser | Used only when analyzing Java projects, giving better Java semantic extraction than generic parsers for annotations, classes, and calls. |
| Neo4j | Natural fit for persistent architecture graphs, dependency paths, cycles, centrality, communities, and evolution comparison. |
| NetworkX | Supports fast in-memory graph algorithms, detector prototyping, cycle detection, centrality, clustering, and evaluation experiments. |
| PostgreSQL | Reliable relational store for projects, scans, users if needed, findings, scores, policies, and reports. |
| React + TypeScript | Suitable for interactive dashboards with stronger frontend type safety and maintainability. |
| Cytoscape.js | Strong fit for interactive service dependency graphs and architecture visualization. |
| LangGraph | Supports multi-step recommendation workflows with explicit state, tool use, review, and evidence grounding. |
| LangChain | Provides model-provider abstraction for OpenAI, Claude, and local LLM integrations. |
| OpenAI / Claude / Local LLMs | Used for recommendation explanation, trade-off articulation, and report drafting while deterministic detectors remain the authority. |
| Docker | Required for reproducible local deployment of multi-service platform dependencies. |
| GitHub Actions | Provides CI for backend tests, frontend tests, and container checks. |

## 7. Detection Algorithms Design

All detectors should produce:

- Finding type.
- Severity.
- Confidence score.
- Evidence graph query.
- Source evidence.
- Root cause hypothesis.
- Consequence explanation.
- Recommendation plan.
- Impact estimate.

### Chatty Services

Static prediction is not runtime call counting. The detector should estimate chatty risk using:

- Number of distinct call sites from service A to service B.
- Number of endpoints in B used by A.
- Fan-out of a single request-handling method.
- Sequential call chains inside controller or service methods.
- Loop-contained calls.
- DTO field-level fragmentation, for example several small endpoints used to assemble one domain object.
- API contract granularity.
- Synchronous call depth.

Suggested score:

```text
chatty_risk =
  0.25 * normalized(call_site_count)
+ 0.20 * normalized(distinct_endpoint_count)
+ 0.20 * synchronous_chain_score
+ 0.15 * loop_call_score
+ 0.10 * dto_fragmentation_score
+ 0.10 * bidirectional_call_score
```

### Cyclic Dependencies

Use directed graph analysis:

- Build `Service CALLS Service` graph.
- Detect strongly connected components.
- Detect simple cycles.
- Weight cycles by synchronous calls, build dependencies, shared DTOs, and database relationships.
- Prioritize two-service cycles as highest severity.

### Shared Persistence

Detect:

- Multiple services connecting to same database.
- Multiple services accessing same table or schema.
- One service importing another service's entity or repository package.
- Shared migrations across service directories.
- Cross-service SQL references.

### God Service

Use:

- Endpoint count.
- Class count and package/domain spread.
- Fan-in and fan-out centrality.
- Number of databases or tables touched.
- Number of DTOs owned or shared.
- Growth trend across snapshots.

### Distributed Monolith

Use:

- High graph density.
- Large strongly connected component.
- Many synchronous call chains.
- Shared persistence.
- Shared internal libraries.
- Shared deployment or version lock-step indicators.
- Low independent deployability score.

### Inappropriate Service Intimacy

Use:

- Shared internal DTO/entity packages.
- Direct use of another service's domain model.
- Calls to internal/private endpoints.
- Cross-service field-level data access.
- Excessive bidirectional call detail.

### Shared Libraries Abuse

Use:

- Internal libraries imported by many services.
- Libraries containing entities, repositories, DTOs, or business logic.
- Services coupled through same domain package.
- Frequent version coupling across services.

### API Versioning Violations

Use:

- Missing version prefix or header strategy.
- Clients calling deprecated endpoints.
- Multiple incompatible versions with no compatibility layer.
- Breaking API signature changes between snapshots.

### Data Ownership Violations

Use:

- Service writes to table owned by another service.
- Entity ownership mismatch.
- Repository package references outside service boundary.
- Database connection points to another service's schema.

### Hard-Coded Service Dependencies

Use:

- Literal hostnames, ports, IP addresses, and URLs.
- Environment bypass, for example direct string URL instead of config key.
- Docker Compose service names embedded in code.
- No service discovery or configurable base URL.

## 8. Recommendation Engine Design

The recommendation engine should be hybrid:

1. Deterministic recommendation templates based on detector evidence.
2. Graph impact analysis to rank remediation options.
3. Optional LLM-assisted explanation that cannot override evidence.

Recommendation output should include:

- Summary.
- Why it exists.
- Root causes.
- Evidence.
- Affected services.
- Affected files.
- Affected APIs, databases, DTOs, or libraries.
- Consequences for maintainability, scalability, coupling, and deployment.
- Step-by-step remediation plan.
- Priority.
- Estimated risk reduction percentage.
- Confidence and assumptions.

Example remediation strategies:

- Replace synchronous call chain with event publication.
- Introduce aggregate endpoint.
- Split God Service by domain responsibility.
- Merge services only when separation is artificial and coupling is unavoidable.
- Move shared DTOs to service-owned contracts.
- Replace direct database access with service API or event-driven read model.
- Introduce API versioning policy.
- Move hard-coded URLs into configuration or discovery.

## 9. Evaluation Strategy

### Evaluation Questions

- EQ1: How accurately does MESA detect known cross-service anti-patterns?
- EQ2: Can static evidence predict runtime-likely Chatty Services and Distributed Monolith risks?
- EQ3: Does the architectural health score correlate with manually judged architecture quality?
- EQ4: Does evolution tracking detect architectural deterioration between versions?
- EQ5: Are recommendations useful and actionable according to expert or developer review?

### Datasets

- Synthetic microservice projects with seeded anti-patterns.
- Small curated Python, Java, and JavaScript/TypeScript microservice systems.
- Versioned snapshots of the same synthetic system.
- If feasible, public systems such as PiggyMetrics, Sock Shop, Online Boutique, or other projects that can be statically analyzed with supported parsers.

The proposal allows public GitHub projects and synthetic examples. The benchmark list must be revalidated against language support, availability of ground truth, and feasibility of static extraction.

### Metrics

Detection:

- Precision.
- Recall.
- F1-score.
- False positive categories.
- False negative categories.

Prediction:

- Risk score calibration.
- Top-k risk usefulness.
- Trend correctness on seeded evolution scenarios.

Recommendation:

- Expert rating from 1 to 5 for relevance, specificity, correctness, and actionability.
- Coverage: percentage of findings with concrete file/service/API-level remediation.

Evolution:

- Correct detection of new, resolved, worsened, and improved findings.
- Health score delta compared with seeded architectural changes.

Performance:

- Scan time.
- Graph build time.
- Detector runtime.
- Memory use on benchmark projects.

### Threats to Validity

- Ground truth subjectivity.
- Benchmark selection bias.
- Synthetic anti-patterns may be cleaner than real-world cases.
- Language and framework coverage limits generalizability.
- Static analysis cannot prove runtime frequency.
- LLM-assisted recommendation quality can vary.
- Researcher-created labels may introduce evaluator bias.

## 10. Risk Analysis

| Risk | Impact | Mitigation |
|---|---|---|
| Scope too large for undergraduate timeline | High | Deliver a research-grade vertical slice first: Python/FastAPI platform, graph model, 4 to 5 strongest detectors, health score, recommendations, evolution. |
| Existing documents conflict with the updated stack | High | Treat old docs as proposal-era baseline and update or replace them with the FastAPI/Tree-sitter architecture. |
| Proposal source was initially unavailable as extractable PDF | Low | User provided proposal text; maintain this inception artifact as the authoritative proposal baseline unless a newer text export is supplied. |
| Static analysis cannot observe real runtime frequency | High | Frame Chatty Services as static risk prediction, not measured runtime fact. |
| Neo4j and PostgreSQL add operational complexity | Medium | Provide Docker Compose and simple seed workflow. |
| LLM recommendations may hallucinate | High | Use LangGraph/LangChain workflows that ground prompts in detector evidence and label generated text as explanatory only. |
| Ground truth may be disputed | Medium | Use independent review where possible and record labeling rules. |
| Ten detectors may dilute implementation quality | High | Prioritize detectors that share graph evidence and provide plugin architecture for the rest. |
| UI may consume excessive time | Medium | Build focused architecture dashboard, not a broad application shell. |

## Clarification Questions

Implementation should not begin until these are answered or accepted as assumptions.

1. Should the first implementation prioritize Python microservices, Java microservices, or equal support for both?
2. Which languages must be supported by Tree-sitter in the first evaluated version?
3. Should JavaParser be invoked from Python as a subprocess/service, or should Java analysis be isolated as an optional analyzer component?
4. Which deliverable is expected by the university: a working research prototype, a full product-style platform, or a scoped vertical slice with strong evaluation?
5. What is the final submission deadline and expected viva/demo date?
6. Do you have a target sample microservice system for evaluation, or should we create synthetic systems and use curated open-source projects?
7. Should the LLM-assisted layer call external APIs, support local models only, or provide both options behind configuration?
8. Are user accounts/authentication required, or can the platform be single-user local research software?
9. Should the governance policy language be simple YAML/JSON rules first, or a richer DSL later?
10. Which detectors are mandatory for the first evaluated prototype if time forces prioritization beyond the proposal's three original patterns?

## Approval Gate

Recommended approval decision:

Proceed after confirming the language priority and prototype depth. The safest research path is a vertical slice:

- Python FastAPI backend and CLI workflow.
- Tree-sitter multi-language extraction foundation.
- Python AST and LibCST for Python analysis.
- Optional JavaParser path for Java analysis.
- Neo4j digital twin.
- NetworkX detector projections.
- PostgreSQL scan metadata.
- React + TypeScript/Cytoscape visualization.
- Detectors for Chatty Services, Cyclic Dependencies, Shared Persistence, God Service, Distributed Monolith, Hard-Coded Service Dependencies.
- Health score.
- Evolution snapshots.
- LangGraph/LangChain-assisted recommendations grounded in deterministic evidence.
- Governance policies.

The remaining detectors can be implemented through the plugin interface as time permits.
