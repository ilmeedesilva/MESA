# Concepts

**Anti-pattern.** A design choice that looks reasonable locally but causes problems across a
system. MESA looks for five that only appear between services: Chatty Service, Cyclic
Dependency, Shared Database, Hard-Coded Service Dependency and God Service. See
[Detectors](detectors.md).

**Static analysis.** Reading code and configuration without running them. MESA finds what is
written in the files, which means it works before anything is deployed, but it cannot see values
that only exist at runtime.

**Service discovery.** Deciding which folders are services. MESA scores folders by evidence such
as build files, entry points and Dockerfiles, and asks you to confirm the list.

**Architecture graph.** Services and databases as nodes, calls and database use as edges. Every
detector works on this graph. It is stored in Neo4j per scan so it can be queried later.

**Finding.** One detected problem: its type, the services involved, severity, confidence, the
evidence (file and line), and a recommendation.

**Severity.** How serious the risk could be: Low, Medium, High or Critical.

**Confidence.** How strongly the evidence supports the finding, from 0 to 1. A finding can be
severe but low-confidence, or minor but certain.

**Evidence chain.** The steps a detector took to reach a finding, so you can check its reasoning.

**Health score.** A 0-100 summary of a service, domain or whole system, combining nine weighted
dimensions such as coupling and cycles. It is a transparent heuristic, not a measured quality
metric. Grades: Excellent (85+), Good (70+), Moderate (50+), Poor (30+), Critical (below 30).
See [Health score](guides/health-score.md).

**Governance policy.** A rule your team sets, such as "no cycles" or "no more than 5 outgoing
dependencies per service". A broken rule becomes a finding. See [Governance](guides/governance.md).

**Fitness gate.** A pass/fail check for CI that combines a minimum health score with rules about
critical findings, cycles, policy violations and high-risk coupling. See
[GitHub Action](guides/github-action.md).

**Remediation roadmap.** Recommendations grouped into an ordered plan: quick wins, medium-term
changes and larger refactors. See [Remediation roadmap](guides/remediation-roadmap.md).

**Ground truth.** The findings a benchmark system is known to contain, written down before MESA is
run. Used to measure precision (how many reported findings are real) and recall (how many real
findings were reported). See [Evaluation](research/evaluation.md).
