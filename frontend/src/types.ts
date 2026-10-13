export type FindingRecommendation = {
  root_cause: string;
  architectural_consequence: string;
  affected_services: string[];
  affected_files: string[];
  refactoring_steps: string[];
  expected_impact: string;
  priority: string;
  estimated_difficulty: string;
  evidence: Array<Record<string, unknown>>;
  source: string;
};

export type EvidenceChainItem = {
  step: string;
  description: string;
  source?: {
    file_path: string;
    line_number?: number | null;
  } | null;
  data: Record<string, unknown>;
};

export type Finding = {
  id: string;
  type: string;
  severity: string;
  confidence: number;
  services: string[];
  description: string;
  evidence: Array<Record<string, unknown>>;
  recommendation: string;
  recommendations?: FindingRecommendation[];
  detector_name?: string;
  rule_id?: string;
  evidence_chain?: EvidenceChainItem[];
  confidence_reason?: string;
  limitations?: string[];
  source_files?: string[];
  related_services?: string[];
  why_valid?: string;
};

export type GraphNode = {
  id: string;
  type?: string;
  label?: string;
  serviceName?: string;
  risk?: string;
  findingCount?: number;
  healthScore?: number;
  language?: string;
  properties?: Record<string, unknown>;
};

export type GraphEdge = {
  source: string;
  target: string;
  type?: string;
  label?: string;
  risk?: string;
  findingCount?: number;
  evidence?: Record<string, unknown>;
  source_location?: unknown;
};

export type DigitalTwinGraph = {
  nodes: Array<{
    element_id: string;
    labels: string[];
    properties: Record<string, unknown>;
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    properties: Record<string, unknown>;
  }>;
};

export type DisplayGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  source: "digital-twin" | "scan-report";
};

export type GraphSelection = {
  kind: "node" | "edge";
  id: string;
  title: string;
  subtitle: string;
  properties: Record<string, unknown>;
  findings: Finding[];
  healthScore?: HealthScore;
};

export type HealthScore = {
  scope: string;
  target: string;
  score: number;
  grade: string;
  breakdown: Record<string, number>;
  explanation: string;
  recommendations: string[];
};

export type AnalysisResult = {
  findings: Finding[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  summary: {
    service_count: number;
    finding_count: number;
    findings_by_severity?: Record<string, number>;
    findings_by_type?: Record<string, number>;
    health_scores?: {
      service: HealthScore[];
      domain: HealthScore[];
      system: HealthScore;
    };
  };
};

export type ServiceDiscoveryCandidate = {
  service_name: string;
  relative_path: string;
  absolute_path: string;
  language: string;
  confidence: number;
  selected_by_default: boolean;
  reasons: string[];
  manifests: string[];
  entrypoints: string[];
  signal_counts: Record<string, number>;
};

export type RepoScanPreview = {
  source: {
    source_type: string;
    source_label: string;
    source_path?: string | null;
    repo_url?: string | null;
    repo_provider?: string | null;
    repo_ref?: string | null;
    workspace_path?: string | null;
  };
  root_path: string;
  top_level_entries: string[];
  file_count: number;
  manifest_counts: Record<string, number>;
  candidate_service_paths: string[];
  discovered_services: ServiceDiscoveryCandidate[];
  warnings: string[];
};

export type ProjectRecord = {
  id: string;
  name: string;
  description?: string | null;
  root_path?: string | null;
  created_at?: string | null;
};

export type ProjectSetup = {
  source_type?: string | null;
  source_location?: string | null;
  source_ref?: string | null;
  selected_service_paths: string[];
  manual_service_paths: string[];
  chatty_threshold: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PolicyRecord = {
  id: string;
  project_id: string;
  name: string;
  rule: string;
  severity: string;
  description?: string | null;
  enabled: boolean;
};

export type ScanRecord = {
  id: string;
  project_id: string;
  status: string;
  service_count: number;
  finding_count: number;
  source_type?: string | null;
  source_label?: string | null;
  repo_url?: string | null;
  repo_provider?: string | null;
  repo_ref?: string | null;
  commit_sha?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
};

export type PersistedScanResult = {
  scan: ScanRecord;
  result: AnalysisResult;
};

export type ScanJobRecord = {
  id: string;
  project_id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  scan_id?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

export type BenchmarkListing = {
  id: string;
  benchmark: string;
  version: number;
  system_count: number;
  system_ids: string[];
};

export type BenchmarkMetrics = {
  precision?: number | null;
  recall?: number | null;
  f1_score?: number | null;
  helpfulness_score?: number | null;
  grounding_score?: number | null;
  coverage_score?: number | null;
  usefulness_score?: number | null;
  structured_coverage?: number | null;
  system_count?: number;
};

export type BenchmarkEvaluationReport = {
  benchmark: string;
  overall: BenchmarkMetrics;
  discovery: { overall: BenchmarkMetrics };
  explanations: { overall: BenchmarkMetrics };
  recommendations: { overall: BenchmarkMetrics };
  evaluation_notes: {
    systems_with_notes: Array<{ id: string; notes: string[]; limitations: string[] }>;
  };
};

export type AiBaselineRunMetrics = {
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  precision: number;
  recall: number;
  f1_score: number;
};

export type AiBaselineFindingLabel = { type: string; services: string[] };

export type AiBaselineRun = {
  metrics: AiBaselineRunMetrics;
  false_positives: AiBaselineFindingLabel[];
  false_negatives: AiBaselineFindingLabel[];
};

export type AiBaselineStat = { mean: number; stdev: number };

export type AiBaselineDeterminism = {
  exact_match_rate: number;
  mean_pairwise_jaccard: number;
  distinct_result_sets: number;
  run_count: number;
};

export type AiBaselineSystemReport = {
  benchmark: string;
  id: string;
  name: string;
  model?: string | null;
  runs: AiBaselineRun[];
  precision: AiBaselineStat;
  recall: AiBaselineStat;
  f1_score: AiBaselineStat;
  determinism: AiBaselineDeterminism;
};

export type AiBaselineComparisonReport = {
  benchmark: string;
  runs_per_system: number;
  provider: string;
  model?: string | null;
  model_note?: string;
  results_dir?: string;
  systems: AiBaselineSystemReport[];
};

export type AiBaselineComparisonsResponse = { reports: AiBaselineComparisonReport[] };

export type EvolutionReport = {
  project_id: string;
  base_scan_id: string;
  target_scan_id: string;
  architecture_change_summary: Record<string, unknown>;
  risk_trend: {
    previous_total?: number;
    current_total?: number;
    delta?: number;
    new_risk_count?: number;
    resolved_risk_count?: number;
    worsened_risk_count?: number;
    new_risks?: Array<Record<string, unknown>>;
    resolved_risks?: Array<Record<string, unknown>>;
    worsened_risks?: Array<Record<string, unknown>>;
  };
  score_trend: {
    system_previous?: number | null;
    system_current?: number | null;
    system_delta?: number | null;
    improved_services?: Array<Record<string, unknown>>;
    worsened_services?: Array<Record<string, unknown>>;
  };
  service_level_changes: Array<Record<string, unknown>>;
  new_dependencies: Array<Record<string, unknown>>;
  removed_dependencies: Array<Record<string, unknown>>;
  new_cycles: Array<Record<string, unknown>>;
  removed_cycles: Array<Record<string, unknown>>;
  recommendations: string[];
};

export type ResearchEvaluationDraft = {
  project_id: string;
  scan_id: string;
  repo_name: string;
  repo_url?: string | null;
  commit_ref?: string | null;
  scan_date?: string | null;
  project_type?: string | null;
  expected_services?: number | null;
  detected_services: number;
  expected_patterns?: string | null;
  detected_patterns?: string | null;
  total_findings: number;
  critical_findings: number;
  high_findings: number;
  medium_findings: number;
  low_findings: number;
  true_positives?: number | null;
  false_positives?: number | null;
  false_negatives?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1_score?: number | null;
  notes?: string | null;
  limitations?: string | null;
  research_relevance?: string | null;
  suitable_for_report: boolean;
  accuracy_mode: "GROUND_TRUTH" | "MANUAL_VALIDATION_REQUIRED";
  matched_benchmark_id?: string | null;
  matched_benchmark_name?: string | null;
};

export type RoadmapBucket = "quick_win" | "medium_term" | "high_effort";

export type RefactoringPlaybookPhase = {
  title: string;
  objective: string;
  steps: string[];
  verification_checks: string[];
};

export type RefactoringPlaybook = {
  problem_summary: string;
  impact: string;
  recommended_strategy: string;
  phases: RefactoringPlaybookPhase[];
  verification_checks: string[];
  rollback_plan: string[];
  risks: string[];
  estimated_effort: string;
  related_services: string[];
  related_findings: string[];
  source: string;
};

export type RoadmapAction = {
  id: string;
  title: string;
  bucket: RoadmapBucket;
  priority_rank: number;
  priority_score: number;
  summary: string;
  rationale: string;
  expected_benefit: string;
  suggested_order_reason: string;
  estimated_difficulty: string;
  affected_services: string[];
  related_findings: string[];
  related_finding_types: string[];
  dependencies: string[];
  metrics: {
    finding_count?: number;
    max_severity?: string;
    average_confidence?: number;
    service_centrality?: number;
    max_linked_findings?: number;
    service_health_pressure?: number;
    impacted_dimensions?: string[];
  };
  playbook?: RefactoringPlaybook | null;
};

export type RoadmapDependency = {
  action_id: string;
  depends_on: string;
  reason: string;
};

export type RoadmapPlanStep = {
  order: number;
  action_id: string;
  title: string;
  bucket: RoadmapBucket;
  why_now: string;
};

export type RemediationRoadmap = {
  scan_id: string;
  generated_from_finding_count: number;
  system_health_score?: number | null;
  summary: string;
  quick_wins: RoadmapAction[];
  medium_term_changes: RoadmapAction[];
  high_effort_refactors: RoadmapAction[];
  suggested_order: RoadmapPlanStep[];
  dependencies: RoadmapDependency[];
};

export type AggregatedEdge = GraphEdge & {
  id: string;
  count: number;
  label: string;
};

export type Filters = {
  type: string;
  severity: string;
  service: string;
  minConfidence: number;
};

export type WorkflowStep = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  active: boolean;
  optional?: boolean;
};

export type InterpretationMode = "beginner" | "research";
export type AppSection =
  | "overview"
  | "scan"
  | "findings"
  | "graph"
  | "history"
  | "evolution"
  | "roadmap"
  | "ai"
  | "evaluation"
  | "benchmarks"
  | "ai-baseline"
  | "docs";
export type ApiAvailability = "checking" | "online" | "offline";
export type ProjectListStatus = "idle" | "loading" | "ready" | "error";
export type AIExplainerIntent =
  | "AUTO"
  | "SCAN_SUMMARY"
  | "FINDING_EXPLANATION"
  | "PRIORITIZE_FIXES"
  | "HEALTH_SCORE_EXPLANATION"
  | "COMPARE_SCANS"
  | "GOVERNANCE_POLICY_HELP"
  | "POLICY_WRITING_ASSISTANCE"
  | "DOC_QA";

export type AIExplainerEvidence = {
  kind: string;
  label: string;
  pointer: string;
  snippet: string;
};

export type AIExplainerResponse = {
  intent: AIExplainerIntent;
  title: string;
  answer: string;
  evidence: AIExplainerEvidence[];
  suggestions: string[];
  follow_up_questions: string[];
  limitations: string[];
  policy_document?: string | null;
  confidence: "LOW" | "MODERATE" | "HIGH";
  grounded: boolean;
  source: string;
};

export type AIExplainerStatus = {
  mode: string;
  state:
    | "GROUNDED_ONLY"
    | "MISSING_API_KEY"
    | "PLACEHOLDER_API_KEY"
    | "INVALID_API_KEY"
    | "MODEL_UNAVAILABLE"
    | "ACCESS_DENIED"
    | "CONNECTION_ERROR"
    | "READY";
  live_enabled: boolean;
  api_key_configured: boolean;
  api_key_hint?: string | null;
  model: string;
  base_url: string;
  message: string;
};

export type ResearchEvaluationRecord = {
  id: string;
  scan_id?: string | null;
  repo_name: string;
  repo_url?: string | null;
  commit_ref?: string | null;
  scan_date?: string | null;
  project_type?: string | null;
  expected_services?: number | null;
  detected_services: number;
  expected_patterns?: string | null;
  detected_patterns?: string | null;
  total_findings: number;
  critical_findings: number;
  high_findings: number;
  medium_findings: number;
  low_findings: number;
  true_positives?: number | null;
  false_positives?: number | null;
  false_negatives?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1_score?: number | null;
  notes?: string | null;
  limitations?: string | null;
  research_relevance?: string | null;
  suitable_for_report: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};
