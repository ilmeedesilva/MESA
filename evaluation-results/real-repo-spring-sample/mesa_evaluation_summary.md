# MESA Evaluation Summary

Benchmark: `mesa-phase-7-real-repo-spring-sample`

## Detector Quality

- Precision: `1.0`
- Recall: `1.0`
- F1: `1.0`

## Service Discovery Quality

- Systems evaluated: `1`
- Precision: `0.75`
- Recall: `1.0`
- F1: `0.8571`

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

### spring-sample

- Note: config-service is a Spring Cloud Config Server: it hosts one YAML file per other service (gateway-service.yml, discovery-service.yml, etc.) containing that service's own Eureka registration address. MESA's static extractor originally read every YAML file under a service's directory as if its contents were that service's own configuration, so it read discovery-service's Eureka URL out of a file config-service merely serves to discovery-service at runtime, not a URL config-service itself calls.
- Note: That misattribution originally produced a CHATTY_SERVICE finding (config-service -> discovery-service, 4 static call sites) and a CYCLIC_DEPENDENCY finding (config-service -> discovery-service -> config-service), both false positives. FIXED in `src/mesa/analysis/extractor.py` (`extract_service_facts`/`_stem_matches_other_service`, see `docs/architecture/PHASE_17_CONFIG_SERVER_MISATTRIBUTION_FIX.md`): MESA now recognizes when a YAML/properties file's name matches a sibling service being scanned and excludes its URLs from the hosting service's own call evidence, while still scanning it for hard-coded-dependency evidence (unaffected, see below). Detector precision on this system moved from 0.9231 to 1.0000 after the fix; both false positives are gone. Regression covered by `tests/test_pipeline.py::test_config_server_hosted_files_do_not_create_false_chatty_or_cyclic_findings`.
- Note: The same config-server pattern previously inflated config-service's God Service score (54.5, MEDIUM severity) via its linked_findings contribution from the now-removed false positives; this should be lower after the fix, though it never crossed the threshold to emit an actual GOD_SERVICE finding either way, so it was never part of this benchmark's labeled ground truth.
- Note: The remaining HARD_CODED_SERVICE_DEPENDENCY findings (department/discovery/employee/gateway/organization services hard-coding config-service:8088 and localhost:8088; config-service and gateway-service hard-coding discovery-service:8061/eureka, localhost:8061/eureka, and the placeholder-port gateway route) are labeled true positives: the addresses are genuinely embedded in source/config. Note, however, that Config Server and Eureka bootstrap addresses are a somewhat unavoidable chicken-and-egg case (a service needs a fixed address to find the config/discovery infrastructure before dynamic discovery is available), so 'hard-coded' here is not automatically equivalent to 'avoidable production risk' the way it would be for two ordinary business services calling each other directly.
- Limitation: Service discovery over-triggered on 2 non-service paths in addition to the 6 real services: config-service/src/main/resources/config (a nested resource directory inside config-service, picked up on its own service port configuration evidence) and the repository root itself (picked up on the top-level docker-compose.yml). Discovery precision on this repository is 6/8 = 0.75 even though recall is 6/6 = 1.0.
- Limitation: The config-server misattribution described above (chatty/cyclic false positives, inflated God Service score) was the most significant finding from this repository, and is now fixed (see evaluator_notes above). It is kept here as a historical record: it showed MESA's static, per-file extraction approach did not distinguish a Config Server's hosted templates from its own runtime behavior, which would have recurred on any real Spring Cloud Config-based system, not just this one — the fix is general, not specific to this repo.
