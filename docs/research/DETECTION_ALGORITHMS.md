# MESA Detection Algorithms

## Chatty Services

Static heuristic: count API call sites from one service to another. If count meets/exceeds threshold, report `CHATTY_SERVICE`.

Evidence: caller, callee, call count, URLs, methods, source locations.

Runtime-like reasoning: MESA does not measure runtime frequency. It estimates chatty risk from static call-site density and synchronous call topology.

## Cyclic Dependencies

Algorithm: project service API calls into a directed graph and run simple cycle detection. Two-service cycles are critical because they directly block independent deployment.

Evidence: cycle path and cycle length.

## Shared Database

Algorithm: group database connection evidence by normalized database key. If multiple services use the same database key, report `SHARED_DATABASE`.

Evidence: services, database key, source config locations.

## Hard-Coded Service Dependencies

Algorithm: scan source and configuration files for literal service URLs, private IP endpoints, localhost ports, and service-like hostnames.

Evidence: value, host, port, scheme, file type, file path, line number, reason.

## God Service

Algorithm: weighted scoring model using API count, inbound/outbound dependencies, database count, file count, domain keyword count, centrality, and linked findings.

Output: per-service score and `GOD_SERVICE` finding above threshold.

## Governance Violations

Algorithm: evaluate simple YAML/JSON policy comparisons against system-level and service-level metrics. Failed policies become `GOVERNANCE_POLICY_VIOLATION` findings.
