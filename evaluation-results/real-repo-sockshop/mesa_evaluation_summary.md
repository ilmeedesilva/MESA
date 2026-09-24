# MESA Evaluation Summary

Benchmark: `mesa-real-repo-sockshop`

## Detector Quality

- Precision: `0.1905`
- Recall: `1.0`
- F1: `0.32`

## Service Discovery Quality

- Systems evaluated: `1`
- Precision: `0.3478`
- Recall: `1.0`
- F1: `0.5161`

## Explanation Quality

- Systems evaluated: `0`
- Helpfulness score: `None`
- Grounding score: `None`
- Coverage score: `None`

## Recommendation Quality

- Systems evaluated: `1`
- Usefulness score: `0.9952`
- Structured coverage: `1.0`
- Step quality score: `1.0`

## Evaluator Notes

### sock-shop

- Note: True positives (4, all HARD_CODED_SERVICE_DEPENDENCY): catalogue hard-codes its own database DSN default `catalogue_user:default_password@tcp(catalogue-db:3306)/socksdb` as a Go flag default (cmd/cataloguesvc/main.go:48); user hard-codes `user-db:27017` in two of its own real deployment compose files (docker-compose.yml, docker-compose-zipkin.yml); front-end hard-codes `user-db:27017` in its own test/docker-compose.yml. All four are genuine literal addresses embedded in each service's own configuration, not test/mock artifacts.
- Note: False positive - SHARED_DATABASE (carts, orders): MESA reported both services sharing `mongodb://localhost/data`. Manually verified this is wrong: each service's real Spring config points at a separate database host (`carts/src/main/resources/application.properties`: `mongodb://${db:carts-db}:27017/data`; `orders/.../application.properties`: `mongodb://${db:orders-db}:27017/data`) - genuinely separate persistence, the correct microservices pattern. MESA's extractor currently cannot parse the Spring `${var:default}` placeholder syntax in a database URI at all (confirmed: DB_PATTERN does not match `mongodb://${db:carts-db}:27017/data`), so this evidence was never the source. The real source is that both services' Dredd API-contract-test hook files (`api-spec/hooks.js`) independently contain the identical literal fallback `process.env.MONGO_ENDPOINT || 'mongodb://localhost:32769/data'` - generic local-testing boilerplate that happens to be byte-identical across services, not evidence of shared production persistence. Not fixed (would require the detector to distinguish test-harness fixture files from real service configuration, a broader change out of scope for this evaluation - see known_limitations).
- Note: False positives - HARD_CODED_SERVICE_DEPENDENCY, front-end (6 of front-end's 7 findings): 1 is `max-width:768`, a CSS media-query breakpoint inside the vendored third-party library `public/js/modernizr.js`, misparsed by the host:port heuristic as a service address - not a service reference at all. The other 5 are `http://front-end:8080/` appearing in front-end's own CasperJS end-to-end test files (test/e2e/*.js) - front-end hardcoding the URL of the running instance of itself under test, which is normal E2E test practice, not a cross-service coupling risk to a different service.
- Note: False positives - HARD_CODED_SERVICE_DEPENDENCY, orders (10 of orders's 11 findings): 4 are `http://users-orders-mock:80/...` inside `api-spec/hooks.js` - a Dredd API-contract-test mock server address, not a real dependency. The remaining 6 are `http://localhost:808x/...` inside `src/main/java/.../entities/CustomerOrder.java` lines 12-16 - confirmed these are entirely inside `//`-prefixed code comments (example curl commands documenting how to call the API by hand), not live code. MESA's hard-coded-dependency scan does not currently strip comments before matching, so developer-documentation examples get flagged identically to real embedded addresses - the most severe instance of this was scored HIGH severity, the same tier as genuine production risk.
- Note: A related, structurally different limitation (not a detector bug, and consistent with the same literal-value-only extraction constraint already documented for Online Boutique's Go services): front-end's real calls to catalogue, carts, orders, and user (front-end/api/endpoints.js) are built as `util.format("http://catalogue%s", domain)` - a runtime string, not a literal `http://...` string inside the calling `request.get(...)`/`fetch(...)` site - so none of these genuine, production inter-service calls are visible to MESA's static, literal-value-only call extraction. This likely hides real CHATTY_SERVICE-shaped relationships (front-end calls catalogue via at least 3 distinct routes alone) that a dynamic-URL-aware extractor would surface. Not added to this benchmark's ground_truth: consistent with how the equivalent Online Boutique/Go gap was handled, ground truth here reflects what a reviewer can confirm from the same kind of static evidence MESA itself uses, not omniscient knowledge of the runtime architecture - so this is reported as a named limitation rather than an inflated false-negative count.
- Limitation: Discovery precision on this repository is 8/23 = 0.3478 (measured, via `mesa evaluate`) even though recall is 8/8 = 1.0. The two most notable over-triggers, at confidence high enough to be auto-selected by default, are `catalogue-db` and `user-db` (Docker build-context subdirectories containing only a Dockerfile for seeding the corresponding database image, 0.57 confidence each) - the same discovery-false-positive pattern already seen on the Spring sample (config-service's nested resource directory). The remaining ~13 lower-confidence, not-auto-selected candidates are test/tooling directories (`orders/test/json-server`, `front-end/test`, six `*/docker/<service>` subdirectories, five `*/api-spec` directories) that the discovery evaluation metric counts against precision even though a user scanning through the UI would not have them pre-selected - this repository's unusually high ratio of test/tooling subdirectories to real services is the main driver of the low discovery-precision number, not a sign MESA mis-selected services for analysis (all 8 real services were correctly selected by default, see service_discovery above).
- Limitation: This repository has a genuinely different, and more severe, precision profile than Online Boutique or the Spring sample: 17 of 21 raw findings (81%) are false positives, almost entirely because MESA's current heuristics treat test fixtures, API-contract mock files, and source-code comments as equally authoritative to real service configuration. This is a concrete, actionable direction for future detector work (e.g. stripping comments before hard-coded-dependency matching; excluding common test/mock directory conventions from certain detectors while keeping them in scope for others, mirroring the config-server distinction already made for YAML/properties files) - not attempted here, kept as an honestly-reported limitation rather than narrowed after the fact by loosening the ground truth to match what the detector currently produces.
- Limitation: Only 8 of Sock Shop's services were evaluated (the 8 with real business logic: catalogue, carts, orders, payment, shipping, user, queue-master, front-end). `edge-router` (API gateway/routing config) and the `orders.NET`/`orders-aws` alternate implementations were excluded as out of scope - the default deployment uses the Java `orders` service evaluated here.
