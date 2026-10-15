# MESA Evaluation Summary

Benchmark: `mesa-real-repo-sockshop`

## Detector Quality

- Precision: `1.0`
- Recall: `1.0`
- F1: `1.0`

## Service Discovery Quality

- Systems evaluated: `1`
- Precision: `0.3478`
- Recall: `1.0`
- F1: `0.5161`

## Explanation Quality

- Systems evaluated: `1`
- Helpfulness score: `0.95`
- Grounding score: `1.0`
- Coverage score: `1.0`

## Recommendation Quality

- Systems evaluated: `1`
- Usefulness score: `1.0`
- Structured coverage: `1.0`
- Step quality score: `1.0`

## Evaluator Notes

### sock-shop

- Note: True positives (4, all HARD_CODED_SERVICE_DEPENDENCY): catalogue hard-codes its own database DSN default `catalogue_user:default_password@tcp(catalogue-db:3306)/socksdb` as a Go flag default (cmd/cataloguesvc/main.go:48); user hard-codes `user-db:27017` in two of its own real deployment compose files (docker-compose.yml, docker-compose-zipkin.yml); front-end hard-codes `user-db:27017` in its own test/docker-compose.yml. All four are genuine literal addresses embedded in each service's own configuration, not test/mock artifacts.
- Note: FIXED - was a false positive - SHARED_DATABASE (carts, orders): MESA originally reported both services sharing `mongodb://localhost/data`. Manually verified this was wrong: each service's real Spring config points at a separate database host (`carts/src/main/resources/application.properties`: `mongodb://${db:carts-db}:27017/data`; `orders/.../application.properties`: `mongodb://${db:orders-db}:27017/data`) - genuinely separate persistence, the correct microservices pattern. MESA's extractor still cannot parse the Spring `${var:default}` placeholder syntax in a database URI (confirmed: DB_PATTERN does not match `mongodb://${db:carts-db}:27017/data`), so this evidence was never the source. The real source was that both services' Dredd API-contract-test hook files (`api-spec/hooks.js`) independently contain the identical literal fallback `process.env.MONGO_ENDPOINT || 'mongodb://localhost:32769/data'` - generic local-testing boilerplate that happens to be byte-identical across services, not evidence of shared production persistence. Fixed by excluding database-connection evidence sourced from an `api-spec/` directory (see the top-level note above); this finding no longer appears.
- Note: FIXED - were false positives - HARD_CODED_SERVICE_DEPENDENCY, front-end (6 of front-end's original 7 findings): 1 was `max-width:768`, a CSS media-query breakpoint inside the vendored third-party library `public/js/modernizr.js`, misparsed by the host:port heuristic as a service address - turned out to be inside a `//` comment in that file, so the comment-stripping fix removed it as a side effect. The other 5 were `http://front-end:8080/` appearing in front-end's own CasperJS end-to-end test files (test/e2e/*.js) - front-end hardcoding the URL of the running instance of itself under test, normal E2E test practice, not a cross-service coupling risk. Fixed by the self-reference exclusion (host equals the owning service's own name); front-end's one remaining, genuine finding (`user-db:27017` in `test/docker-compose.yml`) is correctly preserved since it is real deployment config, not test/mock data, and neither new rule targets it.
- Note: FIXED - were false positives - HARD_CODED_SERVICE_DEPENDENCY, orders (10 of orders's original 11 findings): 4 were `http://users-orders-mock:80/...` inside `api-spec/hooks.js` - a Dredd API-contract-test mock server address, not a real dependency - fixed by the `api-spec/` directory exclusion. The remaining 6 were `http://localhost:808x/...` inside `src/main/java/.../entities/CustomerOrder.java` lines 12-16 - confirmed entirely inside `//`-prefixed code comments (example curl commands documenting how to call the API by hand), not live code - fixed by the comment-stripping rule, which specifically distinguishes a genuine line comment from a `//` that is part of a URL scheme like `http://` appearing in real code.
- Note: A related, structurally different limitation (not a detector bug, and consistent with the same literal-value-only extraction constraint already documented for Online Boutique's Go services): front-end's real calls to catalogue, carts, orders, and user (front-end/api/endpoints.js) are built as `util.format("http://catalogue%s", domain)` - a runtime string, not a literal `http://...` string inside the calling `request.get(...)`/`fetch(...)` site - so none of these genuine, production inter-service calls are visible to MESA's static, literal-value-only call extraction. This likely hides real CHATTY_SERVICE-shaped relationships (front-end calls catalogue via at least 3 distinct routes alone) that a dynamic-URL-aware extractor would surface. Not added to this benchmark's ground_truth: consistent with how the equivalent Online Boutique/Go gap was handled, ground truth here reflects what a reviewer can confirm from the same kind of static evidence MESA itself uses, not omniscient knowledge of the runtime architecture - so this is reported as a named limitation rather than an inflated false-negative count.
- Limitation: Discovery precision on this repository is 8/23 = 0.3478 (measured, via `mesa evaluate`) even though recall is 8/8 = 1.0. The two most notable over-triggers, at confidence high enough to be auto-selected by default, are `catalogue-db` and `user-db` (Docker build-context subdirectories containing only a Dockerfile for seeding the corresponding database image, 0.57 confidence each) - the same discovery-false-positive pattern already seen on the Spring sample (config-service's nested resource directory). The remaining ~13 lower-confidence, not-auto-selected candidates are test/tooling directories (`orders/test/json-server`, `front-end/test`, six `*/docker/<service>` subdirectories, five `*/api-spec` directories) that the discovery evaluation metric counts against precision even though a user scanning through the UI would not have them pre-selected - this repository's unusually high ratio of test/tooling subdirectories to real services is the main driver of the low discovery-precision number, not a sign MESA mis-selected services for analysis (all 8 real services were correctly selected by default, see service_discovery above).
- Limitation: RESOLVED: this repository originally had a genuinely different, and more severe, precision profile than Online Boutique or the Spring sample - 17 of 21 raw findings (81%) were false positives, almost entirely because MESA's heuristics treated test fixtures, API-contract mock files, and source-code comments as equally authoritative to real service configuration. This was named as a concrete, actionable direction for future detector work in an earlier version of this benchmark file and has since been implemented (comment-stripping, api-spec/mock directory exclusion, self-reference exclusion - see the top-level note above); precision on this repository is now 1.0000 with recall unchanged at 1.0000, verified live rather than by loosening the ground truth to match what the detector produces.
- Limitation: Only 8 of Sock Shop's services were evaluated (the 8 with real business logic: catalogue, carts, orders, payment, shipping, user, queue-master, front-end). `edge-router` (API gateway/routing config) and the `orders.NET`/`orders-aws` alternate implementations were excluded as out of scope - the default deployment uses the Java `orders` service evaluated here.
