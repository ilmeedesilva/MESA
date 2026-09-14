# MESA Evaluation Summary

Benchmark: `mesa-phase-7-real-repo-online-boutique`

## Detector Quality

- Precision: `1.0`
- Recall: `1.0`
- F1: `1.0`

## Service Discovery Quality

- Systems evaluated: `1`
- Precision: `1.0`
- Recall: `0.8333`
- F1: `0.9091`

## Explanation Quality

- Systems evaluated: `0`
- Helpfulness score: `None`
- Grounding score: `None`
- Coverage score: `None`

## Recommendation Quality

- Systems evaluated: `1`
- Usefulness score: `1.0`
- Structured coverage: `1.0`
- Step quality score: `1.0`

## Evaluator Notes

### online-boutique

- Note: Real inter-service traffic in this system is almost entirely gRPC calls made from Go services (frontend, checkoutservice, productcatalogservice, shippingservice) and a C# service (cartservice) to each other and to the Python/Node services. MESA's static extractor only parses Python, JavaScript/TypeScript, and Java source for call/endpoint evidence, so these real calls are invisible to it.
- Note: The 2 HARD_CODED_SERVICE_DEPENDENCY findings (emailservice, recommendationservice) both flag the same literal address: localhost:4317, the OpenTelemetry Collector's gRPC endpoint. This is a standard local observability sidecar address, not a cross-service architectural coupling risk in the sense the finding's remediation guidance implies. Still labeled a true positive (the address is genuinely hard-coded), but as of `docs/architecture/PHASE_18_INFRA_ADDRESS_DOWNGRADE.md`, MESA itself now recognizes localhost:4317 as a well-known OpenTelemetry Collector port and downgrades both findings to LOW severity with a `likely_infrastructure_address` evidence flag and an explanatory limitation, instead of requiring a human evaluator to notice and write down this nuance by hand every time.
- Note: adservice is a Java/Gradle service; MESA's service-discovery language voting reported it as language=unknown because it only recognizes pom.xml as a Java manifest signal, not build.gradle. The separate extraction-time language detector (used during analysis, not discovery) does correctly resolve it to Java via a *.java file scan. This is a minor internal inconsistency between the two language-detection code paths, not a functional defect in this evaluation.
- Limitation: Service discovery missed 2 of 12 real services entirely: frontend (Go) and cartservice (C#). Neither has a manifest filename MESA's discovery heuristic recognizes (go.mod, .csproj/.sln are not in its manifest list), and a bare Dockerfile alone does not clear the 0.24 minimum-confidence cutoff, so both were dropped rather than merely deprioritized. This is a real false-negative pattern for unsupported-language services that only have a Dockerfile as a signal.
- Limitation: Zero CHATTY_SERVICE, CYCLIC_DEPENDENCY, SHARED_DATABASE, and GOD_SERVICE findings on this system should not be read as 'MESA confirmed this architecture is clean.' It reflects what fraction of the system's real logic MESA can parse (Python/JS/TS/Java), not an assessment of the full polyglot system, most of which (6 of 12 services) is Go or C#.
- Limitation: This is Google's own reference 'well-architected' demo application, so even within the parseable subset, a near-zero true anti-pattern count is expected and does not by itself demonstrate detector precision or recall under realistic anti-pattern conditions.
