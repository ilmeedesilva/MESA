# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Committed research results moved from `evaluation-results/` to
  `benchmarks/results/v0.1.0-research/`, unchanged. The AI-baseline runs are now named by model
  (`ai-baseline/claude-sonnet-5`, `ai-baseline/claude-opus-5`). See
  [benchmarks/results/README.md](benchmarks/results/README.md) for the old-to-new path map.
- `mesa evaluate` and `mesa evaluate-ai-baseline` now write to the gitignored
  `benchmarks/results/latest/` by default, so a new run can never overwrite the research results.
- `GET /ai-baseline-comparisons` lists runs in folder-name order (Opus 5, then Sonnet 5). The web
  UI orders models itself, so it is unaffected.
- Documentation reorganised: [How MESA works](docs/architecture.md), [Detectors](docs/detectors.md),
  [User guide](docs/user-guide.md), [Concepts](docs/concepts.md), guides renamed to kebab-case
  under `docs/guides/`, and research docs under `docs/research/`. The developer guide is now
  [CONTRIBUTING.md](CONTRIBUTING.md).
- `frontend/src/generated-docs.ts` is no longer committed; it is generated from `docs/` before
  every frontend build.

### Removed

- Internal planning documents, the per-phase build log (summarised in 0.1.0 below), and project
  presentation material.

## [0.1.0-research] - 2026-11-08

The version used for the published research results (tag `v0.1.0-research`). Built in twenty
increments:

- **Core pipeline:** read-only ingestion of local paths, archives and public GitHub URLs;
  weighted service discovery; static fact extraction for Python (AST), Java, JavaScript and
  TypeScript; a NetworkX service graph; Chatty Service, Cyclic Dependency and Shared Database
  detectors.
- **Persistence:** PostgreSQL storage for projects, scans and findings; a Neo4j architecture
  graph per scan with path, cycle, centrality, shared-database and high-risk-cluster queries.
- **More detectors:** Hard-Coded Service Dependency and a weighted God Service score.
- **Assessment:** service, domain and system health scores; structured recommendations for every
  finding; a remediation roadmap; YAML/JSON governance policies; a five-rule fitness gate
  (`mesa gate`) for CI.
- **Web UI:** guided scan workflow, findings dashboard with evidence, interactive architecture
  graph, scan history, evolution between scans, roadmap, fitness gate, benchmarks pages, and an
  embedded demo mode that works without a backend.
- **History:** snapshots and scan-to-scan evolution (new and removed dependencies, cycles,
  findings and score changes).
- **Evaluation:** `mesa evaluate` scores detectors against ground truth (precision, recall, F1)
  separately from discovery, explanation and recommendation quality; eight seeded benchmark
  systems, including a multi-pattern recall stress test.
- **Security and scale:** archive size and file-count caps, rejection of symlink and device
  members, path-traversal checks, TTL clean-up of workspaces; background scan jobs for
  repository scans.
- **Real repositories:** evaluation on Online Boutique, a Spring Boot sample and Sock Shop (30/30
  labelled hard-coded dependencies, no false positives), with fixes found along the way:
  Spring Cloud Config files no longer misattributed as the config service's own calls; known
  infrastructure ports downgraded to Low severity; comments, contract-test mocks and
  self-references ignored by the hard-coded-dependency detector; language detection by majority
  vote; a `mongodb` normalisation bug; MVP Go support.
- **AI:** an evidence-grounded explainer with optional OpenAI or Anthropic modes; a repeated-run
  AI-baseline comparison with Claude Sonnet 5 and Claude Opus 5 (`mesa evaluate-ai-baseline`).
- **Reproducibility:** `scripts/fetch_benchmark_repos.py` fetches the pinned benchmark
  repositories and checks their content hashes; [docs/research/REPRODUCE.md](docs/research/REPRODUCE.md).

[Unreleased]: https://github.com/ilmeedesilva/MESA/compare/v0.1.0-research...HEAD
[0.1.0-research]: https://github.com/ilmeedesilva/MESA/releases/tag/v0.1.0-research
