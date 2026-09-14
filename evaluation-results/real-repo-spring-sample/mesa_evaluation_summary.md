# MESA Evaluation Summary

Benchmark: `mesa-phase-7-real-repo-spring-sample`

## Detector Quality

- Precision: `0.9231`
- Recall: `1.0`
- F1: `0.96`

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
- Usefulness score: `0.9923`
- Structured coverage: `1.0`
- Step quality score: `1.0`

## Evaluator Notes

### spring-sample

- Note: config-service is a Spring Cloud Config Server: it hosts one YAML file per other service (gateway-service.yml, discovery-service.yml, etc.) containing that service's own Eureka registration address. MESA's static extractor reads every YAML file under a service's directory as if its contents were that service's own configuration, so it read discovery-service's Eureka URL out of a file config-service merely serves to discovery-service at runtime, not a URL config-service itself calls.
- Note: That misattribution produced a CHATTY_SERVICE finding (config-service -> discovery-service, 4 static call sites) and a CYCLIC_DEPENDENCY finding (config-service -> discovery-service -> config-service). Both are treated as false positives in this benchmark's ground truth (i.e. deliberately omitted, so any occurrence MESA predicts counts against precision) with a documented root cause: MESA's per-file static extraction has no concept of 'config server hosts this file for another service' versus 'this service's own runtime configuration', which is a real, current limitation rather than a one-off scan artifact.
- Note: The same config-server pattern also inflates config-service's God Service score (54.5, MEDIUM severity) via its linked_findings and file_volume contributions, though the score stayed under the threshold that would emit an actual GOD_SERVICE finding, so it is not part of this benchmark's labeled ground truth.
- Note: The remaining HARD_CODED_SERVICE_DEPENDENCY findings (department/discovery/employee/gateway/organization services hard-coding config-service:8088 and localhost:8088; config-service and gateway-service hard-coding discovery-service:8061/eureka, localhost:8061/eureka, and the placeholder-port gateway route) are labeled true positives: the addresses are genuinely embedded in source/config. Note, however, that Config Server and Eureka bootstrap addresses are a somewhat unavoidable chicken-and-egg case (a service needs a fixed address to find the config/discovery infrastructure before dynamic discovery is available), so 'hard-coded' here is not automatically equivalent to 'avoidable production risk' the way it would be for two ordinary business services calling each other directly.
- Limitation: Service discovery over-triggered on 2 non-service paths in addition to the 6 real services: config-service/src/main/resources/config (a nested resource directory inside config-service, picked up on its own service port configuration evidence) and the repository root itself (picked up on the top-level docker-compose.yml). Discovery precision on this repository is 6/8 = 0.75 even though recall is 6/6 = 1.0.
- Limitation: The config-server misattribution described above (chatty/cyclic false positives, inflated God Service score) is the most significant finding from this repository: it shows MESA's static, per-file extraction approach does not distinguish a Config Server's hosted templates from its own runtime behavior, which will recur on any real Spring Cloud Config-based system, not just this one.
