export const demoWorkspace = {
  project: {
    id: "demo-project-public",
    name: "MESA Public Demo",
    description: "Embedded public demo workspace with example architecture results.",
    created_at: "2026-07-01T09:00:00Z"
  },
  scans: [
    {
      id: "demo-scan-monolith",
      project_id: "demo-project-public",
      status: "completed",
      service_count: 6,
      finding_count: 7,
      created_at: "2026-07-01T10:00:00Z",
      completed_at: "2026-07-01T10:02:00Z"
    },
    {
      id: "demo-scan-shared-db",
      project_id: "demo-project-public",
      status: "completed",
      service_count: 2,
      finding_count: 2,
      created_at: "2026-06-30T08:00:00Z",
      completed_at: "2026-06-30T08:01:00Z"
    }
  ],
  policies: [
    {
      id: "no-cycles",
      name: "No cyclic dependencies",
      rule: "dependency_cycle_count == 0",
      severity: "CRITICAL",
      enabled: true
    },
    {
      id: "no-hardcoded-service-urls",
      name: "No hard-coded service URLs",
      rule: "hard_coded_service_url_count == 0",
      severity: "HIGH",
      enabled: true
    },
    {
      id: "max-outbound-dependencies",
      name: "Maximum outbound dependencies",
      rule: "outbound_dependencies <= 5",
      severity: "HIGH",
      enabled: true
    }
  ],
  policyText: `policies:
  - id: no-cycles
    name: No cyclic dependencies
    rule: dependency_cycle_count == 0
    severity: critical
  - id: no-hardcoded-service-urls
    name: No hard-coded service URLs
    rule: hard_coded_service_url_count == 0
    severity: high
  - id: max-outbound-dependencies
    name: Maximum outbound dependencies
    rule: outbound_dependencies <= 5
    severity: high
`,
  results: {
    "demo-scan-shared-db": {
      findings: [
        {
          id: "MESA-SHDB-001",
          type: "SHARED_DATABASE",
          severity: "CRITICAL",
          confidence: 0.88,
          services: ["order-service", "payment-service"],
          description: "order-service and payment-service share database postgres://shared-db/orders.",
          evidence: [
            { service: "order-service", database: "postgres://shared-db/orders", source: "/workspace/tests/fixtures/shared-db/order-service/.env:1" },
            { service: "payment-service", database: "postgres://shared-db/orders", source: "/workspace/tests/fixtures/shared-db/payment-service/.env:1" }
          ],
          recommendation: "Assign one owner for the shared data and move the other service behind APIs or events.",
          recommendations: [
            {
              root_cause: "Multiple services statically reference the same database.",
              architectural_consequence: "Schema changes and deployments become coupled across services.",
              affected_services: ["order-service", "payment-service"],
              affected_files: [
                "/workspace/tests/fixtures/shared-db/order-service/.env",
                "/workspace/tests/fixtures/shared-db/payment-service/.env"
              ],
              refactoring_steps: [
                "Choose one service as the data owner.",
                "Move direct database access from the non-owner behind owner APIs or domain events.",
                "Re-run MESA and verify that only one service still references the shared database."
              ],
              expected_impact: "Improves ownership clarity and makes schema evolution safer.",
              priority: "Immediate",
              estimated_difficulty: "High",
              evidence: [{ database: "postgres://shared-db/orders" }],
              source: "rule-based"
            }
          ]
        },
        {
          id: "MESA-HCDD-001",
          type: "HARD_CODED_SERVICE_DEPENDENCY",
          severity: "LOW",
          confidence: 0.78,
          services: ["payment-service"],
          description: "payment-service directly references shared-db:5432 in /workspace/tests/fixtures/shared-db/payment-service/.env:1. This creates a hard-coded service dependency that can bypass service discovery or environment-specific configuration.",
          evidence: [
            {
              anti_pattern: "Hard-Coded Service Dependency",
              service: "payment-service",
              value: "shared-db:5432",
              file_path: "/workspace/tests/fixtures/shared-db/payment-service/.env",
              line_number: 1,
              reason: "service endpoint",
              duplicate_occurrences: 1
            }
          ],
          recommendation: "Move endpoint values behind configuration or service discovery.",
          recommendations: [
            {
              root_cause: "A concrete host or port is embedded in configuration.",
              architectural_consequence: "Deployments become more environment-specific and fragile.",
              affected_services: ["payment-service"],
              affected_files: ["/workspace/tests/fixtures/shared-db/payment-service/.env"],
              refactoring_steps: [
                "Move the endpoint value into deployment-managed configuration.",
                "Centralize database client creation behind one configuration entry."
              ],
              expected_impact: "Improves portability across environments.",
              priority: "Low",
              estimated_difficulty: "Low",
              evidence: [{ value: "shared-db:5432" }],
              source: "rule-based"
            }
          ]
        }
      ],
      graph: {
        nodes: [
          { id: "order-service", type: "service" },
          { id: "payment-service", type: "service" },
          { id: "db:orders", type: "database" }
        ],
        edges: [
          { source: "order-service", target: "db:orders", type: "uses_database" },
          { source: "payment-service", target: "db:orders", type: "uses_database" }
        ]
      },
      summary: {
        service_count: 2,
        finding_count: 2,
        findings_by_severity: { CRITICAL: 1, LOW: 1 },
        findings_by_type: { SHARED_DATABASE: 1, HARD_CODED_SERVICE_DEPENDENCY: 1 },
        health_scores: {
          service: [
            {
              scope: "service",
              target: "order-service",
              score: 58.2,
              grade: "Moderate",
              breakdown: {
                coupling: 72,
                cohesion: 86,
                cyclic_dependencies: 100,
                shared_database_usage: 55,
                hard_coded_dependency_risk: 100,
                god_service_risk: 100,
                api_complexity: 92,
                deployment_independence: 61,
                ownership_clarity: 52
              },
              explanation: "order-service has service-level architectural health 58.2/100; weakest dimensions are ownership clarity, shared database usage, deployment independence.",
              recommendations: [
                "Assign clear data owners and replace shared persistence with APIs, events, or read models."
              ]
            },
            {
              scope: "service",
              target: "payment-service",
              score: 46.4,
              grade: "Poor",
              breakdown: {
                coupling: 68,
                cohesion: 84,
                cyclic_dependencies: 100,
                shared_database_usage: 55,
                hard_coded_dependency_risk: 82,
                god_service_risk: 100,
                api_complexity: 88,
                deployment_independence: 48,
                ownership_clarity: 48
              },
              explanation: "payment-service has service-level architectural health 46.4/100; weakest dimensions are ownership clarity, deployment independence, shared database usage.",
              recommendations: [
                "Move endpoints into configuration or service discovery.",
                "Assign clear data owners and replace shared persistence with APIs, events, or read models."
              ]
            }
          ],
          domain: [
            {
              scope: "domain",
              target: "payments",
              score: 52.3,
              grade: "Moderate",
              breakdown: {
                coupling: 70,
                cohesion: 85,
                cyclic_dependencies: 100,
                shared_database_usage: 55,
                hard_coded_dependency_risk: 91,
                god_service_risk: 100,
                api_complexity: 90,
                deployment_independence: 55,
                ownership_clarity: 50
              },
              explanation: "payments has domain-level architectural health 52.3/100; weakest dimensions are ownership clarity, shared database usage, deployment independence.",
              recommendations: [
                "Assign clear service ownership over data and APIs."
              ]
            }
          ],
          system: {
            scope: "system",
            target: "system",
            score: 51.8,
            grade: "Moderate",
            breakdown: {
              coupling: 70,
              cohesion: 85,
              cyclic_dependencies: 100,
              shared_database_usage: 55,
              hard_coded_dependency_risk: 91,
              god_service_risk: 100,
              api_complexity: 90,
              deployment_independence: 55,
              ownership_clarity: 50
            },
            explanation: "system has system-level architectural health 51.8/100; weakest dimensions are ownership clarity, shared database usage, deployment independence.",
            recommendations: [
              "Assign clear data owners and replace shared persistence with APIs, events, or read models."
            ]
          }
        }
      }
    },
    "demo-scan-monolith": {
      findings: [
        {
          id: "MESA-GODS-001",
          type: "GOD_SERVICE",
          severity: "HIGH",
          confidence: 0.88,
          services: ["platform-service"],
          description: "platform-service has a God Service risk score of 82.0/100. The service appears too central or responsible for too many capabilities.",
          evidence: [
            {
              anti_pattern: "God Service",
              service: "platform-service",
              score: 82,
              severity: "HIGH",
              explanation: "platform-service exposes many APIs, has multiple inbound and outbound dependencies, and is linked to several findings."
            }
          ],
          recommendation: "Review platform-service for responsibility boundaries and split cohesive capabilities into clearer modules or services.",
          recommendations: [
            {
              root_cause: "The service has accumulated too many responsibilities and dependencies.",
              architectural_consequence: "It becomes a bottleneck for change and centralizes too much system behavior.",
              affected_services: ["platform-service"],
              affected_files: ["/workspace/tests/fixtures/god/platform-service/app.py"],
              refactoring_steps: [
                "Group platform-service capabilities by business capability.",
                "Reduce direct outbound dependencies through events or orchestration.",
                "Extract stable cohesive responsibilities into separate modules or services."
              ],
              expected_impact: "Improves maintainability, ownership clarity, and scalability.",
              priority: "High",
              estimated_difficulty: "High",
              evidence: [{ score: 82 }],
              source: "rule-based"
            }
          ]
        },
        {
          id: "MESA-CYCL-001",
          type: "CYCLIC_DEPENDENCY",
          severity: "CRITICAL",
          confidence: 0.9,
          services: ["platform-service", "order-service"],
          description: "Cyclic service dependency detected: platform-service -> order-service -> platform-service.",
          evidence: [{ cycle: ["platform-service", "order-service"], cycle_path: ["platform-service", "order-service", "platform-service"], cycle_length: 2 }],
          recommendation: "Break the cycle by reversing one dependency or introducing an event boundary.",
          recommendations: [
            {
              root_cause: "The affected services depend on each other directly.",
              architectural_consequence: "The cycle blocks independent deployment and increases coordination cost.",
              affected_services: ["platform-service", "order-service"],
              affected_files: ["/workspace/tests/fixtures/god/platform-service/app.py", "/workspace/tests/fixtures/god/order-service/app.py"],
              refactoring_steps: [
                "Identify the dependency edge with the weakest ownership justification.",
                "Replace one synchronous call with an event or orchestration boundary.",
                "Re-run cycle detection and verify the loop is removed."
              ],
              expected_impact: "Improves deployment independence and reduces cascading change risk.",
              priority: "Immediate",
              estimated_difficulty: "High",
              evidence: [{ cycle_length: 2 }],
              source: "rule-based"
            }
          ]
        },
        {
          id: "MESA-CHAT-001",
          type: "CHATTY_SERVICE",
          severity: "MEDIUM",
          confidence: 0.82,
          services: ["platform-service", "order-service"],
          description: "platform-service has 6 static call sites targeting order-service, meeting or exceeding the chatty threshold of 3.",
          evidence: [{ caller: "platform-service", callee: "order-service", call_count: 6 }],
          recommendation: "Review whether these calls can be consolidated into a coarser API or read model.",
          recommendations: [
            {
              root_cause: "Multiple static call sites suggest a fine-grained API boundary.",
              architectural_consequence: "The services become latency-sensitive and harder to scale independently.",
              affected_services: ["platform-service", "order-service"],
              affected_files: ["/workspace/tests/fixtures/god/platform-service/app.py"],
              refactoring_steps: [
                "Group the repeated calls by use case.",
                "Replace repeated fine-grained calls with a coarser endpoint or read model.",
                "Verify the static call count drops after refactoring."
              ],
              expected_impact: "Lowers synchronous coupling and reduces request fragility.",
              priority: "High",
              estimated_difficulty: "Medium",
              evidence: [{ call_count: 6 }],
              source: "rule-based"
            }
          ]
        },
        {
          id: "MESA-HCDD-010",
          type: "HARD_CODED_SERVICE_DEPENDENCY",
          severity: "MEDIUM",
          confidence: 0.88,
          services: ["platform-service"],
          description: "platform-service directly references http://order-service/orders in /workspace/tests/fixtures/god/platform-service/app.py:8. This creates a hard-coded service dependency that can bypass service discovery or environment-specific configuration.",
          evidence: [{ value: "http://order-service/orders", file_path: "/workspace/tests/fixtures/god/platform-service/app.py", line_number: 8, reason: "service endpoint", duplicate_occurrences: 1 }],
          recommendation: "Move the endpoint value into environment-specific configuration.",
          recommendations: [
            {
              root_cause: "A concrete URL is embedded in source code instead of deployment-managed configuration.",
              architectural_consequence: "Endpoint changes require code edits and reduce portability.",
              affected_services: ["platform-service"],
              affected_files: ["/workspace/tests/fixtures/god/platform-service/app.py"],
              refactoring_steps: [
                "Move the endpoint value into environment-specific configuration.",
                "Centralize client creation behind a typed adapter."
              ],
              expected_impact: "Improves portability across environments and lowers operational coupling.",
              priority: "High",
              estimated_difficulty: "Low",
              evidence: [{ value: "http://order-service/orders" }],
              source: "rule-based"
            }
          ]
        },
        {
          id: "MESA-HCDD-011",
          type: "HARD_CODED_SERVICE_DEPENDENCY",
          severity: "MEDIUM",
          confidence: 0.88,
          services: ["platform-service"],
          description: "platform-service directly references http://payment-service/payments in /workspace/tests/fixtures/god/platform-service/app.py:12. This creates a hard-coded service dependency that can bypass service discovery or environment-specific configuration.",
          evidence: [{ value: "http://payment-service/payments", file_path: "/workspace/tests/fixtures/god/platform-service/app.py", line_number: 12, reason: "service endpoint", duplicate_occurrences: 1 }],
          recommendation: "Move the endpoint value into environment-specific configuration.",
          recommendations: [
            {
              root_cause: "A concrete URL is embedded in source code instead of deployment-managed configuration.",
              architectural_consequence: "Endpoint changes require code edits and reduce portability.",
              affected_services: ["platform-service"],
              affected_files: ["/workspace/tests/fixtures/god/platform-service/app.py"],
              refactoring_steps: [
                "Move the endpoint value into environment-specific configuration.",
                "Centralize client creation behind a typed adapter."
              ],
              expected_impact: "Improves portability across environments and lowers operational coupling.",
              priority: "High",
              estimated_difficulty: "Low",
              evidence: [{ value: "http://payment-service/payments" }],
              source: "rule-based"
            }
          ]
        },
        {
          id: "MESA-HCDD-012",
          type: "HARD_CODED_SERVICE_DEPENDENCY",
          severity: "MEDIUM",
          confidence: 0.88,
          services: ["platform-service"],
          description: "platform-service directly references http://user-service/users in /workspace/tests/fixtures/god/platform-service/app.py:16. This creates a hard-coded service dependency that can bypass service discovery or environment-specific configuration.",
          evidence: [{ value: "http://user-service/users", file_path: "/workspace/tests/fixtures/god/platform-service/app.py", line_number: 16, reason: "service endpoint", duplicate_occurrences: 1 }],
          recommendation: "Move the endpoint value into environment-specific configuration.",
          recommendations: [
            {
              root_cause: "A concrete URL is embedded in source code instead of deployment-managed configuration.",
              architectural_consequence: "Endpoint changes require code edits and reduce portability.",
              affected_services: ["platform-service"],
              affected_files: ["/workspace/tests/fixtures/god/platform-service/app.py"],
              refactoring_steps: [
                "Move the endpoint value into environment-specific configuration.",
                "Centralize client creation behind a typed adapter."
              ],
              expected_impact: "Improves portability across environments and lowers operational coupling.",
              priority: "High",
              estimated_difficulty: "Low",
              evidence: [{ value: "http://user-service/users" }],
              source: "rule-based"
            }
          ]
        },
        {
          id: "MESA-GOV-no-hardcoded-service-urls-hard-coded-service-url-count-system",
          type: "GOVERNANCE_POLICY_VIOLATION",
          severity: "HIGH",
          confidence: 0.96,
          services: [],
          description: "Governance policy 'No hard-coded service URLs' failed for system: hard_coded_service_url_count was 3, expected rule 'hard_coded_service_url_count == 0'.",
          evidence: [{ policy_id: "no-hardcoded-service-urls", policy_name: "No hard-coded service URLs", actual: 3, expected: 0 }],
          recommendation: "Bring the architecture back within the configured governance policy and re-run MESA.",
          recommendations: [
            {
              root_cause: "The current architecture violates a configured governance rule.",
              architectural_consequence: "The system is drifting away from an agreed architecture constraint.",
              affected_services: [],
              affected_files: ["/workspace/tests/fixtures/god/platform-service/app.py"],
              refactoring_steps: [
                "Remove the direct hard-coded endpoints from source.",
                "Re-run MESA and verify the governance finding is removed."
              ],
              expected_impact: "Keeps the architecture aligned with project-specific governance constraints.",
              priority: "High",
              estimated_difficulty: "Medium",
              evidence: [{ policy_name: "No hard-coded service URLs" }],
              source: "rule-based"
            }
          ]
        }
      ],
      graph: {
        nodes: [
          { id: "platform-service", type: "service" },
          { id: "order-service", type: "service" },
          { id: "payment-service", type: "service" },
          { id: "user-service", type: "service" },
          { id: "inventory-service", type: "service" },
          { id: "notification-service", type: "service" },
          { id: "api:platform-service", type: "api", serviceName: "platform-service" }
        ],
        edges: [
          { source: "platform-service", target: "order-service", type: "api_call" },
          { source: "platform-service", target: "order-service", type: "api_call" },
          { source: "platform-service", target: "order-service", type: "api_call" },
          { source: "platform-service", target: "payment-service", type: "api_call" },
          { source: "platform-service", target: "user-service", type: "api_call" },
          { source: "order-service", target: "platform-service", type: "api_call" },
          { source: "platform-service", target: "inventory-service", type: "api_call" },
          { source: "platform-service", target: "notification-service", type: "api_call" }
        ]
      },
      summary: {
        service_count: 6,
        finding_count: 7,
        findings_by_severity: { CRITICAL: 1, HIGH: 2, MEDIUM: 4 },
        findings_by_type: {
          GOD_SERVICE: 1,
          CYCLIC_DEPENDENCY: 1,
          CHATTY_SERVICE: 1,
          HARD_CODED_SERVICE_DEPENDENCY: 3,
          GOVERNANCE_POLICY_VIOLATION: 1
        },
        health_scores: {
          service: [
            {
              scope: "service",
              target: "platform-service",
              score: 32.8,
              grade: "Poor",
              breakdown: {
                coupling: 34,
                cohesion: 48,
                cyclic_dependencies: 60,
                shared_database_usage: 100,
                hard_coded_dependency_risk: 46,
                god_service_risk: 18,
                api_complexity: 42,
                deployment_independence: 30,
                ownership_clarity: 54
              },
              explanation: "platform-service has service-level architectural health 32.8/100; weakest dimensions are god service risk, deployment independence, coupling, api complexity.",
              recommendations: [
                "Decompose oversized services around cohesive capabilities.",
                "Reduce direct service dependencies; prefer events, stable APIs, or orchestration boundaries."
              ]
            },
            {
              scope: "service",
              target: "order-service",
              score: 57.4,
              grade: "Moderate",
              breakdown: {
                coupling: 61,
                cohesion: 74,
                cyclic_dependencies: 60,
                shared_database_usage: 100,
                hard_coded_dependency_risk: 100,
                god_service_risk: 100,
                api_complexity: 82,
                deployment_independence: 56,
                ownership_clarity: 72
              },
              explanation: "order-service has service-level architectural health 57.4/100; weakest dimensions are cyclic dependencies, deployment independence, coupling.",
              recommendations: [
                "Break dependency cycles by reversing ownership or introducing events."
              ]
            },
            {
              scope: "service",
              target: "payment-service",
              score: 72.1,
              grade: "Good",
              breakdown: {
                coupling: 74,
                cohesion: 80,
                cyclic_dependencies: 100,
                shared_database_usage: 100,
                hard_coded_dependency_risk: 100,
                god_service_risk: 100,
                api_complexity: 86,
                deployment_independence: 71,
                ownership_clarity: 76
              },
              explanation: "payment-service has service-level architectural health 72.1/100; weakest dimensions are deployment independence and coupling.",
              recommendations: [
                "Keep monitoring payment-service for architectural drift as the system evolves."
              ]
            }
          ],
          domain: [
            {
              scope: "domain",
              target: "platform",
              score: 44.8,
              grade: "Poor",
              breakdown: {
                coupling: 52,
                cohesion: 64,
                cyclic_dependencies: 73,
                shared_database_usage: 100,
                hard_coded_dependency_risk: 82,
                god_service_risk: 54,
                api_complexity: 70,
                deployment_independence: 52,
                ownership_clarity: 67
              },
              explanation: "platform has domain-level architectural health 44.8/100; weakest dimensions are deployment independence, coupling, god service risk.",
              recommendations: [
                "Reduce direct service dependencies and central responsibilities."
              ]
            }
          ],
          system: {
            scope: "system",
            target: "system",
            score: 46.7,
            grade: "Poor",
            breakdown: {
              coupling: 55,
              cohesion: 68,
              cyclic_dependencies: 73,
              shared_database_usage: 100,
              hard_coded_dependency_risk: 82,
              god_service_risk: 54,
              api_complexity: 72,
              deployment_independence: 50,
              ownership_clarity: 69
            },
            explanation: "system has system-level architectural health 46.7/100; weakest dimensions are deployment independence, coupling, god service risk, cohesion.",
            recommendations: [
              "Reduce runtime coupling that forces services to change or deploy together.",
              "Decompose oversized services around cohesive capabilities."
            ]
          }
        }
      }
    }
  },
  roadmaps: {
    "demo-scan-shared-db": {
      scan_id: "demo-scan-shared-db",
      generated_from_finding_count: 2,
      system_health_score: 51.8,
      summary: "MESA grouped 2 findings into 2 remediation actions. Start by externalizing the endpoint configuration, then remove shared database ownership across the two services.",
      quick_wins: [
        {
          id: "roadmap-demo-shared-01",
          title: "Externalize hard-coded endpoints in 1 service",
          bucket: "quick_win",
          priority_rank: 1,
          priority_score: 58.2,
          summary: "Replace the embedded database host and port in payment-service with deployment-managed configuration.",
          rationale: "The payment-service configuration is environment-specific and increases drift risk.",
          expected_benefit: "Improves portability across environments.",
          suggested_order_reason: "This is a low-effort quick win that reduces operational fragility before larger data-ownership work.",
          estimated_difficulty: "Low",
          affected_services: ["payment-service"],
          related_findings: ["MESA-HCDD-001"],
          related_finding_types: ["HARD_CODED_SERVICE_DEPENDENCY"],
          dependencies: [],
          metrics: {
            finding_count: 1,
            max_severity: "LOW",
            average_confidence: 0.78,
            service_centrality: 0.5,
            max_linked_findings: 1,
            service_health_pressure: 0.54,
            impacted_dimensions: ["Hard Coded Dependency Risk", "Deployment Independence"]
          }
        }
      ],
      medium_term_changes: [],
      high_effort_refactors: [
        {
          id: "roadmap-demo-shared-02",
          title: "Remove shared database access for order-service, payment-service",
          bucket: "high_effort",
          priority_rank: 2,
          priority_score: 86.4,
          summary: "Assign one service as the data owner and move the other behind APIs or events.",
          rationale: "Two services directly reference the same database and weaken service ownership boundaries.",
          expected_benefit: "Improves ownership clarity and makes schema evolution safer.",
          suggested_order_reason: "Treat this as the main architectural refactor because it changes data ownership and deployment independence.",
          estimated_difficulty: "High",
          affected_services: ["order-service", "payment-service"],
          related_findings: ["MESA-SHDB-001"],
          related_finding_types: ["SHARED_DATABASE"],
          dependencies: ["roadmap-demo-shared-01"],
          metrics: {
            finding_count: 1,
            max_severity: "CRITICAL",
            average_confidence: 0.88,
            service_centrality: 1,
            max_linked_findings: 1,
            service_health_pressure: 0.48,
            impacted_dimensions: ["Shared Database Usage", "Ownership Clarity"]
          }
        }
      ],
      suggested_order: [
        { order: 1, action_id: "roadmap-demo-shared-01", title: "Externalize hard-coded endpoints in 1 service", bucket: "quick_win", why_now: "Clear the deployment-specific config first so later ownership changes happen on a cleaner baseline." },
        { order: 2, action_id: "roadmap-demo-shared-02", title: "Remove shared database access for order-service, payment-service", bucket: "high_effort", why_now: "This is the key architecture fix because the shared database is the main source of coupling." }
      ],
      dependencies: [
        { action_id: "roadmap-demo-shared-02", depends_on: "roadmap-demo-shared-01", reason: "Stabilize configuration first so the data ownership migration is easier to manage." }
      ]
    },
    "demo-scan-monolith": {
      scan_id: "demo-scan-monolith",
      generated_from_finding_count: 7,
      system_health_score: 46.7,
      summary: "MESA grouped 7 findings into 5 remediation actions. Start with endpoint cleanup and the service cycle, then reduce chatty coupling and decompose platform-service.",
      quick_wins: [
        {
          id: "roadmap-demo-monolith-01",
          title: "Externalize hard-coded endpoints in 1 service",
          bucket: "quick_win",
          priority_rank: 1,
          priority_score: 79.2,
          summary: "Replace the direct service URLs inside platform-service with deployment-managed configuration.",
          rationale: "Three separate hard-coded endpoints concentrate operational coupling in the hotspot service.",
          expected_benefit: "Improves portability across environments and lowers operational coupling.",
          suggested_order_reason: "This is the fastest cleanup and reduces noise before deeper boundary work.",
          estimated_difficulty: "Low",
          affected_services: ["platform-service"],
          related_findings: ["MESA-HCDD-010", "MESA-HCDD-011", "MESA-HCDD-012"],
          related_finding_types: ["HARD_CODED_SERVICE_DEPENDENCY"],
          dependencies: [],
          metrics: {
            finding_count: 3,
            max_severity: "MEDIUM",
            average_confidence: 0.88,
            service_centrality: 1,
            max_linked_findings: 6,
            service_health_pressure: 0.67,
            impacted_dimensions: ["Hard Coded Dependency Risk", "Deployment Independence"]
          }
        }
      ],
      medium_term_changes: [
        {
          id: "roadmap-demo-monolith-03",
          title: "Reduce chatty traffic between platform-service and order-service",
          bucket: "medium_term",
          priority_rank: 3,
          priority_score: 76.1,
          summary: "Consolidate repeated synchronous calls between platform-service and order-service into a cleaner interaction boundary.",
          rationale: "MESA counted repeated call sites across one interaction path, indicating a fine-grained boundary.",
          expected_benefit: "Lowers synchronous coupling and reduces request fragility.",
          suggested_order_reason: "Tackle this after the obvious endpoint cleanup so the API redesign happens on stable wiring.",
          estimated_difficulty: "Medium",
          affected_services: ["platform-service", "order-service"],
          related_findings: ["MESA-CHAT-001"],
          related_finding_types: ["CHATTY_SERVICE"],
          dependencies: ["roadmap-demo-monolith-01"],
          metrics: {
            finding_count: 1,
            max_severity: "MEDIUM",
            average_confidence: 0.82,
            service_centrality: 1,
            max_linked_findings: 6,
            service_health_pressure: 0.55,
            impacted_dimensions: ["Coupling", "Api Complexity", "Deployment Independence"]
          }
        },
        {
          id: "roadmap-demo-monolith-04",
          title: "Bring policy 'No hard-coded service URLs' back into compliance",
          bucket: "medium_term",
          priority_rank: 4,
          priority_score: 69.4,
          summary: "Use the related remediation work to satisfy the governance rule and verify compliance on the next scan.",
          rationale: "The system is currently violating an agreed architecture constraint.",
          expected_benefit: "Keeps the architecture aligned with project-specific governance constraints.",
          suggested_order_reason: "Use this as a verification checkpoint after the overlapping fixes complete.",
          estimated_difficulty: "Medium",
          affected_services: [],
          related_findings: ["MESA-GOV-no-hardcoded-service-urls-hard-coded-service-url-count-system"],
          related_finding_types: ["GOVERNANCE_POLICY_VIOLATION"],
          dependencies: ["roadmap-demo-monolith-01"],
          metrics: {
            finding_count: 1,
            max_severity: "HIGH",
            average_confidence: 0.96,
            service_centrality: 0,
            max_linked_findings: 0,
            service_health_pressure: 0.53,
            impacted_dimensions: ["Deployment Independence", "Ownership Clarity"]
          }
        }
      ],
      high_effort_refactors: [
        {
          id: "roadmap-demo-monolith-02",
          title: "Break the dependency cycle across platform-service, order-service",
          bucket: "high_effort",
          priority_rank: 2,
          priority_score: 87.8,
          summary: "Remove the bidirectional dependency loop that ties the two services into one change path.",
          rationale: "The detected cycle directly blocks deployment independence and amplifies central coupling.",
          expected_benefit: "Improves deployment independence and reduces cascading change risk.",
          suggested_order_reason: "Prioritize this structural refactor early because it amplifies other risks when left in place.",
          estimated_difficulty: "High",
          affected_services: ["platform-service", "order-service"],
          related_findings: ["MESA-CYCL-001"],
          related_finding_types: ["CYCLIC_DEPENDENCY"],
          dependencies: [],
          metrics: {
            finding_count: 1,
            max_severity: "CRITICAL",
            average_confidence: 0.9,
            service_centrality: 1,
            max_linked_findings: 6,
            service_health_pressure: 0.61,
            impacted_dimensions: ["Cyclic Dependencies", "Coupling", "Deployment Independence"]
          }
        },
        {
          id: "roadmap-demo-monolith-05",
          title: "Decompose the hotspot service platform-service",
          bucket: "high_effort",
          priority_rank: 5,
          priority_score: 73.8,
          summary: "Split platform-service into clearer responsibility boundaries and reduce the amount of behavior concentrated in one deployable unit.",
          rationale: "platform-service is a central hotspot linked to multiple architectural stress signals.",
          expected_benefit: "Improves maintainability, ownership clarity, and scalability.",
          suggested_order_reason: "Schedule this after the surrounding coupling fixes so the decomposition target is cleaner and easier to scope.",
          estimated_difficulty: "High",
          affected_services: ["platform-service"],
          related_findings: ["MESA-GODS-001"],
          related_finding_types: ["GOD_SERVICE"],
          dependencies: ["roadmap-demo-monolith-01", "roadmap-demo-monolith-02", "roadmap-demo-monolith-03"],
          metrics: {
            finding_count: 1,
            max_severity: "HIGH",
            average_confidence: 0.88,
            service_centrality: 1,
            max_linked_findings: 6,
            service_health_pressure: 0.67,
            impacted_dimensions: ["God Service Risk", "Cohesion", "Coupling"]
          }
        }
      ],
      suggested_order: [
        { order: 1, action_id: "roadmap-demo-monolith-01", title: "Externalize hard-coded endpoints in 1 service", bucket: "quick_win", why_now: "This is the easiest high-value cleanup and removes deployment noise immediately." },
        { order: 2, action_id: "roadmap-demo-monolith-02", title: "Break the dependency cycle across platform-service, order-service", bucket: "high_effort", why_now: "The cycle is a core blocker to independent change and keeps two services coupled." },
        { order: 3, action_id: "roadmap-demo-monolith-03", title: "Reduce chatty traffic between platform-service and order-service", bucket: "medium_term", why_now: "After config cleanup and cycle work, redesign the interaction boundary with less coupling." },
        { order: 4, action_id: "roadmap-demo-monolith-04", title: "Bring policy 'No hard-coded service URLs' back into compliance", bucket: "medium_term", why_now: "Use this as the compliance check once the direct URL fixes are complete." },
        { order: 5, action_id: "roadmap-demo-monolith-05", title: "Decompose the hotspot service platform-service", bucket: "high_effort", why_now: "The decomposition is most likely to succeed once surrounding dependencies are cleaner." }
      ],
      dependencies: [
        { action_id: "roadmap-demo-monolith-03", depends_on: "roadmap-demo-monolith-01", reason: "Stabilize endpoint configuration before redesigning the interaction boundary." },
        { action_id: "roadmap-demo-monolith-04", depends_on: "roadmap-demo-monolith-01", reason: "The governance rule should pass once the hard-coded URLs are removed." },
        { action_id: "roadmap-demo-monolith-05", depends_on: "roadmap-demo-monolith-01", reason: "Clean up endpoint configuration before splitting the hotspot service." },
        { action_id: "roadmap-demo-monolith-05", depends_on: "roadmap-demo-monolith-02", reason: "Reduce structural coupling first so the decomposition target is clearer." },
        { action_id: "roadmap-demo-monolith-05", depends_on: "roadmap-demo-monolith-03", reason: "Chatty interaction cleanup helps define cleaner service boundaries before decomposition." }
      ]
    }
  },
  evolution: [
    {
      project_id: "demo-project-public",
      base_scan_id: "demo-scan-shared-db",
      target_scan_id: "demo-scan-monolith",
      architecture_change_summary: {
        services_previous: 2,
        services_current: 6,
        new_services: ["inventory-service", "notification-service", "platform-service", "user-service"],
        removed_services: [],
        dependency_delta: 6,
        risk_delta: 5,
        summary: "The later snapshot grew into a more connected platform-centered architecture with new risks, more dependencies, and lower overall health."
      },
      risk_trend: {
        previous_total: 2,
        current_total: 7,
        delta: 5,
        new_risk_count: 6,
        resolved_risk_count: 1,
        worsened_risk_count: 1,
        new_risks: [{ type: "GOD_SERVICE", services: ["platform-service"] }],
        resolved_risks: [{ type: "SHARED_DATABASE", services: ["order-service", "payment-service"] }],
        worsened_risks: [{ type: "HARD_CODED_SERVICE_DEPENDENCY", services: ["platform-service"], previous_severity: "LOW", current_severity: "MEDIUM" }]
      },
      score_trend: {
        system_previous: 51.8,
        system_current: 46.7,
        system_delta: -5.1,
        improved_services: [],
        worsened_services: [{ service: "platform-service", previous: 60.2, current: 32.8, delta: -27.4 }]
      },
      service_level_changes: [
        { service: "platform-service", status: "new", file_delta: 12, finding_delta: 6, endpoint_delta: 5, database_delta: 0 }
      ],
      new_dependencies: [
        { source: "platform-service", target: "order-service", type: "api_call" },
        { source: "order-service", target: "platform-service", type: "api_call" }
      ],
      removed_dependencies: [],
      new_cycles: [{ services: ["platform-service", "order-service"], length: 2 }],
      removed_cycles: [],
      recommendations: [
        "Prioritize newly introduced dependency cycles before further feature work.",
        "Review new cross-service dependencies and confirm they preserve deployment independence."
      ]
    }
  ]
} as const;
