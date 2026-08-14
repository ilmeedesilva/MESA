import React from "react";
import ReactDOM from "react-dom/client";
import cytoscape from "cytoscape";
import { docBySlug, docNeighbors, docsByQuery, docsCatalog, docsCategories, type DocPage } from "./docsPortal";
import { demoWorkspace } from "./demoData";
import "./styles.css";

type FindingRecommendation = {
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

type EvidenceChainItem = {
  step: string;
  description: string;
  source?: {
    file_path: string;
    line_number?: number | null;
  } | null;
  data: Record<string, unknown>;
};

type Finding = {
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

type GraphNode = {
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

type GraphEdge = {
  source: string;
  target: string;
  type?: string;
  label?: string;
  risk?: string;
  findingCount?: number;
  evidence?: Record<string, unknown>;
  source_location?: unknown;
};

type DigitalTwinGraph = {
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

type DisplayGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  source: "digital-twin" | "scan-report";
};

type GraphSelection = {
  kind: "node" | "edge";
  id: string;
  title: string;
  subtitle: string;
  properties: Record<string, unknown>;
  findings: Finding[];
  healthScore?: HealthScore;
};

type HealthScore = {
  scope: string;
  target: string;
  score: number;
  grade: string;
  breakdown: Record<string, number>;
  explanation: string;
  recommendations: string[];
};

type AnalysisResult = {
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

type ServiceDiscoveryCandidate = {
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

type RepoScanPreview = {
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

type ProjectRecord = {
  id: string;
  name: string;
  description?: string | null;
  root_path?: string | null;
  created_at?: string | null;
};

type ProjectSetup = {
  source_type?: string | null;
  source_location?: string | null;
  source_ref?: string | null;
  selected_service_paths: string[];
  manual_service_paths: string[];
  chatty_threshold: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type PolicyRecord = {
  id: string;
  project_id: string;
  name: string;
  rule: string;
  severity: string;
  description?: string | null;
  enabled: boolean;
};

type ScanRecord = {
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

type PersistedScanResult = {
  scan: ScanRecord;
  result: AnalysisResult;
};

type EvolutionReport = {
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

type ResearchEvaluationDraft = {
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

type RoadmapBucket = "quick_win" | "medium_term" | "high_effort";

type RefactoringPlaybookPhase = {
  title: string;
  objective: string;
  steps: string[];
  verification_checks: string[];
};

type RefactoringPlaybook = {
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

type RoadmapAction = {
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

type RoadmapDependency = {
  action_id: string;
  depends_on: string;
  reason: string;
};

type RoadmapPlanStep = {
  order: number;
  action_id: string;
  title: string;
  bucket: RoadmapBucket;
  why_now: string;
};

type RemediationRoadmap = {
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

type AggregatedEdge = GraphEdge & {
  id: string;
  count: number;
  label: string;
};

type Filters = {
  type: string;
  severity: string;
  service: string;
  minConfidence: number;
};

type WorkflowStep = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  active: boolean;
  optional?: boolean;
};

type InterpretationMode = "beginner" | "research";
type AppSection =
  | "overview"
  | "scan"
  | "services"
  | "findings"
  | "graph"
  | "history"
  | "evolution"
  | "roadmap"
  | "ai"
  | "evaluation"
  | "policies"
  | "docs";
type ApiAvailability = "checking" | "online" | "offline";
type ProjectListStatus = "idle" | "loading" | "ready" | "error";
type AIExplainerIntent =
  | "AUTO"
  | "SCAN_SUMMARY"
  | "FINDING_EXPLANATION"
  | "PRIORITIZE_FIXES"
  | "HEALTH_SCORE_EXPLANATION"
  | "COMPARE_SCANS"
  | "GOVERNANCE_POLICY_HELP"
  | "POLICY_WRITING_ASSISTANCE"
  | "DOC_QA";

type AIExplainerEvidence = {
  kind: string;
  label: string;
  pointer: string;
  snippet: string;
};

type AIExplainerResponse = {
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

type AIExplainerStatus = {
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

type ResearchEvaluationRecord = {
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

const defaultPaths = [
  "/workspace/tests/fixtures/god/platform-service",
  "/workspace/tests/fixtures/god/order-service",
  "/workspace/tests/fixtures/god/billing-service",
  "/workspace/tests/fixtures/god/inventory-service",
  "/workspace/tests/fixtures/god/user-service",
  "/workspace/tests/fixtures/god/payment-service",
  "/workspace/tests/fixtures/god/notification-service"
].join("\n");

const defaultPolicyDocument = `policies:
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
`;

const severityRank: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

const appNavigation = [
  {
    group: "Project",
    items: [
      { id: "overview", label: "Overview", description: "Project summary and quick actions" }
    ]
  },
  {
    group: "Analysis",
    items: [
      { id: "scan", label: "Scan", description: "Configure sources and run scans" },
      { id: "services", label: "Services", description: "Review discovered and selected services" },
      { id: "findings", label: "Findings", description: "Inspect findings and filters" },
      { id: "graph", label: "Graph", description: "Explore architecture and health" },
      { id: "ai", label: "AI Explainer", description: "Ask grounded questions about the scan" }
    ]
  },
  {
    group: "Results",
    items: [
      { id: "history", label: "Scan History", description: "Review previous scans" },
      { id: "evolution", label: "Evolution", description: "Compare architecture changes" },
      { id: "roadmap", label: "Roadmap", description: "Recommended remediation order" }
    ]
  },
  {
    group: "Research",
    items: [
      { id: "evaluation", label: "Evaluation", description: "Research evidence and validation" }
    ]
  },
  {
    group: "Configuration",
    items: [
      { id: "policies", label: "Policies", description: "Governance rules and policy YAML" }
    ]
  },
  {
    group: "Reference",
    items: [
      { id: "docs", label: "Documentation", description: "Guides and methodology" }
    ]
  }
] as const satisfies ReadonlyArray<{
  group: string;
  items: ReadonlyArray<{ id: AppSection; label: string; description: string }>;
}>;

const sectionsRequiringProject = new Set<AppSection>([
  "overview",
  "scan",
  "services",
  "findings",
  "graph",
  "history",
  "evolution",
  "roadmap",
  "ai",
  "evaluation",
  "policies"
]);

function App() {
  const [projects, setProjects] = React.useState<ProjectRecord[]>([]);
  const [projectListStatus, setProjectListStatus] = React.useState<ProjectListStatus>("idle");
  const [projectListError, setProjectListError] = React.useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = React.useState("");
  const [projectName, setProjectName] = React.useState("MESA Demo Project");
  const [projectDescription, setProjectDescription] = React.useState("Static architecture analysis demo");
  const [showCreateProjectForm, setShowCreateProjectForm] = React.useState(false);
  const [paths, setPaths] = React.useState(defaultPaths);
  const [sourceType, setSourceType] = React.useState("LOCAL_PATH");
  const [sourceLocation, setSourceLocation] = React.useState("");
  const [sourceRef, setSourceRef] = React.useState("main");
  const [repoPreview, setRepoPreview] = React.useState<RepoScanPreview | null>(null);
  const [selectedDiscoveryPaths, setSelectedDiscoveryPaths] = React.useState<string[]>([]);
  const [history, setHistory] = React.useState<ScanRecord[]>([]);
  const [evolution, setEvolution] = React.useState<EvolutionReport[]>([]);
  const [roadmap, setRoadmap] = React.useState<RemediationRoadmap | null>(null);
  const [researchRecords, setResearchRecords] = React.useState<ResearchEvaluationRecord[]>([]);
  const [selectedResearchRecordId, setSelectedResearchRecordId] = React.useState("");
  const [policyText, setPolicyText] = React.useState(defaultPolicyDocument);
  const [policyCount, setPolicyCount] = React.useState(0);
  const [activeScan, setActiveScan] = React.useState<ScanRecord | null>(null);
  const [result, setResult] = React.useState<AnalysisResult | null>(null);
  const [displayGraph, setDisplayGraph] = React.useState<DisplayGraph | null>(null);
  const [scores, setScores] = React.useState<HealthScore[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isPreviewingRepo, setIsPreviewingRepo] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const [isLoadingScan, setIsLoadingScan] = React.useState(false);
  const [isLoadingRoadmap, setIsLoadingRoadmap] = React.useState(false);
  const [isLoadingResearchRecords, setIsLoadingResearchRecords] = React.useState(false);
  const [isSavingPolicies, setIsSavingPolicies] = React.useState(false);
  const [isSavingResearchRecord, setIsSavingResearchRecord] = React.useState(false);
  const [isExportingResearchRecords, setIsExportingResearchRecords] = React.useState(false);
  const [selectedFinding, setSelectedFinding] = React.useState<Finding | null>(null);
  const [selectedGraphElement, setSelectedGraphElement] = React.useState<GraphSelection | null>(null);
  const [interpretationMode, setInterpretationMode] = React.useState<InterpretationMode>("beginner");
  const [showSetupWorkspace, setShowSetupWorkspace] = React.useState(true);
  const [hasAutoCollapsedSetup, setHasAutoCollapsedSetup] = React.useState(false);
  const [activeSetupStepId, setActiveSetupStepId] = React.useState<WorkflowStep["id"]>("project");
  const [currentSection, setCurrentSection] = React.useState<AppSection>(readSectionFromUrl());
  const [apiAvailability, setApiAvailability] = React.useState<ApiAvailability>("checking");
  const [isPublicDemoMode, setIsPublicDemoMode] = React.useState(false);
  const [isLoadingProjectState, setIsLoadingProjectState] = React.useState(false);
  const [aiQuestion, setAiQuestion] = React.useState("");
  const [aiResponse, setAiResponse] = React.useState<AIExplainerResponse | null>(null);
  const [isExplaining, setIsExplaining] = React.useState(false);
  const [streamingAnswer, setStreamingAnswer] = React.useState("");
  const [aiStatus, setAiStatus] = React.useState<AIExplainerStatus | null>(null);
  const [isCheckingAIStatus, setIsCheckingAIStatus] = React.useState(false);
  const [selectedDocSlug, setSelectedDocSlug] = React.useState("evaluator-quick-start");
  const [docsQuery, setDocsQuery] = React.useState("");
  const [docsCategory, setDocsCategory] = React.useState("ALL");
  const [filters, setFilters] = React.useState<Filters>({
    type: "ALL",
    severity: "ALL",
    service: "ALL",
    minConfidence: 0
  });
  const graphRef = React.useRef<HTMLDivElement | null>(null);
  const initialProjectIdRef = React.useRef(readProjectIdFromUrl());
  const projectListRequestRef = React.useRef(0);
  const projectStateRequestRef = React.useRef(0);
  const scanRequestRef = React.useRef(0);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const projectStateAbortRef = React.useRef<AbortController | null>(null);
  const scanAbortRef = React.useRef<AbortController | null>(null);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const manualServicePaths = React.useMemo(() => servicePathsFromText(paths), [paths]);

  React.useEffect(() => {
    const handlePopState = () => {
      if (isPublicDemoMode && apiAvailability !== "online") return;
      setSelectedProjectId(readProjectIdFromUrl());
      setCurrentSection(readSectionFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [apiAvailability, isPublicDemoMode]);

  React.useEffect(() => {
    if (!selectedProjectId) {
      syncAppStateToUrl("", currentSection, "replace");
      cancelProjectRequests();
      resetProjectScanFlowState();
      setHistory([]);
      setEvolution([]);
      setPolicyCount(0);
      setPolicyText(defaultPolicyDocument);
      setActiveScan(null);
      setResult(null);
      setRoadmap(null);
      setDisplayGraph(null);
      setScores([]);
      return;
    }
    if (isPublicDemoMode && isPublicDemoProject(selectedProjectId)) {
      syncAppStateToUrl(selectedProjectId, currentSection, "replace");
      setHistory(demoWorkspace.scans as unknown as ScanRecord[]);
      setEvolution(demoWorkspace.evolution as unknown as EvolutionReport[]);
      setPolicyCount(demoWorkspace.policies.length);
      setPolicyText(demoWorkspace.policyText);
      if (!activeScan) {
        void loadScan(demoWorkspace.scans[0].id);
      }
      return;
    }
    syncAppStateToUrl(selectedProjectId, currentSection, "replace");
    void loadSelectedProjectState(selectedProjectId);
  }, [apiAvailability, currentSection, isPublicDemoMode, selectedProjectId]);

  React.useEffect(() => {
    void loadAIStatus();
    void loadResearchRecords();
  }, []);

  React.useEffect(() => {
    void probeApiAvailability();
  }, []);

  React.useEffect(() => {
    if (apiAvailability !== "online" || isPublicDemoMode) return;
    void loadProjects();
  }, [apiAvailability, isPublicDemoMode]);

  React.useEffect(() => {
    if (currentSection === "evaluation") void loadResearchRecords();
  }, [currentSection]);

  React.useEffect(() => {
    const handleResize = () => setSidebarCollapsed(window.innerWidth < 1100);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const aggregatedEdges = React.useMemo(
    () => (displayGraph ? aggregateEdges(displayGraph.edges) : []),
    [displayGraph]
  );

  const filteredFindings = React.useMemo(
    () => filterFindings(result?.findings ?? [], filters),
    [filters, result]
  );

  const filterOptions = React.useMemo(() => buildFilterOptions(result?.findings ?? []), [result]);

  React.useEffect(() => {
    if (!displayGraph || !graphRef.current) return;

    const elements = buildGraphElements(displayGraph.nodes, aggregatedEdges);
    const cy = cytoscape({
      container: graphRef.current,
      elements,
      style: graphStyle,
      layout: { name: "preset", animate: false, fit: true, padding: 48 },
      minZoom: 0.45,
      maxZoom: 1.35,
      wheelSensitivity: 0.2
    });

    cy.ready(() => {
      cy.fit(undefined, 54);
      cy.center();
    });
    cy.on("tap", "node", (event) => {
      setSelectedGraphElement(selectionForNode(event.target.data(), result?.findings ?? [], scores));
    });
    cy.on("tap", "edge", (event) => {
      setSelectedGraphElement(selectionForEdge(event.target.data(), displayGraph.nodes, result?.findings ?? []));
    });
    return () => cy.destroy();
  }, [aggregatedEdges, displayGraph, result, scores]);

  function cancelProjectRequests() {
    projectStateAbortRef.current?.abort();
    scanAbortRef.current?.abort();
  }

  function resetProjectScanFlowState() {
    setSourceType("LOCAL_PATH");
    setSourceLocation("");
    setSourceRef("main");
    setRepoPreview(null);
    setSelectedDiscoveryPaths([]);
    setPaths(defaultPaths);
    setHistory([]);
    setEvolution([]);
    setRoadmap(null);
    setPolicyCount(0);
    setPolicyText(defaultPolicyDocument);
    setActiveScan(null);
    setResult(null);
    setDisplayGraph(null);
    setScores([]);
    setSelectedFinding(null);
    setSelectedGraphElement(null);
    setAiQuestion("");
    setAiResponse(null);
    setStreamingAnswer("");
    setError(null);
    setShowSetupWorkspace(true);
    setHasAutoCollapsedSetup(false);
    setActiveSetupStepId("project");
    setShowCreateProjectForm(false);
  }

  function updateSelectedProject(projectId: string, historyMode: "push" | "replace" = "push") {
    setSelectedProjectId(projectId);
    setShowCreateProjectForm(false);
    setShowSetupWorkspace(true);
    syncAppStateToUrl(projectId, currentSection, historyMode);
  }

  async function loadProjects(options?: {
    preferredProjectId?: string;
    preserveCurrentSelection?: boolean;
    historyMode?: "push" | "replace";
  }) {
    const requestId = projectListRequestRef.current + 1;
    projectListRequestRef.current = requestId;
    setProjectListStatus("loading");
    setProjectListError(null);
    try {
      const nextProjects = await api<ProjectRecord[]>("/api/projects");
      if (requestId !== projectListRequestRef.current) return;
      setProjects(nextProjects);
      setProjectListStatus("ready");
      const preferredProjectId = options?.preferredProjectId ?? initialProjectIdRef.current;
      const keepCurrentSelection = options?.preserveCurrentSelection !== false ? selectedProjectId : "";
      const resolvedProjectId = resolveProjectSelection(nextProjects, keepCurrentSelection, preferredProjectId);
      initialProjectIdRef.current = "";
      if (resolvedProjectId !== selectedProjectId) {
        updateSelectedProject(resolvedProjectId, options?.historyMode ?? "replace");
      } else if (!resolvedProjectId) {
        syncAppStateToUrl("", currentSection, options?.historyMode ?? "replace");
      }
    } catch (caught) {
      if (requestId !== projectListRequestRef.current || isAbortError(caught)) return;
      setProjectListStatus("error");
      if (caught instanceof ApiError && caught.status === 405) {
        setProjectListError(
          "The frontend is newer than the running API. Rebuild/restart the API service so `GET /projects` is available."
        );
      } else {
        setProjectListError(messageFor(caught, "Could not load projects"));
      }
      setProjects([]);
      updateSelectedProject("", "replace");
    }
  }

  async function recoverFromUnavailableProject(projectId: string) {
    if (selectedProjectId !== projectId) return;
    setError("The selected project is no longer available. MESA switched to another available project.");
    await loadProjects({ preserveCurrentSelection: false, historyMode: "replace" });
  }

  async function fetchProjectBundle(projectId: string, signal: AbortSignal) {
    const [scans, policies, evolutionReports, setup] = await Promise.all([
      api<ScanRecord[]>(`/api/projects/${projectId}/scans`, { signal }),
      api<PolicyRecord[]>(`/api/projects/${projectId}/policies`, { signal }),
      api<EvolutionReport[]>(`/api/projects/${projectId}/evolution`, { signal }),
      api<ProjectSetup | null>(`/api/projects/${projectId}/setup`, { signal })
    ]);
    return { scans, policies, evolutionReports, setup };
  }

  function applyProjectSetup(setup: ProjectSetup | null) {
    if (!setup) {
      setSourceType("LOCAL_PATH");
      setSourceLocation("");
      setSourceRef("main");
      setRepoPreview(null);
      setSelectedDiscoveryPaths([]);
      setPaths(defaultPaths);
      setActiveSetupStepId("source");
      return;
    }

    const resolvedSourceType = setup.source_type ?? "LOCAL_PATH";
    const resolvedSourceLocation = setup.source_location ?? "";
    const selectedServices = setup.selected_service_paths ?? [];
    const manualServices = setup.manual_service_paths ?? [];

    setSourceType(resolvedSourceType);
    setSourceLocation(resolvedSourceLocation);
    setSourceRef(setup.source_ref ?? "main");
    setSelectedDiscoveryPaths(selectedServices);
    setPaths((manualServices.length > 0 ? manualServices : selectedServices).join("\n"));
    setRepoPreview(null);
    setActiveSetupStepId(
      selectedServices.length > 0 || manualServices.length > 0
        ? "review"
        : resolvedSourceLocation
          ? "source"
          : "project"
    );
  }

  async function loadSelectedProjectState(projectId: string) {
    if (!projectId) return;
    const requestId = projectStateRequestRef.current + 1;
    projectStateRequestRef.current = requestId;
    projectStateAbortRef.current?.abort();
    scanAbortRef.current?.abort();
    const controller = new AbortController();
    projectStateAbortRef.current = controller;

    resetProjectScanFlowState();
    setIsLoadingProjectState(true);

    try {
      const { scans, policies, evolutionReports, setup } = await fetchProjectBundle(projectId, controller.signal);
      if (requestId !== projectStateRequestRef.current || selectedProjectId !== projectId) return;
      applyProjectSetup(setup);
      setHistory(scans);
      setEvolution(evolutionReports);
      setPolicyCount(policies.length);
      setPolicyText(policies.length > 0 ? policyDocumentFromRecords(policies) : defaultPolicyDocument);

      if (setup?.source_type && setup.source_location) {
        void restoreRepositoryPreview(setup, projectId, requestId);
      }

      if (scans.length > 0) {
        await loadScan(scans[0].id, { projectId, historyMode: "replace" });
      }
    } catch (caught) {
      if (requestId !== projectStateRequestRef.current || isAbortError(caught)) return;
      if (isNotFoundError(caught)) {
        await recoverFromUnavailableProject(projectId);
        return;
      }
      setError(messageFor(caught, "Could not load the selected project"));
    } finally {
      if (requestId === projectStateRequestRef.current) {
        setIsLoadingProjectState(false);
      }
    }
  }

  async function refreshCurrentProjectCollections(projectId: string) {
    if (!projectId || isPublicDemoProject(projectId)) return;
    const controller = new AbortController();
    try {
      const { scans, policies, evolutionReports, setup } = await fetchProjectBundle(projectId, controller.signal);
      if (selectedProjectId !== projectId) return;
      applyProjectSetup(setup);
      setHistory(scans);
      setEvolution(evolutionReports);
      setPolicyCount(policies.length);
      setPolicyText(policies.length > 0 ? policyDocumentFromRecords(policies) : defaultPolicyDocument);
    } catch (caught) {
      if (isAbortError(caught)) return;
      if (isNotFoundError(caught)) {
        await recoverFromUnavailableProject(projectId);
      }
    }
  }

  async function restoreRepositoryPreview(setup: ProjectSetup, projectId: string, requestId: number) {
    if (!setup.source_type || !setup.source_location) return;
    try {
      const preview = await api<RepoScanPreview>("/api/repo-scans/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: setup.source_type,
          location: setup.source_location,
          ref: setup.source_type === "GITHUB_URL" ? setup.source_ref || undefined : undefined
        })
      });
      if (requestId !== projectStateRequestRef.current || selectedProjectId !== projectId) return;
      setRepoPreview(preview);
      setSelectedDiscoveryPaths(
        setup.selected_service_paths.length > 0
          ? setup.selected_service_paths
          : preview.discovered_services
              .filter((candidate) => candidate.selected_by_default)
              .map((candidate) => candidate.relative_path)
      );
    } catch {
      if (requestId !== projectStateRequestRef.current || selectedProjectId !== projectId) return;
      setRepoPreview(null);
    }
  }

  async function createProject() {
    setIsPublicDemoMode(false);
    setError(null);
    setIsCreating(true);
    try {
      const project = await api<ProjectRecord>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName, description: projectDescription })
      });
      setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
      setProjectListStatus("ready");
      setProjectListError(null);
      resetProjectScanFlowState();
      updateSelectedProject(project.id, "push");
    } catch (caught) {
      setError(messageFor(caught, "Project creation failed"));
    } finally {
      setIsCreating(false);
    }
  }

  async function runScan() {
    if (isPublicDemoMode && apiAvailability !== "online") {
      setError("Public demo mode is using embedded example results. Start the full backend stack to run live scans.");
      return;
    }
    if (!selectedProject) {
      setError("Create or select a project before running a scan.");
      return;
    }
    if (sourceLocation.trim() && selectedDiscoveryPaths.length === 0 && repoPreview?.discovered_services?.length) {
      setError("Select at least one discovered service before running a repository-backed scan.");
      return;
    }
    if (!sourceLocation.trim() && manualServicePaths.length === 0) {
      setError("Enter manual service paths or choose a repository source before running a scan.");
      return;
    }
    setError(null);
    setIsScanning(true);
    try {
      const useRepositorySource = Boolean(sourceLocation.trim());
      const payload = useRepositorySource
        ? await api<PersistedScanResult>(`/api/projects/${selectedProjectId}/repo-scans`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source_type: sourceType,
              location: sourceLocation,
              ref: sourceType === "GITHUB_URL" ? sourceRef.trim() || undefined : undefined,
              service_paths: selectedDiscoveryPaths
            })
          })
        : await api<PersistedScanResult>(`/api/projects/${selectedProjectId}/scans`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ service_paths: servicePathsFromText(paths) })
          });
      setActiveScan(payload.scan);
      setResult(payload.result);
      const nextScores = flattenScores(payload.result.summary.health_scores);
      setScores(nextScores);
      setDisplayGraph(graphFromReport(payload.result, nextScores));
      setSelectedFinding(null);
      setSelectedGraphElement(null);
      setAiResponse(null);
      setStreamingAnswer("");
      await loadDigitalTwinGraph(payload.scan.id, payload.result, nextScores);
      await loadRoadmap(payload.scan.id);
      await refreshCurrentProjectCollections(selectedProjectId);
      await loadResearchRecords();
    } catch (caught) {
      setError(messageFor(caught, "Scan failed"));
    } finally {
      setIsScanning(false);
    }
  }

  async function previewRepositorySource() {
    if (isPublicDemoMode && apiAvailability !== "online") {
      setError("Repository preview needs the live backend. Public demo mode only includes embedded example scans.");
      return;
    }
    if (!sourceLocation.trim()) {
      setError("Enter a repository source before requesting discovery preview.");
      return;
    }
    setError(null);
    setIsPreviewingRepo(true);
    try {
      const preview = await api<RepoScanPreview>("/api/repo-scans/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: sourceType,
          location: sourceLocation,
          ref: sourceType === "GITHUB_URL" ? sourceRef.trim() || undefined : undefined
        })
      });
      setRepoPreview(preview);
      const selectedPaths = (
        preview.discovered_services
          .filter((candidate) => candidate.selected_by_default)
          .map((candidate) => candidate.relative_path)
      );
      setSelectedDiscoveryPaths(selectedPaths);
    } catch (caught) {
      setRepoPreview(null);
      setSelectedDiscoveryPaths([]);
      setError(messageFor(caught, "Repository preview failed"));
    } finally {
      setIsPreviewingRepo(false);
    }
  }

  function toggleDiscoveredService(relativePath: string) {
    setSelectedDiscoveryPaths((current) =>
      current.includes(relativePath)
        ? current.filter((path) => path !== relativePath)
        : [...current, relativePath]
    );
  }

  function applyDiscoveredServices() {
    if (selectedDiscoveryPaths.length === 0) {
      setError("Select at least one discovered service before applying the review set.");
      return;
    }
    setPaths(selectedDiscoveryPaths.join("\n"));
    setError(null);
  }

  async function loadHistory(projectId: string, preferredScanId?: string) {
    if (isPublicDemoProject(projectId)) {
      setHistory(demoWorkspace.scans as unknown as ScanRecord[]);
      setEvolution(demoWorkspace.evolution as unknown as EvolutionReport[]);
      if (preferredScanId) return;
      if (!activeScan && demoWorkspace.scans.length > 0) {
        await loadScan(demoWorkspace.scans[0].id);
      }
      return;
    }
    setError(null);
    try {
      const scans = await api<ScanRecord[]>(`/api/projects/${projectId}/scans`);
      setHistory(scans);
      await loadEvolution(projectId);
      if (preferredScanId) return;
      if (!activeScan && scans.length > 0) {
        await loadScan(scans[0].id);
      }
    } catch (caught) {
      setHistory([]);
      setEvolution([]);
      setError(messageFor(caught, "Could not load scan history"));
    }
  }

  async function loadEvolution(projectId: string) {
    if (isPublicDemoProject(projectId)) {
      setEvolution(demoWorkspace.evolution as unknown as EvolutionReport[]);
      return;
    }
    try {
      setEvolution(await api<EvolutionReport[]>(`/api/projects/${projectId}/evolution`));
    } catch {
      setEvolution([]);
    }
  }

  async function loadPolicies(projectId: string) {
    if (isPublicDemoProject(projectId)) {
      setPolicyCount(demoWorkspace.policies.length);
      setPolicyText(demoWorkspace.policyText);
      return;
    }
    try {
      const policies = await api<PolicyRecord[]>(`/api/projects/${projectId}/policies`);
      setPolicyCount(policies.length);
      if (policies.length > 0) setPolicyText(policyDocumentFromRecords(policies));
    } catch {
      setPolicyCount(0);
    }
  }

  async function savePolicies() {
    if (isPublicDemoMode && apiAvailability !== "online") {
      setError("Policy saving is disabled in public demo mode because the backend is not connected.");
      return;
    }
    if (!selectedProject) {
      setError("Create or select a project before saving policies.");
      return;
    }
    setError(null);
    setIsSavingPolicies(true);
    try {
      const policies = await api<PolicyRecord[]>(`/api/projects/${selectedProjectId}/policies/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: policyText })
      });
      setPolicyCount(policies.length);
      setPolicyText(policyDocumentFromRecords(policies));
    } catch (caught) {
      setError(messageFor(caught, "Could not save policies"));
    } finally {
      setIsSavingPolicies(false);
    }
  }

  async function loadScan(
    scanId: string,
    options?: { projectId?: string; historyMode?: "push" | "replace"; signal?: AbortSignal }
  ) {
    if (isDemoScan(scanId)) {
      const payload = demoPersistedScan(scanId);
      const nextScores = flattenScores(payload.result.summary.health_scores);
      setActiveScan(payload.scan);
      setResult(payload.result);
      setScores(nextScores);
      setDisplayGraph(graphFromReport(payload.result, nextScores));
      setRoadmap(demoWorkspace.roadmaps[scanId as keyof typeof demoWorkspace.roadmaps] as unknown as RemediationRoadmap);
      setSelectedFinding(null);
      setSelectedGraphElement(null);
      setAiResponse(null);
      setStreamingAnswer("");
      return;
    }
    const requestId = scanRequestRef.current + 1;
    scanRequestRef.current = requestId;
    scanAbortRef.current?.abort();
    const controller = options?.signal ? null : new AbortController();
    scanAbortRef.current = controller;
    const signal = options?.signal ?? controller?.signal;
    setError(null);
    setIsLoadingScan(true);
    try {
      const payload = await api<PersistedScanResult>(`/api/scans/${scanId}`, signal ? { signal } : undefined);
      if (requestId !== scanRequestRef.current) return;
      if (options?.projectId && selectedProjectId !== options.projectId) return;
      setActiveScan(payload.scan);
      setResult(payload.result);
      let nextScores = flattenScores(payload.result.summary.health_scores);
      setScores(nextScores);
      setDisplayGraph(graphFromReport(payload.result, nextScores));
      setSelectedFinding(null);
      setSelectedGraphElement(null);
      setAiResponse(null);
      setStreamingAnswer("");
      try {
        nextScores = await api<HealthScore[]>(`/api/scans/${scanId}/scores`, signal ? { signal } : undefined);
        if (requestId !== scanRequestRef.current) return;
        setScores(nextScores);
      } catch {
        setScores(nextScores);
      }
      await loadRoadmap(scanId, requestId);
      await loadDigitalTwinGraph(scanId, payload.result, nextScores, requestId);
    } catch (caught) {
      if (isAbortError(caught)) return;
      if (options?.projectId && isNotFoundError(caught)) {
        await recoverFromUnavailableProject(options.projectId);
        return;
      }
      setError(messageFor(caught, "Could not load scan"));
    } finally {
      if (requestId === scanRequestRef.current) {
        setIsLoadingScan(false);
      }
    }
  }

  async function loadDigitalTwinGraph(
    scanId: string,
    scanResult: AnalysisResult,
    currentScores: HealthScore[],
    requestId?: number
  ) {
    if (isDemoScan(scanId)) {
      setDisplayGraph(graphFromReport(scanResult, currentScores));
      return;
    }
    try {
      const twin = await api<DigitalTwinGraph>(`/api/scans/${scanId}/graph`);
      if (requestId && requestId !== scanRequestRef.current) return;
      setDisplayGraph(graphFromDigitalTwin(twin, scanResult, currentScores));
    } catch {
      if (requestId && requestId !== scanRequestRef.current) return;
      setDisplayGraph(graphFromReport(scanResult, currentScores));
    }
  }

  async function loadRoadmap(scanId: string, requestId?: number) {
    if (isDemoScan(scanId)) {
      setRoadmap(demoWorkspace.roadmaps[scanId as keyof typeof demoWorkspace.roadmaps] as unknown as RemediationRoadmap);
      setIsLoadingRoadmap(false);
      return;
    }
    setIsLoadingRoadmap(true);
    try {
      const nextRoadmap = await api<RemediationRoadmap>(`/api/scans/${scanId}/roadmap`);
      if (requestId && requestId !== scanRequestRef.current) return;
      setRoadmap(nextRoadmap);
    } catch {
      if (requestId && requestId !== scanRequestRef.current) return;
      setRoadmap(null);
    } finally {
      if (!requestId || requestId === scanRequestRef.current) {
        setIsLoadingRoadmap(false);
      }
    }
  }

  async function loadResearchRecords() {
    if (usingEmbeddedDemo) {
      setResearchRecords([]);
      return;
    }
    setIsLoadingResearchRecords(true);
    try {
      const records = await api<ResearchEvaluationRecord[]>("/api/research-records");
      setResearchRecords(records);
      setSelectedResearchRecordId((current) => current || records[0]?.id || "");
    } catch (caught) {
      if (currentSection === "evaluation") setError(messageFor(caught, "Could not load research records"));
    } finally {
      setIsLoadingResearchRecords(false);
    }
  }

  async function createResearchRecordFromScan(scanId?: string) {
    const targetScanId = scanId ?? activeScan?.id;
    if (!targetScanId) {
      setError("Load or run a scan before creating a research evaluation record.");
      return;
    }
    if (usingEmbeddedDemo) {
      setError("Research records need the live backend. Public demo mode only includes embedded examples.");
      return;
    }
    setIsSavingResearchRecord(true);
    setError(null);
    try {
      const record = await api<ResearchEvaluationRecord>(`/api/research-records/from-scan/${targetScanId}`, {
        method: "POST"
      });
      setResearchRecords((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      setSelectedResearchRecordId(record.id);
      setCurrentSection("evaluation");
    } catch (caught) {
      setError(messageFor(caught, "Could not create research record from scan"));
    } finally {
      setIsSavingResearchRecord(false);
    }
  }

  async function updateResearchRecord(record: ResearchEvaluationRecord, patch: Partial<ResearchEvaluationRecord>) {
    setIsSavingResearchRecord(true);
    setError(null);
    try {
      const updated = await api<ResearchEvaluationRecord>(`/api/research-records/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeResearchRecordPayload({ ...record, ...patch }))
      });
      setResearchRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setError(messageFor(caught, "Could not update research record"));
    } finally {
      setIsSavingResearchRecord(false);
    }
  }

  async function deleteResearchRecord(recordId: string) {
    setIsSavingResearchRecord(true);
    setError(null);
    try {
      const response = await fetch(`/api/research-records/${recordId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      setResearchRecords((current) => current.filter((record) => record.id !== recordId));
      setSelectedResearchRecordId((current) => current === recordId ? "" : current);
    } catch (caught) {
      setError(messageFor(caught, "Could not delete research record"));
    } finally {
      setIsSavingResearchRecord(false);
    }
  }

  async function exportResearchRecords(format: "csv" | "markdown" | "json") {
    setIsExportingResearchRecords(true);
    setError(null);
    try {
      const response = await fetch(`/api/research-records/export?format=${format}`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const text = format === "json" ? JSON.stringify(await response.json(), null, 2) : await response.text();
      downloadTextFile(
        `mesa-research-records.${format === "markdown" ? "md" : format}`,
        text,
        format === "json" ? "application/json" : format === "csv" ? "text/csv" : "text/markdown"
      );
    } catch (caught) {
      setError(messageFor(caught, "Could not export research records"));
    } finally {
      setIsExportingResearchRecords(false);
    }
  }

  async function requestAIExplanation(
    intent: AIExplainerIntent,
    options?: {
      question?: string;
      findingId?: string;
      baseScanId?: string;
      targetScanId?: string;
      docQuery?: string;
      scoreTarget?: string;
      serviceName?: string;
    }
  ) {
    if (isPublicDemoMode && apiAvailability !== "online") {
      const response = localDemoAIResponse({
        intent,
        question: options?.question ?? aiQuestion,
        activeScan,
        result,
        scores,
        compareBaseScan,
        roadmap,
        docQuery: options?.docQuery
      });
      setStreamingAnswer("");
      setAiResponse(response);
      if (response.policy_document) {
        setPolicyText((current) =>
          intent === "POLICY_WRITING_ASSISTANCE" && current.trim() === defaultPolicyDocument.trim()
            ? response.policy_document ?? current
            : current
        );
      }
      return;
    }
    const needsScan = intent !== "DOC_QA";
    if (needsScan && !activeScan) {
      setError("Run or load a scan before using the AI explainer for scan insights.");
      return;
    }

    setError(null);
    setIsExplaining(true);
    setStreamingAnswer("");
    setAiResponse(null);
    try {
      const payload = {
        intent,
        question: options?.question ?? aiQuestion,
        project_id: selectedProject?.id,
        scan_id: activeScan?.id,
        finding_id: options?.findingId,
        base_scan_id: options?.baseScanId,
        target_scan_id: options?.targetScanId,
        doc_query: options?.docQuery,
        score_target: options?.scoreTarget,
        service_name: options?.serviceName
      };
      const response = await streamAIResponse("/api/ai/explainer/stream", payload, (chunk) => {
        setStreamingAnswer((current) => current + chunk);
      });
      setAiResponse(response);
      if (response.policy_document) {
        setPolicyText((current) =>
          intent === "POLICY_WRITING_ASSISTANCE" && current.trim() === defaultPolicyDocument.trim()
            ? response.policy_document ?? current
            : current
        );
      }
    } catch (caught) {
      setError(messageFor(caught, "AI explainer request failed"));
    } finally {
      setIsExplaining(false);
    }
  }

  async function loadAIStatus() {
    if (isPublicDemoMode && apiAvailability !== "online") {
      setAiStatus({
        mode: "demo",
        state: "GROUNDED_ONLY",
        live_enabled: false,
        api_key_configured: false,
        api_key_hint: null,
        model: "demo-embedded",
        base_url: "embedded",
        message: "Public demo mode is running from embedded example data without a live backend."
      });
      setIsCheckingAIStatus(false);
      return;
    }
    setIsCheckingAIStatus(true);
    try {
      const status = await api<AIExplainerStatus>("/api/ai/explainer/status");
      setAiStatus(status);
    } catch {
      setAiStatus(null);
    } finally {
      setIsCheckingAIStatus(false);
    }
  }

  const highestSeverity = getHighestSeverity(result?.findings ?? []);
  const systemScore = scores.find((score) => score.scope === "system") ?? result?.summary.health_scores?.system;
  const serviceScores = scores.filter((score) => score.scope === "service");
  const urgentFinding = getMostUrgentFinding(result?.findings ?? []);
  const hotspot = getHotspotService(result?.findings ?? [], serviceScores);
  const compareBaseScan = activeScan ? comparisonBaseScan(history, activeScan.id) : null;
  const hasProject = Boolean(selectedProject);
  const hasSourceConfigured = Boolean(sourceLocation.trim()) || manualServicePaths.length > 0;
  const hasRepoPreview = Boolean(repoPreview);
  const hasServiceSelection = repoPreview ? selectedDiscoveryPaths.length > 0 : manualServicePaths.length > 0;
  const hasSavedPolicies = policyCount > 0;
  const hasCompletedScan = Boolean(activeScan && result);
  React.useEffect(() => {
    if (hasCompletedScan && !hasAutoCollapsedSetup) {
      setShowSetupWorkspace(false);
      setHasAutoCollapsedSetup(true);
    }
  }, [hasAutoCollapsedSetup, hasCompletedScan]);
  const nextAction = !hasProject
    ? "Create or select a project to begin the guided workflow."
    : !hasSourceConfigured
      ? "Choose a repository source or enter manual service paths."
      : sourceLocation.trim() && !hasRepoPreview
        ? "Preview the repository source so MESA can discover likely services."
        : !hasServiceSelection
          ? "Review the discovered services and keep at least one selection for the scan."
          : !hasCompletedScan
            ? "Run the scan to generate findings, health scores, and the architecture graph."
            : "Review the results, compare history, and inspect findings in detail.";
  const workflowSteps: WorkflowStep[] = [
    {
      id: "project",
      label: "Project",
      description: "Create or select the project that will hold scan history.",
      done: hasProject,
      active: !hasProject
    },
    {
      id: "source",
      label: "Source",
      description: "Choose a repository source or provide manual service paths.",
      done: hasSourceConfigured,
      active: hasProject && !hasSourceConfigured
    },
    {
      id: "review",
      label: "Review Services",
      description: "Preview discovery and confirm the services to analyze.",
      done: hasServiceSelection,
      active: hasProject && hasSourceConfigured && !hasServiceSelection
    },
    {
      id: "policies",
      label: "Policies",
      description: "Optionally save governance policies before the scan runs.",
      done: hasSavedPolicies,
      active: hasProject && hasServiceSelection && !hasCompletedScan,
      optional: true
    },
    {
      id: "scan",
      label: "Run Scan",
      description: "Generate findings, graph evidence, scores, and history.",
      done: hasCompletedScan,
      active: hasProject && hasServiceSelection && !hasCompletedScan
    }
  ];
  const pendingWorkflowSteps = workflowSteps.filter((step) => !step.done);
  const activeWorkflowStep = workflowSteps.find((step) => step.active) ?? pendingWorkflowSteps[0] ?? workflowSteps[workflowSteps.length - 1];

  React.useEffect(() => {
    if (!workflowSteps.some((step) => step.id === activeSetupStepId)) {
      setActiveSetupStepId(activeWorkflowStep.id);
    }
  }, [activeSetupStepId, activeWorkflowStep.id, workflowSteps]);

  function openSetupStep(stepId: WorkflowStep["id"]) {
    setActiveSetupStepId(stepId);
    setShowSetupWorkspace(true);
  }

  function focusWorkflowStep(stepId: WorkflowStep["id"]) {
    openSetupStep(stepId);
    if (stepId === "review") {
      navigateToSection("services");
      return;
    }
    if (stepId === "policies") {
      navigateToSection("policies");
      return;
    }
    navigateToSection("scan");
  }

  function navigateToSection(section: AppSection, historyMode: "push" | "replace" = "push") {
    setCurrentSection(section);
    syncAppStateToUrl(selectedProjectId, section, historyMode);
  }

  function openDoc(slug: string) {
    setSelectedDocSlug(slug);
    navigateToSection("docs");
  }

  function openCreateProjectFlow() {
    setShowSetupWorkspace(true);
    setHasAutoCollapsedSetup(false);
    setActiveSetupStepId("project");
    setShowCreateProjectForm(true);
    navigateToSection("scan");
  }

  function handleTopProjectSelection(nextValue: string) {
    if (nextValue === "__create_new__") {
      openCreateProjectFlow();
      return;
    }
    updateSelectedProject(nextValue, "push");
  }

  async function probeApiAvailability() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch("/api/health", { signal: controller.signal });
      if (!response.ok) throw new Error(`Health probe returned ${response.status}`);
      setApiAvailability("online");
    } catch {
      setApiAvailability("offline");
      if (!isPublicDemoMode) {
        activatePublicDemo();
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function activatePublicDemo(scanId = demoWorkspace.scans[0].id) {
    cancelProjectRequests();
    setIsPublicDemoMode(true);
    setProjectListStatus("ready");
    setProjectListError(null);
    setProjects([demoWorkspace.project as unknown as ProjectRecord]);
    updateSelectedProject(demoWorkspace.project.id, "replace");
    setHistory(demoWorkspace.scans as unknown as ScanRecord[]);
    setEvolution(demoWorkspace.evolution as unknown as EvolutionReport[]);
    setPolicyCount(demoWorkspace.policies.length);
    setPolicyText(demoWorkspace.policyText);
    setShowSetupWorkspace(false);
    setHasAutoCollapsedSetup(true);
    setError(null);
    void loadScan(scanId);
  }

  function leavePublicDemo() {
    cancelProjectRequests();
    setIsPublicDemoMode(false);
    setProjects([]);
    updateSelectedProject("", "replace");
    resetProjectScanFlowState();
  }

  const backendUnavailable = apiAvailability === "offline";
  const usingEmbeddedDemo = isPublicDemoMode && backendUnavailable;
  const navigationItems = appNavigation.flatMap((group) => group.items.map((item) => ({ ...item, group: group.group })));
  const currentSectionMeta = navigationItems.find((item) => item.id === currentSection) ?? navigationItems[0];
  const sectionNeedsProject = sectionsRequiringProject.has(currentSection);
  const sourceLabel = sourceLocation.trim() ? sourceLocation.trim() : "Manual service paths";
  const activeScanDateLabel = activeScan ? formatDate(activeScan.completed_at ?? activeScan.created_at) : "No scan yet";

  function renderProjectSelectionPanel() {
    return (
      <section className="panelBlock">
        <div className="panelHeader compact">
          <h2>Project Selection</h2>
          <span>{projects.length} available</span>
        </div>
        <div className="projectStepLayout">
          <section className="projectSelectionPanel">
            <div className="projectChoiceHeader">
              <div className="stepHintCard compact">
                Select an existing project to restore its scan flow, or create a new project to start fresh.
              </div>
              <button
                type="button"
                className={showCreateProjectForm ? "secondaryButton activeInlineButton" : "secondaryButton"}
                onClick={() => setShowCreateProjectForm((current) => !current)}
              >
                {showCreateProjectForm ? "Hide Create Project" : "Create New Project"}
              </button>
            </div>
            <label htmlFor="scanProjectSelect">Select existing project</label>
            <select
              id="scanProjectSelect"
              value={selectedProjectId}
              onChange={(event) => updateSelectedProject(event.target.value, "push")}
              disabled={isCreating || projectListStatus === "loading"}
            >
              <option value="">Choose a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            {selectedProject ? (
              <div className="selectedProjectSummary">
                <strong>Selected</strong>
                <span>{selectedProject.name}</span>
                <small>{selectedProject.description || "Saved project ready to restore and rescan."}</small>
              </div>
            ) : null}
            {projectListStatus === "loading" ? <p className="hint">Loading existing projects...</p> : null}
            {projectListStatus === "error" && projectListError ? <div className="error">{projectListError}</div> : null}
            {projectListStatus === "ready" && projects.length === 0 ? (
              <div className="stepHintCard">
                No projects exist yet. Create a project to start a fresh scan workflow.
              </div>
            ) : null}
            {projects.length > 0 ? (
              <div className="projectQuickList">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className={selectedProjectId === project.id ? "projectQuickButton active" : "projectQuickButton"}
                    onClick={() => updateSelectedProject(project.id, "push")}
                  >
                    <strong>{project.name}</strong>
                    <small>{project.description || "Open saved setup and scan history"}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
          {showCreateProjectForm ? (
            <section className="projectCreatePanel">
              <div className="panelHeader compact">
                <h3>Create New Project</h3>
                <span>Fresh setup</span>
              </div>
              <label htmlFor="projectName">Project name</label>
              <input id="projectName" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
              <label htmlFor="projectDescription">Description</label>
              <input id="projectDescription" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} />
              <button className="fullButton" onClick={createProject} disabled={isCreating || !projectName.trim()}>
                {isCreating ? "Creating..." : "Create Project"}
              </button>
            </section>
          ) : null}
        </div>
      </section>
    );
  }

  function renderSourceConfigurationPanel() {
    return (
      <section className="panelBlock">
        <div className="panelHeader compact">
          <h2>Source Configuration</h2>
          <span>{sourceLocation.trim() ? sourceType : "Manual mode"}</span>
        </div>
        <label htmlFor="sourceType">Repository source type</label>
        <select
          id="sourceType"
          value={sourceType}
          onChange={(event) => {
            setSourceType(event.target.value);
            setRepoPreview(null);
            setSelectedDiscoveryPaths([]);
          }}
        >
          <option value="LOCAL_PATH">Local path</option>
          <option value="ARCHIVE_PATH">Archive path</option>
          <option value="GITHUB_URL">GitHub URL</option>
        </select>
        <label htmlFor="sourceLocation">Repository source</label>
        <input
          id="sourceLocation"
          placeholder={
            sourceType === "GITHUB_URL"
              ? "https://github.com/example-org/example-repo"
              : "/workspace/tests/fixtures/chatty"
          }
          value={sourceLocation}
          onChange={(event) => {
            setSourceLocation(event.target.value);
            setRepoPreview(null);
            setSelectedDiscoveryPaths([]);
          }}
        />
        {sourceType === "GITHUB_URL" ? (
          <>
            <label htmlFor="sourceRef">Branch or ref</label>
            <input
              id="sourceRef"
              placeholder="main"
              value={sourceRef}
              onChange={(event) => {
                setSourceRef(event.target.value);
                setRepoPreview(null);
                setSelectedDiscoveryPaths([]);
              }}
            />
          </>
        ) : null}
        <div className="panelButtonRow">
          <button className="secondaryButton" onClick={previewRepositorySource} disabled={isPreviewingRepo}>
            {isPreviewingRepo ? "Previewing..." : "Preview Discovery"}
          </button>
          <button
            type="button"
            onClick={() => navigateToSection("services")}
            disabled={!repoPreview && manualServicePaths.length === 0}
          >
            Review Services
          </button>
        </div>
        <p className="hint">
          Preview shows likely services with confidence and reasons. Leave this empty to keep using manual service paths only.
        </p>
        {!repoPreview && sourceLocation.trim() ? (
          <div className="stepHintCard">
            Preview discovery to unlock the service review step and confirm what MESA will analyze.
          </div>
        ) : null}
      </section>
    );
  }

  function renderServicesPanel() {
    return (
      <section className="panelBlock">
        <div className="panelHeader compact">
          <h2>Service Review</h2>
          <span>{repoPreview ? `${selectedDiscoveryPaths.length} selected` : `${manualServicePaths.length} manual paths`}</span>
        </div>
        {repoPreview ? (
          <div className="discoveryPanel discoveryPanelStandalone">
            <div className="panelHeader compact">
              <h3>Discovered Services</h3>
              <span>{repoPreview.discovered_services.length} candidates</span>
            </div>
            <div className="discoveryMeta">
              <span>{repoPreview.file_count} files previewed</span>
              <span>{selectedDiscoveryPaths.length} selected</span>
            </div>
            {repoPreview.warnings.length > 0 ? (
              <div className="warningList">
                {repoPreview.warnings.map((warning) => <small key={warning}>{warning}</small>)}
              </div>
            ) : null}
            {repoPreview.discovered_services.length === 0 ? (
              <div className="emptyInline">No service candidates detected from this source preview.</div>
            ) : (
              <div className="discoveryList">
                {repoPreview.discovered_services.map((candidate) => {
                  const selected = selectedDiscoveryPaths.includes(candidate.relative_path);
                  return (
                    <article key={candidate.relative_path} className={`discoveryCard ${selected ? "selected" : ""}`}>
                      <label className="discoveryToggle">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleDiscoveredService(candidate.relative_path)}
                        />
                        <span>{candidate.service_name}</span>
                      </label>
                      <div className="discoveryStats">
                        <strong>{Math.round(candidate.confidence * 100)}%</strong>
                        <span>{candidate.language}</span>
                        <small>{candidate.relative_path}</small>
                      </div>
                      <div className="signalTags">
                        {candidate.manifests.map((manifest) => <code key={manifest}>{manifest}</code>)}
                        {candidate.entrypoints.map((entrypoint) => <code key={entrypoint}>{entrypoint}</code>)}
                      </div>
                      <ul className="reasonList">
                        {candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    </article>
                  );
                })}
              </div>
            )}
            <button className="fullButton secondaryButton" onClick={applyDiscoveredServices} disabled={selectedDiscoveryPaths.length === 0}>
              Apply Selected Services
            </button>
          </div>
        ) : (
          <div className="stepHintCard">
            No repository preview is active. You can still continue with manual service paths below.
          </div>
        )}
        <label htmlFor="paths">Service paths</label>
        <textarea id="paths" value={paths} onChange={(event) => setPaths(event.target.value)} />
        <p className="hint">Manual fallback: use one service directory per line. Repository discovery can fill this automatically.</p>
      </section>
    );
  }

  function renderPoliciesPanel() {
    return (
      <section className="panelBlock policyEditor">
        <div className="panelHeader compact">
          <h2>Governance Policies</h2>
          <span>{policyCount} active optional rules</span>
        </div>
        <label htmlFor="policyText">Policy YAML</label>
        <textarea id="policyText" value={policyText} onChange={(event) => setPolicyText(event.target.value)} />
        <p className="hint">Policies run during project scans and violations appear as findings.</p>
        <div className="panelButtonRow">
          <button
            type="button"
            className="secondaryButton"
            onClick={() => void requestAIExplanation("POLICY_WRITING_ASSISTANCE", { question: "Draft governance policy YAML for this project." })}
            disabled={isExplaining || !selectedProject || !activeScan}
          >
            {isExplaining ? "Drafting..." : "Draft Policies With AI"}
          </button>
          <button type="button" onClick={() => navigateToSection("ai")} disabled={!activeScan}>
            Open AI Explainer
          </button>
        </div>
        <button className="fullButton" onClick={savePolicies} disabled={isSavingPolicies || !selectedProject}>
          {isSavingPolicies ? "Saving..." : "Save Policies"}
        </button>
      </section>
    );
  }

  function renderRunScanPanel() {
    return (
      <section className="panelBlock runStepCard">
        <div className="panelHeader compact">
          <h2>Run Scan</h2>
          <span>{repoPreview ? "Repository-backed" : "Manual paths"}</span>
        </div>
        <p className="hint">Run the current selection to generate findings, scores, history, and graph evidence.</p>
        <button onClick={runScan} disabled={isScanning || !selectedProject || usingEmbeddedDemo}>
          {isScanning ? "Scanning..." : repoPreview ? "Run Repo Scan" : "Run Scan"}
        </button>
      </section>
    );
  }

  function renderInterpretationCard() {
    return (
      <section className="interpretationPanel">
        <div className="interpretationIntro">
          <div className="eyebrow">Result Interpretation</div>
          <h2>Choose how to read this scan</h2>
          <p>
            Switch between a guided plain-language view and a deeper research-oriented explanation without changing
            the underlying detector results.
          </p>
          <div className="docLinks">
            <DocLinkButton label="Findings guide" onClick={() => openDoc("findings-guide")} />
          </div>
        </div>
        <div className="modeToggle" role="tablist" aria-label="Interpretation mode">
          <button
            type="button"
            className={interpretationMode === "beginner" ? "modeButton active" : "modeButton"}
            onClick={() => setInterpretationMode("beginner")}
          >
            <small>Recommended</small>
            <strong>Beginner</strong>
            <span>Plain language explanations, impact, and the best first action.</span>
          </button>
          <button
            type="button"
            className={interpretationMode === "research" ? "modeButton active" : "modeButton"}
            onClick={() => setInterpretationMode("research")}
          >
            <small>Detailed</small>
            <strong>Research</strong>
            <span>Detector labels, richer evidence detail, and technical context.</span>
          </button>
        </div>
      </section>
    );
  }

  function renderHistoryPanel() {
    return (
      <section className="historyPanel">
        <div className="panelHeader compact">
          <h2>Scan History</h2>
          <span>{history.length} scans</span>
        </div>
        <button
          type="button"
          className="fullButton secondaryButton"
          onClick={() => void createResearchRecordFromScan(activeScan?.id)}
          disabled={!activeScan || isSavingResearchRecord || usingEmbeddedDemo}
        >
          {isSavingResearchRecord ? "Saving Record..." : "Create Research Record"}
        </button>
        <div className="scanList">
          {history.length === 0 ? <div className="emptyInline">No persistent scans yet.</div> : null}
          {history.map((scan) => (
            <button
              key={scan.id}
              className={`scanItem ${activeScan?.id === scan.id ? "active" : ""}`}
              onClick={() => void loadScan(scan.id)}
              disabled={isLoadingScan}
            >
              <strong>{scan.finding_count} findings</strong>
              <span>{scan.service_count} services</span>
              <small>{formatDate(scan.completed_at ?? scan.created_at)}</small>
            </button>
          ))}
        </div>
      </section>
    );
  }

  function renderGraphPanel() {
    return (
      <section className="graphPanel dashboardGraph">
        <div className="graphHeader">
          <div>
            <h2>Architecture Graph</h2>
            <p>{activeScan ? `Scan ${shortId(activeScan.id)} - ${displayGraph?.source === "digital-twin" ? "Digital Twin" : "Report Graph"}` : "Run or select a scan to build the graph"}</p>
          </div>
          <div className="legend">
            <span><i className="serviceDot" /> Service</span>
            <span><i className="apiDot" /> API</span>
            <span><i className="databaseDot" /> Database</span>
            <span><i className="riskLine" /> Risk</span>
          </div>
        </div>
        {result ? <div ref={graphRef} className="graph" /> : <div className="emptyState">No scan selected.</div>}
        <GraphInspector selection={selectedGraphElement} />
      </section>
    );
  }

  function renderOverviewWorkspace() {
    if (!selectedProject) {
      return (
        <div className="workspaceStack">
          <section className="workspaceIntroCard">
            <div>
              <div className="eyebrow">Start Here</div>
              <h2>Create or select a project</h2>
              <p>Choose an existing project to restore its saved scan state, or create a new one to start a clean analysis workflow.</p>
            </div>
            <div className="docLinks">
              <DocLinkButton label="Evaluator quick start" onClick={() => openDoc("evaluator-quick-start")} />
              <DocLinkButton label="Public repo guide" onClick={() => openDoc("public-repo-scan-guide")} />
            </div>
          </section>
          {renderProjectSelectionPanel()}
        </div>
      );
    }

    return (
      <div className="workspaceStack">
        <section className="workspaceOverviewGrid">
          <article className="workspaceInfoCard">
            <div className="eyebrow">Project</div>
            <h2>{selectedProject.name}</h2>
            <p>{selectedProject.description || "Project state is available globally across every workspace."}</p>
            <div className="infoList">
              <span><strong>Source</strong><code>{sourceLabel}</code></span>
              <span><strong>Services</strong><code>{String(result?.summary.service_count ?? manualServicePaths.length ?? 0)}</code></span>
              <span><strong>Last scan</strong><code>{activeScanDateLabel}</code></span>
            </div>
          </article>
          <article className="workspaceInfoCard emphasis">
            <div className="eyebrow">Next Action</div>
            <h2>{nextAction}</h2>
            <p>Use the dedicated workspaces to move straight into scan setup, findings review, graph analysis, or AI assistance.</p>
            <div className="workspaceActionGrid">
              <button type="button" className="secondaryButton" onClick={() => navigateToSection("scan")}>Open Scan</button>
              <button type="button" onClick={() => navigateToSection("findings")} disabled={!result}>View Findings</button>
              <button type="button" onClick={() => navigateToSection("graph")} disabled={!result}>Open Graph</button>
              <button type="button" onClick={() => navigateToSection("ai")} disabled={!activeScan}>Ask AI</button>
            </div>
          </article>
        </section>

        <section className="summaryStrip">
          <Metric
            label="Findings"
            value={result?.summary.finding_count ?? 0}
            detail={result ? `${filteredFindings.length} visible with current filters` : "Run a scan to populate results"}
            kind="number"
          />
          <Metric
            label="Services"
            value={result?.summary.service_count ?? 0}
            detail={result ? "Microservices included in this scan" : "No source analyzed yet"}
            kind="number"
          />
          <Metric
            label="System Health"
            value={systemScore ? Math.round(systemScore.score) : "--"}
            tone={systemScore ? gradeTone(systemScore.grade) : ""}
            detail={systemScore ? `${systemScore.grade} overall architecture quality` : "Available after a completed scan"}
            kind="number"
          />
          <Metric
            label="Highest Risk"
            value={highestSeverity}
            tone={highestSeverity.toLowerCase()}
            detail={highestSeverity === "None" ? "No active findings yet" : "Strongest severity currently detected"}
            kind="status"
          />
          <Metric
            label="Hotspot Service"
            value={hotspot?.service ?? "--"}
            tone={hotspot ? hotspot.tone : ""}
            detail={hotspot?.detail ?? "Most concentrated risk area in the scan"}
            kind="service"
            featured
          />
          <Metric
            label="Focus First"
            value={urgentFinding ? summaryFindingTitle(urgentFinding) : "No urgent issue"}
            tone={urgentFinding ? urgentFinding.severity.toLowerCase() : ""}
            detail={urgentFinding ? compactMetricDetail(recommendationPreview(urgentFinding), 28) : "Run a scan to generate prioritized guidance"}
            kind="summary"
            featured
            wide
            detailLines={5}
            expandableDetail={Boolean(urgentFinding)}
            fullDetail={urgentFinding ? recommendationPreview(urgentFinding) : undefined}
          />
        </section>

        <section className="workspaceTwoColumn">
          {renderHistoryPanel()}
          {renderInterpretationCard()}
        </section>
      </div>
    );
  }

  function renderScanWorkspace() {
    return (
      <div className="workspaceStack">
        <section className="workflowTrackPanel workspaceIntroCard">
          <div className="workflowSummary">
            <div>
              <div className="eyebrow">Guided Scan Flow</div>
              <h2>{nextAction}</h2>
              <p>Keep project selection, source configuration, and scan execution in one focused workspace instead of a long scrolling page.</p>
              <div className="docLinks">
                <DocLinkButton label="Evaluator quick start" onClick={() => openDoc("evaluator-quick-start")} />
                <DocLinkButton label="Public repo guide" onClick={() => openDoc("public-repo-scan-guide")} />
              </div>
            </div>
            <div className="workflowActions">
              <div className="workflowStatus">
                <strong>{workflowSteps.filter((step) => step.done).length}/{workflowSteps.length}</strong>
                <span>steps ready</span>
              </div>
              <button
                type="button"
                className="workflowToggle"
                onClick={() => setShowSetupWorkspace((current) => !current)}
              >
                {showSetupWorkspace ? "Hide workflow cards" : "Show workflow cards"}
              </button>
            </div>
          </div>
          <div className="workflowFlow">
            {workflowSteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                className={`workflowNode ${step.done ? "done" : ""} ${step.id === activeSetupStepId ? "current" : ""} ${step.active ? "active" : ""} ${step.optional ? "optional" : ""}`}
                onClick={() => focusWorkflowStep(step.id)}
              >
                <small>Step {index + 1}</small>
                <strong>{step.label}</strong>
              </button>
            ))}
          </div>
        </section>

        {showSetupWorkspace ? (
          <section className="workspaceSplit workspaceSplitWide">
            <div className="workspaceStack">
              {renderProjectSelectionPanel()}
              {renderSourceConfigurationPanel()}
            </div>
            <div className="workspaceStack">
              {renderRunScanPanel()}
              {renderInterpretationCard()}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  function renderServicesWorkspace() {
    if (!selectedProject) {
      return renderProjectRequiredState();
    }
    return (
      <div className="workspaceStack">
        <section className="workspaceInfoCard">
          <div className="eyebrow">Service Discovery</div>
          <h2>Review service candidates before the scan</h2>
          <p>Keep the selected services tight so the scan reflects the actual architecture boundary you want to analyze.</p>
          <div className="infoList">
            <span><strong>Source</strong><code>{sourceLabel}</code></span>
            <span><strong>Selected</strong><code>{String(selectedDiscoveryPaths.length || manualServicePaths.length)}</code></span>
          </div>
        </section>
        {renderServicesPanel()}
      </div>
    );
  }

  function renderFindingsWorkspace() {
    if (!selectedProject) {
      return renderProjectRequiredState();
    }
    return (
      <FindingsDashboard
        findings={result?.findings ?? []}
        filteredFindings={filteredFindings}
        filters={filters}
        filterOptions={filterOptions}
        interpretationMode={interpretationMode}
        onFilterChange={setFilters}
        onOpenDoc={openDoc}
        onSelectFinding={setSelectedFinding}
        onAskAI={(finding) => {
          setAiQuestion(`Explain simply why ${plainLanguageFindingTitle(finding).toLowerCase()} should be reviewed.`);
          void requestAIExplanation("FINDING_EXPLANATION", {
            question: `Explain simply why ${plainLanguageFindingTitle(finding).toLowerCase()} should be reviewed.`,
            findingId: finding.id
          });
        }}
      />
    );
  }

  function renderGraphWorkspace() {
    if (!selectedProject) {
      return renderProjectRequiredState();
    }
    return (
      <section className="contentGrid workspaceGraphGrid">
        {renderGraphPanel()}
        <HealthScoreView
          systemScore={systemScore ?? null}
          serviceScores={serviceScores}
          onOpenDoc={openDoc}
        />
      </section>
    );
  }

  function renderProjectRequiredState() {
    return (
      <section className="workspaceEmptyState">
        <div className="eyebrow">Project Required</div>
        <h2>Select a project to continue</h2>
        <p>This workspace depends on the globally selected project. Choose one from the header or open the scan workspace to create a new project.</p>
        <div className="workspaceActionGrid">
          <button type="button" onClick={() => navigateToSection("scan")}>Open Scan Workspace</button>
          <button type="button" className="secondaryButton" onClick={openCreateProjectFlow}>Create Project</button>
        </div>
      </section>
    );
  }

  function renderSectionContent() {
    if (sectionNeedsProject && !selectedProject && currentSection !== "scan" && currentSection !== "overview") {
      return renderProjectRequiredState();
    }

    switch (currentSection) {
      case "overview":
        return renderOverviewWorkspace();
      case "scan":
        return renderScanWorkspace();
      case "services":
        return renderServicesWorkspace();
      case "findings":
        return renderFindingsWorkspace();
      case "graph":
        return renderGraphWorkspace();
      case "history":
        return renderHistoryPanel();
      case "evolution":
        return <EvolutionPanel reports={evolution} />;
      case "roadmap":
        return (
          <RemediationRoadmapPanel
            roadmap={roadmap}
            isLoading={isLoadingRoadmap}
            onOpenDoc={openDoc}
          />
        );
      case "ai":
        return (
          <AIExplainerPanel
            activeScan={activeScan}
            compareBaseScan={compareBaseScan}
            response={aiResponse}
            status={aiStatus}
            streamingAnswer={streamingAnswer}
            question={aiQuestion}
            isLoading={isExplaining}
            isCheckingStatus={isCheckingAIStatus}
            urgentFinding={urgentFinding ?? null}
            systemScore={systemScore ?? null}
            policyText={policyText}
            onQuestionChange={setAiQuestion}
            onAsk={(intent, options) => void requestAIExplanation(intent, options)}
            onApplyPolicyDraft={(draft) => setPolicyText(draft)}
            onRefreshStatus={() => void loadAIStatus()}
            onOpenDoc={openDoc}
          />
        );
      case "evaluation":
        return (
          <ResearchEvaluationPanel
            records={researchRecords}
            selectedRecordId={selectedResearchRecordId}
            projects={projects}
            selectedProjectId={selectedProjectId}
            history={history}
            activeScan={activeScan}
            isLoading={isLoadingResearchRecords}
            isSaving={isSavingResearchRecord}
            isExporting={isExportingResearchRecords}
            onSelectRecord={setSelectedResearchRecordId}
            onSelectProject={(projectId) => updateSelectedProject(projectId, "push")}
            onSelectScan={(scanId) => void loadScan(scanId, { projectId: selectedProjectId })}
            onCreateFromScan={(scanId) => void createResearchRecordFromScan(scanId)}
            onRefresh={() => void loadResearchRecords()}
            onUpdate={(record, patch) => void updateResearchRecord(record, patch)}
            onDelete={(recordId) => void deleteResearchRecord(recordId)}
            onExport={(format) => void exportResearchRecords(format)}
          />
        );
      case "policies":
        return selectedProject ? renderPoliciesPanel() : renderProjectRequiredState();
      case "docs":
        return (
          <DocumentationPortal
            selectedDocSlug={selectedDocSlug}
            docsQuery={docsQuery}
            docsCategory={docsCategory}
            onChangeQuery={setDocsQuery}
            onChangeCategory={setDocsCategory}
            onSelectDoc={setSelectedDocSlug}
            onBackToAnalysis={() => navigateToSection("overview")}
          />
        );
      default:
        return renderOverviewWorkspace();
    }
  }

  return (
    <main className="appShell">
      <aside className={sidebarCollapsed ? "appSidebar collapsed" : "appSidebar"}>
        <div className="appSidebarTop">
          <div className="appIdentity">
            <div className="eyebrow">Architecture Analyzer</div>
            <h1>MESA</h1>
            {!sidebarCollapsed ? <p>Structured project selection, scanning, findings analysis, and research evidence in one workspace.</p> : null}
          </div>
          <button
            type="button"
            className="sidebarToggle"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? ">" : "<"}
          </button>
        </div>

        <nav className="sidebarNav" aria-label="Workspace sections">
          {appNavigation.map((group) => (
            <section key={group.group} className="sidebarGroup">
              {!sidebarCollapsed ? <h2>{group.group}</h2> : null}
              <div className="sidebarGroupItems">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === currentSection ? "sidebarItem active" : "sidebarItem"}
                    onClick={() => navigateToSection(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <strong>{item.label}</strong>
                    {!sidebarCollapsed ? <span>{item.description}</span> : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <div className="appFrame">
        <header className="appHeader">
          <div className="appHeaderIntro">
            <div className="eyebrow">{currentSectionMeta.group}</div>
            <h2>{currentSectionMeta.label}</h2>
            <p>{currentSectionMeta.description}</p>
          </div>

          <div className="appHeaderActions">
            <div className="toolbarProjectShell headerProjectShell">
              <div className="toolbarProjectMeta">
                <strong>
                  {isLoadingProjectState
                    ? "Loading project..."
                    : selectedProject
                      ? selectedProject.name
                      : "No project selected"}
                </strong>
                <small>
                  {projectListStatus === "loading"
                    ? "Refreshing project list"
                    : `${projects.length} available project${projects.length === 1 ? "" : "s"}`}
                </small>
              </div>
              <label className="toolbarProjectPicker">
                <span>Project</span>
                <select
                  value={selectedProjectId}
                  onChange={(event) => handleTopProjectSelection(event.target.value)}
                  disabled={projectListStatus === "loading" && !isPublicDemoMode}
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                  {!isPublicDemoMode ? <option value="__create_new__">+ Create New Project</option> : null}
                </select>
              </label>
            </div>

            {!isPublicDemoMode ? (
              <button type="button" className="secondaryButton" onClick={openCreateProjectFlow}>
                New Project
              </button>
            ) : null}
            <button onClick={runScan} disabled={isScanning || !selectedProject || usingEmbeddedDemo}>
              {isScanning ? "Scanning..." : repoPreview ? "Run Repo Scan" : "Run Scan"}
            </button>
          </div>
        </header>

        <PublicDemoBanner
          apiAvailability={apiAvailability}
          isPublicDemoMode={isPublicDemoMode}
          usingEmbeddedDemo={usingEmbeddedDemo}
          onActivateDemo={() => activatePublicDemo()}
          onLeaveDemo={() => leavePublicDemo()}
          onOpenDoc={openDoc}
        />

        {error ? <div className="error workspaceError">{error}</div> : null}

        <section className="workspaceFrame">
          <div className="workspaceFrameHeader">
            <div>
              <div className="eyebrow">Current Workspace</div>
              <h2>{currentSectionMeta.label}</h2>
              <p>
                {selectedProject
                  ? `${selectedProject.name} is currently active. Switch projects from the header without leaving this workspace.`
                  : "Choose a project from the header or create a new one to start a saved scan workflow."}
              </p>
            </div>
            <div className="workspaceContextMeta">
              <span>{selectedProject ? selectedProject.name : "No project selected"}</span>
              <code>{sectionNeedsProject ? sourceLabel : "Reference workspace"}</code>
            </div>
          </div>

          <div className="workspaceBody">
            {renderSectionContent()}
          </div>
        </section>
      </div>

      {selectedFinding ? (
        <FindingDrawer
          finding={selectedFinding}
          interpretationMode={interpretationMode}
          onAskAI={() => {
            setAiQuestion(`Explain simply what to solve first about ${plainLanguageFindingTitle(selectedFinding).toLowerCase()}.`);
            void requestAIExplanation("FINDING_EXPLANATION", {
              question: `Explain simply what to solve first about ${plainLanguageFindingTitle(selectedFinding).toLowerCase()}.`,
              findingId: selectedFinding.id
            });
          }}
          onClose={() => setSelectedFinding(null)}
        />
      ) : null}
    </main>
  );
}

function ResearchEvaluationPanel({
  records,
  selectedRecordId,
  projects,
  selectedProjectId,
  history,
  activeScan,
  isLoading,
  isSaving,
  isExporting,
  onSelectRecord,
  onSelectProject,
  onSelectScan,
  onCreateFromScan,
  onRefresh,
  onUpdate,
  onDelete,
  onExport
}: {
  records: ResearchEvaluationRecord[];
  selectedRecordId: string;
  projects: ProjectRecord[];
  selectedProjectId: string;
  history: ScanRecord[];
  activeScan: ScanRecord | null;
  isLoading: boolean;
  isSaving: boolean;
  isExporting: boolean;
  onSelectRecord: (id: string) => void;
  onSelectProject: (projectId: string) => void;
  onSelectScan: (scanId: string) => void;
  onCreateFromScan: (scanId: string) => void;
  onRefresh: () => void;
  onUpdate: (record: ResearchEvaluationRecord, patch: Partial<ResearchEvaluationRecord>) => void;
  onDelete: (recordId: string) => void;
  onExport: (format: "csv" | "markdown" | "json") => void;
}) {
  const selectedRecord = records.find((record) => record.id === selectedRecordId) ?? records[0] ?? null;
  const reportReadyCount = records.filter((record) => record.suitable_for_report).length;
  const averagePrecision = averageMetric(records.map((record) => record.precision));
  const averageRecall = averageMetric(records.map((record) => record.recall));
  const [draftScanId, setDraftScanId] = React.useState("");
  const [draft, setDraft] = React.useState<ResearchEvaluationDraft | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = React.useState(false);
  const [draftError, setDraftError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activeScan && activeScan.project_id === selectedProjectId) {
      setDraftScanId(activeScan.id);
      return;
    }
    if (history.length > 0) {
      setDraftScanId((current) => (current && history.some((scan) => scan.id === current) ? current : history[0].id));
      return;
    }
    setDraftScanId("");
  }, [activeScan, history, selectedProjectId]);

  React.useEffect(() => {
    if (!draftScanId) {
      setDraft(null);
      setDraftError(null);
      return;
    }

    let isCancelled = false;
    setIsLoadingDraft(true);
    setDraftError(null);
    void api<ResearchEvaluationDraft>(`/api/research-records/draft/${draftScanId}`)
      .then((payload) => {
        if (isCancelled) return;
        setDraft(payload);
      })
      .catch((caught) => {
        if (isCancelled) return;
        setDraft(null);
        setDraftError(messageFor(caught, "Could not load evaluation draft"));
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoadingDraft(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [draftScanId]);

  return (
    <section className="researchWorkspace">
      <section className="researchHero">
        <div>
          <div className="eyebrow">Research Evaluation</div>
          <h2>Project Scan Records</h2>
          <p>
            Convert real repository scans into reusable evaluation records for your final report,
            viva walkthrough, and demo evidence table.
          </p>
        </div>
        <div className="researchActions">
          <button type="button" className="secondaryButton" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <section className="researchCreatePanel">
        <div className="panelHeader compact">
          <h2>Create Research Evaluation</h2>
          <span>{draft ? `Scan ${shortId(draft.scan_id)}` : "Select project and scan"}</span>
        </div>
        <div className="researchCreateGrid">
          <label>
            <span>Project</span>
            <select value={selectedProjectId} onChange={(event) => onSelectProject(event.target.value)}>
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Scan</span>
            <select
              value={draftScanId}
              onChange={(event) => {
                const nextScanId = event.target.value;
                setDraftScanId(nextScanId);
                if (nextScanId) onSelectScan(nextScanId);
              }}
              disabled={!selectedProjectId || history.length === 0}
            >
              <option value="">{history.length === 0 ? "No scans available" : "Select a scan"}</option>
              {history.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {formatResearchScanOption(scan)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!selectedProjectId ? (
          <div className="emptyInline">Select a project first, then choose the scan you want to evaluate.</div>
        ) : history.length === 0 ? (
          <div className="emptyInline">This project has no scans yet. Run a scan first, then come back here to create the evaluation record.</div>
        ) : isLoadingDraft ? (
          <div className="emptyInline">Loading scan-derived evaluation values...</div>
        ) : draftError ? (
          <div className="error">{draftError}</div>
        ) : draft ? (
          <div className="researchDraftCard">
            <div className="researchDraftHeader">
              <div>
                <strong>{draft.repo_name}</strong>
                <small>{draft.commit_ref || "Commit/ref N/A"}</small>
              </div>
              <span className={`researchStatusBadge ${draft.accuracy_mode === "GROUND_TRUTH" ? "good" : "neutral"}`}>
                {draft.accuracy_mode === "GROUND_TRUTH"
                  ? `Ground truth matched${draft.matched_benchmark_name ? `: ${draft.matched_benchmark_name}` : ""}`
                  : "Manual validation required"}
              </span>
            </div>
            <div className="researchDraftGrid">
              <ResearchDraftMetric label="Services Expected" value={draft.expected_services ?? null} tone="neutral" />
              <ResearchDraftMetric label="Services Detected" value={draft.detected_services} tone="neutral" />
              <ResearchDraftMetric label="Findings" value={draft.total_findings} tone="neutral" />
              <ResearchDraftMetric label="TP" value={draft.true_positives ?? null} tone={draft.true_positives == null ? "neutral" : "good"} />
              <ResearchDraftMetric label="FP" value={draft.false_positives ?? null} tone={draft.false_positives == null ? "neutral" : "warn"} />
              <ResearchDraftMetric label="FN" value={draft.false_negatives ?? null} tone={draft.false_negatives == null ? "neutral" : "warn"} />
              <ResearchDraftMetric label="Precision" value={formatMetricValue(draft.precision)} tone="good" />
              <ResearchDraftMetric label="Recall" value={formatMetricValue(draft.recall)} tone="good" />
              <ResearchDraftMetric label="F1" value={formatMetricValue(draft.f1_score)} tone="good" />
            </div>
            <p className="researchDraftNotes">{draft.notes}</p>
            <div className="researchActions">
              <button type="button" onClick={() => onCreateFromScan(draft.scan_id)} disabled={isSaving}>
                {isSaving ? "Creating..." : "Create Evaluation From Selected Scan"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="researchSummaryGrid">
        <Metric label="Records" value={records.length} detail="Open-source project evaluations" kind="number" />
        <Metric label="Report Ready" value={reportReadyCount} detail="Marked suitable for final paper/demo" kind="number" />
        <Metric label="Avg Precision" value={formatMetricValue(averagePrecision)} detail="Calculated from saved records" kind="status" />
        <Metric label="Avg Recall" value={formatMetricValue(averageRecall)} detail="Calculated from saved records" kind="status" />
      </section>

      <section className="researchExportBar">
        <span>{records.length} records available for export</span>
        <div>
          <button type="button" className="secondaryButton" onClick={() => onExport("markdown")} disabled={isExporting || records.length === 0}>Markdown</button>
          <button type="button" className="secondaryButton" onClick={() => onExport("csv")} disabled={isExporting || records.length === 0}>CSV</button>
          <button type="button" className="secondaryButton" onClick={() => onExport("json")} disabled={isExporting || records.length === 0}>JSON</button>
        </div>
      </section>

      <section className="researchTablePanel">
        <div className="panelHeader compact">
          <h2>Evaluation Records Table</h2>
          <span>{isLoading ? "Loading" : `${records.length} rows`}</span>
        </div>
        {records.length === 0 ? (
          <div className="emptyInline">
            Create a research evaluation from a selected project scan to populate this table.
          </div>
        ) : (
          <div className="researchTableWrap">
            <table className="researchTable">
              <thead>
                <tr>
                  <th>Repo</th>
                  <th>Commit/Ref</th>
                  <th>Services Expected</th>
                  <th>Services Detected</th>
                  <th>Findings</th>
                  <th>TP</th>
                  <th>FP</th>
                  <th>FN</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>F1</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className={selectedRecord?.id === record.id ? "selected" : ""}
                    onClick={() => onSelectRecord(record.id)}
                  >
                    <td><strong>{record.repo_name}</strong></td>
                    <td>{record.commit_ref || "N/A"}</td>
                    <td>{record.expected_services ?? "N/A"}</td>
                    <td>{record.detected_services}</td>
                    <td>{record.total_findings}</td>
                    <td>{record.true_positives ?? "N/A"}</td>
                    <td>{record.false_positives ?? "N/A"}</td>
                    <td>{record.false_negatives ?? "N/A"}</td>
                    <td>{formatMetricValue(record.precision)}</td>
                    <td>{formatMetricValue(record.recall)}</td>
                    <td>{formatMetricValue(record.f1_score)}</td>
                    <td>{record.notes || "Add notes"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRecord ? (
        <ResearchRecordEditor
          record={selectedRecord}
          isSaving={isSaving}
          selectedProjectId={selectedProjectId}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ) : null}
    </section>
  );
}

function ResearchRecordEditor({
  record,
  isSaving,
  selectedProjectId,
  onUpdate,
  onDelete
}: {
  record: ResearchEvaluationRecord;
  isSaving: boolean;
  selectedProjectId: string;
  onUpdate: (record: ResearchEvaluationRecord, patch: Partial<ResearchEvaluationRecord>) => void;
  onDelete: (recordId: string) => void;
}) {
  const [draft, setDraft] = React.useState<ResearchEvaluationRecord>(record);
  const [baselineDraft, setBaselineDraft] = React.useState<ResearchEvaluationDraft | null>(null);

  React.useEffect(() => {
    setDraft(record);
  }, [record]);

  React.useEffect(() => {
    if (!record.scan_id) {
      setBaselineDraft(null);
      return;
    }
    let isCancelled = false;
    void api<ResearchEvaluationDraft>(`/api/research-records/draft/${record.scan_id}`)
      .then((payload) => {
        if (isCancelled) return;
        setBaselineDraft(payload);
      })
      .catch(() => {
        if (isCancelled) return;
        setBaselineDraft(null);
      });
    return () => {
      isCancelled = true;
    };
  }, [record.scan_id]);

  return (
    <section className="researchEditor panelBlock">
      <div className="panelHeader compact">
        <h2>Manual Evaluation Details</h2>
        <span>{record.suitable_for_report ? "Report-ready" : "Draft"}</span>
      </div>
      <div className="researchEditorSummary">
        <div>
          <span className="researchEditorLabel">Source scan</span>
          <strong>{record.scan_id ? shortId(record.scan_id) : "Not linked"}</strong>
          <small>{record.commit_ref || "Commit/ref N/A"}</small>
        </div>
        <div>
          <span className="researchEditorLabel">Project linkage</span>
          <strong>{record.scan_id ? "Traceable via scan_id" : "Manual record"}</strong>
          <small>{selectedProjectId ? "Current project context available" : "No project selected"}</small>
        </div>
        <div>
          <span className="researchEditorLabel">Metric source</span>
          <strong>
            {baselineDraft?.accuracy_mode === "GROUND_TRUTH"
              ? "Auto from benchmark ground truth"
              : "Manual validation / override"}
          </strong>
          <small>
            {baselineDraft?.matched_benchmark_name
              ? baselineDraft.matched_benchmark_name
              : "Researcher review determines TP / FP / FN"}
          </small>
        </div>
      </div>
      <div className="researchFormGrid">
        <ResearchTextInput
          label="Repository name"
          status={fieldSourceLabel("repo_name", draft, baselineDraft)}
          value={draft.repo_name}
          onChange={(value) => setDraft({ ...draft, repo_name: value })}
        />
        <ResearchTextInput
          label="Repository URL"
          status={fieldSourceLabel("repo_url", draft, baselineDraft)}
          value={draft.repo_url ?? ""}
          onChange={(value) => setDraft({ ...draft, repo_url: value })}
        />
        <ResearchTextInput
          label="Commit/ref"
          status={fieldSourceLabel("commit_ref", draft, baselineDraft)}
          value={draft.commit_ref ?? ""}
          onChange={(value) => setDraft({ ...draft, commit_ref: value })}
        />
        <ResearchTextInput
          label="Project type/framework"
          status={fieldSourceLabel("project_type", draft, baselineDraft)}
          value={draft.project_type ?? ""}
          onChange={(value) => setDraft({ ...draft, project_type: value })}
        />
        <ResearchNumberInput
          label="Services expected"
          status={fieldSourceLabel("expected_services", draft, baselineDraft)}
          value={draft.expected_services}
          onChange={(value) => setDraft({ ...draft, expected_services: value })}
        />
        <ResearchNumberInput
          label="True positives"
          status={fieldSourceLabel("true_positives", draft, baselineDraft)}
          value={draft.true_positives}
          onChange={(value) => setDraft({ ...draft, true_positives: value })}
        />
        <ResearchNumberInput
          label="False positives"
          status={fieldSourceLabel("false_positives", draft, baselineDraft)}
          value={draft.false_positives}
          onChange={(value) => setDraft({ ...draft, false_positives: value })}
        />
        <ResearchNumberInput
          label="False negatives"
          status={fieldSourceLabel("false_negatives", draft, baselineDraft)}
          value={draft.false_negatives}
          onChange={(value) => setDraft({ ...draft, false_negatives: value })}
        />
      </div>
      <div className="researchMetricPreview">
        <span>Precision: <strong>{formatMetricValue(draftMetricPreview(draft).precision)}</strong> <em>Calculated</em></span>
        <span>Recall: <strong>{formatMetricValue(draftMetricPreview(draft).recall)}</strong> <em>Calculated</em></span>
        <span>F1: <strong>{formatMetricValue(draftMetricPreview(draft).f1)}</strong> <em>Calculated</em></span>
      </div>
      <label htmlFor="expectedPatterns">Expected communication patterns</label>
      <textarea id="expectedPatterns" value={draft.expected_patterns ?? ""} onChange={(event) => setDraft({ ...draft, expected_patterns: event.target.value })} />
      <label htmlFor="detectedPatterns">Detected communication patterns</label>
      <textarea id="detectedPatterns" value={draft.detected_patterns ?? ""} onChange={(event) => setDraft({ ...draft, detected_patterns: event.target.value })} />
      <label htmlFor="researchNotes">Notes</label>
      <textarea id="researchNotes" value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
      <label htmlFor="researchLimitations">Limitations</label>
      <textarea id="researchLimitations" value={draft.limitations ?? ""} onChange={(event) => setDraft({ ...draft, limitations: event.target.value })} />
      <label htmlFor="researchRelevance">Research relevance</label>
      <textarea id="researchRelevance" value={draft.research_relevance ?? ""} onChange={(event) => setDraft({ ...draft, research_relevance: event.target.value })} />
      <label className="reportReadyToggle">
        <input
          type="checkbox"
          checked={draft.suitable_for_report}
          onChange={(event) => setDraft({ ...draft, suitable_for_report: event.target.checked })}
        />
        <span>Suitable for final report/demo</span>
      </label>
      <div className="panelButtonRow">
        <button type="button" onClick={() => onUpdate(record, draft)} disabled={isSaving || !draft.repo_name.trim()}>
          {isSaving ? "Saving..." : "Save Evaluation Record"}
        </button>
        <button type="button" className="secondaryButton" onClick={() => onDelete(record.id)} disabled={isSaving}>
          Delete Record
        </button>
      </div>
    </section>
  );
}

function ResearchTextInput({
  label,
  status,
  value,
  onChange
}: {
  label: string;
  status?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}{status ? <em className="fieldStatus">{status}</em> : null}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ResearchNumberInput({
  label,
  status,
  value,
  onChange
}: {
  label: string;
  status?: string;
  value?: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label>
      <span>{label}{status ? <em className="fieldStatus">{status}</em> : null}</span>
      <input
        type="number"
        min="0"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Math.max(0, Number(event.target.value)))}
      />
    </label>
  );
}

function ResearchDraftMetric({
  label,
  value,
  tone
}: {
  label: string;
  value: string | number | null;
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <div className={`researchDraftMetric ${tone}`}>
      <span>{label}</span>
      <strong>{value === null ? "N/A" : value}</strong>
    </div>
  );
}

function fieldSourceLabel(
  field: keyof Pick<
    ResearchEvaluationRecord,
    "repo_name" | "repo_url" | "commit_ref" | "project_type" | "expected_services" | "true_positives" | "false_positives" | "false_negatives"
  >,
  record: ResearchEvaluationRecord,
  baselineDraft: ResearchEvaluationDraft | null
) {
  if (!baselineDraft) {
    return field === "true_positives" || field === "false_positives" || field === "false_negatives"
      ? "Manual"
      : undefined;
  }
  const baselineValue = baselineDraft[field as keyof ResearchEvaluationDraft];
  const recordValue = record[field];
  if (normalizedComparable(recordValue) !== normalizedComparable(baselineValue)) {
    return "Override";
  }
  if (field === "true_positives" || field === "false_positives" || field === "false_negatives") {
    return baselineDraft.accuracy_mode === "GROUND_TRUTH" ? "Auto" : "Manual";
  }
  return "Auto";
}

function normalizedComparable(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function formatResearchScanOption(scan: ScanRecord) {
  const branchOrRef = scan.commit_sha || scan.repo_ref || "no-ref";
  return `${shortId(scan.id)} - ${branchOrRef} - ${scan.finding_count} findings`;
}

function PublicDemoBanner({
  apiAvailability,
  isPublicDemoMode,
  usingEmbeddedDemo,
  onActivateDemo,
  onLeaveDemo,
  onOpenDoc
}: {
  apiAvailability: ApiAvailability;
  isPublicDemoMode: boolean;
  usingEmbeddedDemo: boolean;
  onActivateDemo: () => void;
  onLeaveDemo: () => void;
  onOpenDoc: (slug: string) => void;
}) {
  if (apiAvailability === "checking") {
    return (
      <section className="publicDemoBanner neutral">
        <strong>Checking backend availability</strong>
        <span>MESA is checking whether the live API is reachable before choosing the best experience for this session.</span>
      </section>
    );
  }

  if (usingEmbeddedDemo) {
    return (
      <section className="publicDemoBanner demo">
        <div>
          <strong>Public demo mode is active</strong>
          <span>
            The live backend is not connected, so MESA loaded embedded example scans, roadmap data, docs, and a guided evaluator-friendly walkthrough.
          </span>
        </div>
        <div className="publicDemoActions">
          <button type="button" className="workflowToggle" onClick={() => onOpenDoc("public-demo-guide")}>
            Demo guide
          </button>
          <button type="button" className="workflowToggle" onClick={() => onOpenDoc("evaluator-quick-start")}>
            Evaluator walkthrough
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="publicDemoBanner live">
      <div>
        <strong>Live workspace is available</strong>
        <span>{isPublicDemoMode ? "The embedded demo workspace is loaded even though the live backend is available." : "You can analyze your own repositories normally, or switch to the embedded public demo examples at any time."}</span>
      </div>
      <div className="publicDemoActions">
        {isPublicDemoMode ? (
          <button type="button" className="workflowToggle" onClick={onLeaveDemo}>
            Return to live workspace
          </button>
        ) : (
          <button type="button" className="workflowToggle" onClick={onActivateDemo}>
            Load demo workspace
          </button>
        )}
      </div>
    </section>
  );
}

function GraphInspector({ selection }: { selection: GraphSelection | null }) {
  if (!selection) {
    return (
      <div className="graphInspector emptyInspector">
        Click a service, API, database, or dependency edge to inspect digital-twin evidence.
      </div>
    );
  }
  return (
    <div className="graphInspector">
      <div className="findingMeta">
        <span>{selection.kind.toUpperCase()}</span>
        <strong>{selection.findings.length} linked findings</strong>
      </div>
      <h3>{selection.title}</h3>
      <p>{selection.subtitle}</p>
      {selection.healthScore ? (
        <div className="miniHealth">
          <strong>{selection.healthScore.score.toFixed(1)}</strong>
          <span>{selection.healthScore.grade} health</span>
        </div>
      ) : null}
      {selection.findings.length > 0 ? (
        <div className="linkedFindings">
          {selection.findings.slice(0, 4).map((finding) => (
            <span key={finding.id} className={`severity ${finding.severity.toLowerCase()}`}>{formatType(finding.type)}</span>
          ))}
        </div>
      ) : null}
      <details>
        <summary>Evidence properties</summary>
        <pre>{JSON.stringify(selection.properties, null, 2)}</pre>
      </details>
    </div>
  );
}

function DocumentationPortal({
  selectedDocSlug,
  docsQuery,
  docsCategory,
  onChangeQuery,
  onChangeCategory,
  onSelectDoc,
  onBackToAnalysis
}: {
  selectedDocSlug: string;
  docsQuery: string;
  docsCategory: string;
  onChangeQuery: (value: string) => void;
  onChangeCategory: (value: string) => void;
  onSelectDoc: (slug: string) => void;
  onBackToAnalysis: () => void;
}) {
  const filteredDocs = React.useMemo(() => docsByQuery(docsQuery, docsCategory), [docsCategory, docsQuery]);
  const selectedDoc = docBySlug(selectedDocSlug);
  const neighbors = docNeighbors(selectedDoc.slug);

  React.useEffect(() => {
    if (filteredDocs.length > 0 && !filteredDocs.some((doc) => doc.slug === selectedDocSlug)) {
      onSelectDoc(filteredDocs[0].slug);
    }
  }, [filteredDocs, onSelectDoc, selectedDocSlug]);

  return (
    <section className="docsPortal">
      <aside className="docsSidebar">
        <div className="docsSidebarHeader">
          <div>
            <div className="eyebrow">Documentation Portal</div>
            <h2>Learn MESA from inside the product</h2>
            <p>{`Search ${docsCatalog.length} pages covering guides, methodology, limitations, API notes, and evaluator walkthroughs.`}</p>
          </div>
          <button type="button" className="workflowToggle" onClick={onBackToAnalysis}>
            Back to analysis
          </button>
        </div>

        <div className="docsSearchPanel">
          <label htmlFor="docsQuery">Search docs</label>
          <input
            id="docsQuery"
            placeholder="Search guides, research, API docs..."
            value={docsQuery}
            onChange={(event) => onChangeQuery(event.target.value)}
          />
          <label htmlFor="docsCategory">Category</label>
          <select id="docsCategory" value={docsCategory} onChange={(event) => onChangeCategory(event.target.value)}>
            <option value="ALL">All categories</option>
            {docsCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>

        <div className="docsQuickLinks">
          <strong>Quick links</strong>
          <div className="docLinks">
            <DocLinkButton label="Evaluator quick start" onClick={() => onSelectDoc("evaluator-quick-start")} />
            <DocLinkButton label="User guide" onClick={() => onSelectDoc("user-guide")} />
            <DocLinkButton label="Demo guide" onClick={() => onSelectDoc("demo-guide")} />
          </div>
        </div>

        <nav className="docsNav" aria-label="Documentation navigation">
          {docsCategories.map((category) => {
            const docsInCategory = filteredDocs.filter((doc) => doc.category === category);
            if (docsInCategory.length === 0) return null;
            return (
              <section key={category} className="docsCategoryGroup">
                <h3>{category}</h3>
                {docsInCategory.map((doc) => (
                  <button
                    key={doc.slug}
                    type="button"
                    className={doc.slug === selectedDoc.slug ? "docsNavItem active" : "docsNavItem"}
                    onClick={() => onSelectDoc(doc.slug)}
                  >
                    <strong>{doc.title}</strong>
                    <span>{doc.summary}</span>
                  </button>
                ))}
              </section>
            );
          })}
        </nav>
      </aside>

      <article className="docsArticle">
        <div className="docsArticleHeader">
          <div>
            <div className="eyebrow">{selectedDoc.category}</div>
            <h1>{selectedDoc.title}</h1>
            <p>{selectedDoc.summary}</p>
          </div>
          <code>{selectedDoc.path.replace("../../docs/", "docs/")}</code>
        </div>

        <div className="docsTags">
          {selectedDoc.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>

        <div className="docsMarkdown">
          {renderMarkdown(selectedDoc.content)}
        </div>

        <div className="docsPager">
          <button type="button" className="docsPagerButton" onClick={() => neighbors.previous && onSelectDoc(neighbors.previous.slug)} disabled={!neighbors.previous}>
            {neighbors.previous ? `Previous: ${neighbors.previous.title}` : "No previous page"}
          </button>
          <button type="button" className="docsPagerButton" onClick={() => neighbors.next && onSelectDoc(neighbors.next.slug)} disabled={!neighbors.next}>
            {neighbors.next ? `Next: ${neighbors.next.title}` : "No next page"}
          </button>
        </div>
      </article>
    </section>
  );
}

function DocLinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="docLinkButton" onClick={onClick}>
      {label}
    </button>
  );
}

function AIExplainerPanel({
  activeScan,
  compareBaseScan,
  response,
  status,
  streamingAnswer,
  question,
  isLoading,
  isCheckingStatus,
  urgentFinding,
  systemScore,
  policyText,
  onQuestionChange,
  onAsk,
  onApplyPolicyDraft,
  onRefreshStatus,
  onOpenDoc
}: {
  activeScan: ScanRecord | null;
  compareBaseScan: ScanRecord | null;
  response: AIExplainerResponse | null;
  status: AIExplainerStatus | null;
  streamingAnswer: string;
  question: string;
  isLoading: boolean;
  isCheckingStatus: boolean;
  urgentFinding: Finding | null;
  systemScore: HealthScore | null;
  policyText: string;
  onQuestionChange: (value: string) => void;
  onAsk: (
    intent: AIExplainerIntent,
    options?: {
      question?: string;
      findingId?: string;
      baseScanId?: string;
      targetScanId?: string;
      docQuery?: string;
      scoreTarget?: string;
      serviceName?: string;
    }
  ) => void;
  onApplyPolicyDraft: (draft: string) => void;
  onRefreshStatus: () => void;
  onOpenDoc: (slug: string) => void;
}) {
  const answerProvider = aiAnswerProvider(response?.source);
  return (
    <section className="aiExplainerPanel">
      <div className="aiExplainerHeader">
        <div>
          <div className="eyebrow">AI Explainer</div>
          <h2>Ask MESA for grounded interpretation</h2>
          <p>
            This assistant explains scan results from deterministic findings, scores, scan history, and local
            documentation. It does not replace the detector.
          </p>
          <div className="docLinks">
            <DocLinkButton label="AI explainer guide" onClick={() => onOpenDoc("ai-explainer-guide")} />
            <DocLinkButton label="User guide" onClick={() => onOpenDoc("user-guide")} />
          </div>
        </div>
        <div className="aiStatusCard">
          <strong>{activeScan ? `Scan ${shortId(activeScan.id)}` : "No active scan"}</strong>
          <span>
            {response
              ? response.source.startsWith("openai-hybrid")
                ? "Live OpenAI hybrid response"
                : "Grounded MESA fallback response"
              : isLoading
                ? "Streaming response in progress"
                : "Waiting for a question"}
          </span>
          <button type="button" className="secondaryButton" onClick={onRefreshStatus} disabled={isCheckingStatus}>
            {isCheckingStatus ? "Checking..." : "Refresh AI Status"}
          </button>
        </div>
      </div>

      <div className="aiWorkspaceGrid">
        <div className="aiAskPane">
          <div className={`aiConnectionBanner ${status ? aiStatusTone(status.state) : "neutral"}`}>
            <strong>{status ? aiStatusLabel(status.state) : "AI status unavailable"}</strong>
            <span>{status?.message ?? "MESA could not load the AI configuration status right now."}</span>
            {status ? (
              <small>
                Mode: <code>{status.mode}</code> | Model: <code>{status.model}</code>
                {status.api_key_hint ? <> | Key: <code>{status.api_key_hint}</code></> : null}
              </small>
            ) : null}
          </div>

          <div className="aiPromptGrid">
            <button type="button" className="aiQuickAction" onClick={() => onAsk("SCAN_SUMMARY")} disabled={!activeScan || isLoading}>
              <strong>Summarize this scan</strong>
              <span>Get a short explanation of the overall result.</span>
            </button>
            <button type="button" className="aiQuickAction" onClick={() => onAsk("PRIORITIZE_FIXES", { question: "Explain simply what should be solved first." })} disabled={!activeScan || isLoading}>
              <strong>What should I fix first?</strong>
              <span>Prioritize the most important architecture issues.</span>
            </button>
            <button
              type="button"
              className="aiQuickAction"
              onClick={() => onAsk("FINDING_EXPLANATION", { findingId: urgentFinding?.id })}
              disabled={!activeScan || !urgentFinding || isLoading}
            >
              <strong>Explain the top finding</strong>
              <span>{urgentFinding ? summaryFindingTitle(urgentFinding) : "Available after a scan"}</span>
            </button>
            <button
              type="button"
              className="aiQuickAction"
              onClick={() => onAsk("HEALTH_SCORE_EXPLANATION", { scoreTarget: systemScore ? `system:${systemScore.target}` : "system" })}
              disabled={!activeScan || !systemScore || isLoading}
            >
              <strong>Explain the health score</strong>
              <span>{systemScore ? `${systemScore.score.toFixed(1)}/100 ${systemScore.grade}` : "Available after a scan"}</span>
            </button>
            <button
              type="button"
              className="aiQuickAction"
              onClick={() =>
                compareBaseScan &&
                onAsk("COMPARE_SCANS", { baseScanId: compareBaseScan.id, targetScanId: activeScan?.id })
              }
              disabled={!activeScan || !compareBaseScan || isLoading}
            >
              <strong>Compare with previous scan</strong>
              <span>{compareBaseScan ? `Against ${shortId(compareBaseScan.id)}` : "Need at least two scans"}</span>
            </button>
            <button type="button" className="aiQuickAction" onClick={() => onAsk("GOVERNANCE_POLICY_HELP")} disabled={!activeScan || isLoading}>
              <strong>Explain governance</strong>
              <span>Review active rules and policy violations.</span>
            </button>
            <button type="button" className="aiQuickAction" onClick={() => onAsk("POLICY_WRITING_ASSISTANCE")} disabled={!activeScan || isLoading}>
              <strong>Draft policy YAML</strong>
              <span>Suggest governance rules from the current scan.</span>
            </button>
            <button type="button" className="aiQuickAction" onClick={() => onAsk("DOC_QA", { question: "How do I use this tool?", docQuery: "How do I use this tool?" })} disabled={isLoading}>
              <strong>Ask from docs</strong>
              <span>Use in-product documentation as the answer source.</span>
            </button>
          </div>

          <div className="aiQuestionBar">
            <label htmlFor="aiQuestion">Custom question</label>
            <div className="aiQuestionControls">
              <input
                id="aiQuestion"
                placeholder="Example: Explain simply what should be solved first."
                value={question}
                onChange={(event) => onQuestionChange(event.target.value)}
              />
              <button
                type="button"
                onClick={() => onAsk(activeScan ? "AUTO" : "DOC_QA", { question, docQuery: question })}
                disabled={isLoading || !question.trim()}
              >
                {isLoading ? "Thinking..." : "Ask MESA"}
              </button>
            </div>
          </div>

          <div className="aiHelperCard">
            <strong>Current policy editor</strong>
            <span>{policyText.trim() ? "Policy YAML is loaded and ready for AI drafting help." : "No policy YAML loaded yet."}</span>
          </div>
        </div>

        {!response && !isLoading ? (
          <div className="aiEmptyState">
            Ask for a summary, fix priority, health explanation, scan comparison, or documentation help.
          </div>
        ) : (
          <div className="aiResponseCard">
          <div className="aiResponseHeader">
            <div>
              <div className="findingMeta">
                <span>{response?.source ?? "streaming"}</span>
                <strong className={`severity ${(response?.confidence ?? "MODERATE").toLowerCase()}`}>{response?.confidence ?? "MODERATE"}</strong>
              </div>
              <div className={`aiAnswerBadge ${answerProvider.tone}`}>
                {answerProvider.label}
              </div>
              <h3>{response?.title ?? "MESA is preparing the answer..."}</h3>
            </div>
            <span className="modePill">{(response?.intent ?? "AUTO").replace(/_/g, " ")}</span>
          </div>
            <p className="aiAnswer">{streamingAnswer || response?.answer || "Waiting for response..."}</p>

            {response?.policy_document ? (
              <div className="aiPolicyDraftCard">
                <div className="aiPolicyDraftHeader">
                  <strong>Suggested policy draft</strong>
                  <button type="button" className="aiDraftActionButton" onClick={() => onApplyPolicyDraft(response.policy_document ?? "")}>
                    Use this draft
                  </button>
                </div>
                <pre>{response.policy_document}</pre>
              </div>
            ) : null}

            {response?.evidence.length ? (
              <div className="aiEvidenceGrid">
                {response.evidence.map((item) => (
                  <article key={`${item.kind}-${item.pointer}-${item.label}`} className="aiEvidenceCard">
                    <small>{item.kind}</small>
                    <strong>{item.label}</strong>
                    <code>{item.pointer}</code>
                    <p>{renderHighlightedText(item.snippet)}</p>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="aiResponseColumns">
              <div>
                <strong>Suggestions</strong>
                {response?.suggestions.length ? (
                  <ul className="aiList">
                    {response.suggestions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <div className="emptyInline">No suggestions returned.</div>
                )}
              </div>
              <div>
                <strong>Limitations</strong>
                {response?.limitations.length ? (
                  <ul className="aiList">
                    {response.limitations.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <div className="emptyInline">No limitations returned.</div>
                )}
              </div>
            </div>

            {response?.follow_up_questions.length ? (
              <div className="aiFollowUps">
                <strong>Try next</strong>
                <div className="docLinks">
                  {response.follow_up_questions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="docLinkButton"
                      onClick={() => onAsk(activeScan ? "AUTO" : "DOC_QA", { question: item, docQuery: item })}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function FindingsDashboard({
  findings,
  filteredFindings,
  filters,
  filterOptions,
  interpretationMode,
  onFilterChange,
  onOpenDoc,
  onSelectFinding,
  onAskAI
}: {
  findings: Finding[];
  filteredFindings: Finding[];
  filters: Filters;
  filterOptions: { types: string[]; severities: string[]; services: string[] };
  interpretationMode: InterpretationMode;
  onFilterChange: (filters: Filters) => void;
  onOpenDoc: (slug: string) => void;
  onSelectFinding: (finding: Finding) => void;
  onAskAI: (finding: Finding) => void;
}) {
  return (
    <aside className="findings dashboardFindings">
      <div className="findingsHeader">
        <div className="findingsHeaderText">
          <h2>Findings Dashboard</h2>
          <p>{filteredFindings.length} of {findings.length} findings</p>
          <div className="docLinks">
            <DocLinkButton label="How to read findings" onClick={() => onOpenDoc("findings-guide")} />
          </div>
        </div>
        <span className="modePill">{interpretationMode === "beginner" ? "Plain-language view" : "Research detail view"}</span>
      </div>

      <div className="filters findingsFilters">
        <select value={filters.type} onChange={(event) => onFilterChange({ ...filters, type: event.target.value })}>
          <option value="ALL">All anti-patterns</option>
          {filterOptions.types.map((type) => <option key={type} value={type}>{formatType(type)}</option>)}
        </select>
        <select value={filters.severity} onChange={(event) => onFilterChange({ ...filters, severity: event.target.value })}>
          <option value="ALL">All severities</option>
          {filterOptions.severities.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
        </select>
        <select value={filters.service} onChange={(event) => onFilterChange({ ...filters, service: event.target.value })}>
          <option value="ALL">All services</option>
          {filterOptions.services.map((service) => <option key={service} value={service}>{service}</option>)}
        </select>
        <label className="confidenceFilter">
          <span>Min confidence {Math.round(filters.minConfidence * 100)}%</span>
          <input
            type="range"
            min="0"
            max="0.95"
            step="0.05"
            value={filters.minConfidence}
            onChange={(event) => onFilterChange({ ...filters, minConfidence: Number(event.target.value) })}
          />
        </label>
      </div>

      {findings.length === 0 ? <div className="emptyList">No findings for this scan.</div> : null}
      {findings.length > 0 && filteredFindings.length === 0 ? <div className="emptyList">No findings match these filters.</div> : null}

      {filteredFindings.length > 0 ? (
        <div className="findingsGrid">
          {filteredFindings.map((finding) => (
            <article key={finding.id} className="findingCard clickable" onClick={() => onSelectFinding(finding)}>
              <div className="findingMeta">
                <span>{interpretationMode === "research" ? finding.id : confidenceLabel(finding.confidence)}</span>
                <strong className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</strong>
              </div>
              <h3>{plainLanguageFindingTitle(finding)}</h3>
              {interpretationMode === "research" ? (
                <div className="technicalLabel">Detector: {formatType(finding.type)}</div>
              ) : null}
              <div className="serviceChips">
                {finding.services.map((service) => <span key={service}>{service}</span>)}
              </div>
              <p>{renderHighlightedText(finding.description)}</p>
              <div className="findingHighlights">
                <div>
                  <strong>Why it matters</strong>
                  <span>{findingWhyItMatters(finding)}</span>
                </div>
                <div>
                  <strong>Do first</strong>
                  <span>{recommendationPreview(finding)}</span>
                </div>
              </div>
              <small className="confidenceText">
                {confidenceLabel(finding.confidence)} confidence ({Math.round(finding.confidence * 100)}%)
              </small>
              <div className="findingActions" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="secondaryButton" onClick={() => onAskAI(finding)}>
                  Ask AI
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

function EvolutionPanel({ reports }: { reports: EvolutionReport[] }) {
  const latest = reports[reports.length - 1];
  return (
    <section className="evolutionPanel">
      <div className="panelHeader compact">
        <div>
          <h2>Architecture Evolution</h2>
          <p>Snapshot-to-snapshot architecture change tracking</p>
        </div>
        <span>{reports.length} comparisons</span>
      </div>
      {!latest ? <div className="emptyInline">Run at least two scans to see architecture evolution.</div> : null}
      {latest ? (
        <div className="evolutionGrid">
          <div className="evolutionPrimary">
            <div className="evolutionSummary">
              <div>
                <strong>{formatSigned(latest.score_trend.system_delta)}</strong>
                <span>System score delta</span>
              </div>
              <div>
                <strong>{formatSigned(latest.risk_trend.delta)}</strong>
                <span>Risk delta</span>
              </div>
              <div>
                <strong>{latest.new_dependencies.length}</strong>
                <span>New dependencies</span>
              </div>
              <div>
                <strong>{latest.new_cycles.length}</strong>
                <span>New cycles</span>
              </div>
            </div>
            <p className="evolutionSentence">{String(latest.architecture_change_summary.summary ?? "No summary available.")}</p>
            {latest.recommendations.length ? (
              <div className="evolutionRecommendations">
                <strong>Recommendation</strong>
                <span>{latest.recommendations[0]}</span>
              </div>
            ) : null}
          </div>

          <div className="evolutionSecondary">
            <div className="evolutionSecondaryHeader">
              <strong>Comparison History</strong>
              <span>{reports.length} snapshots</span>
            </div>
            <div className="evolutionTimeline">
              {reports.slice().reverse().map((report) => (
                <article key={`${report.base_scan_id}-${report.target_scan_id}`}>
                  <strong>{`${shortId(report.base_scan_id)} -> ${shortId(report.target_scan_id)}`}</strong>
                  <span>{report.risk_trend.new_risk_count ?? 0} new risks, {report.risk_trend.resolved_risk_count ?? 0} resolved</span>
                  <small>{formatSigned(report.score_trend.system_delta)} health</small>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RemediationRoadmapPanel({
  roadmap,
  isLoading,
  onOpenDoc
}: {
  roadmap: RemediationRoadmap | null;
  isLoading: boolean;
  onOpenDoc: (slug: string) => void;
}) {
  const actionById = React.useMemo(() => {
    const allActions = [
      ...(roadmap?.quick_wins ?? []),
      ...(roadmap?.medium_term_changes ?? []),
      ...(roadmap?.high_effort_refactors ?? [])
    ];
    return new Map(allActions.map((action) => [action.id, action]));
  }, [roadmap]);

  return (
    <section className="roadmapPanel">
      <div className="panelHeader compact">
        <div>
          <h2>Remediation Roadmap</h2>
          <p>One grouped plan that turns separate findings into a practical order of work.</p>
          <div className="docLinks">
            <DocLinkButton label="Roadmap guide" onClick={() => onOpenDoc("remediation-roadmap-guide")} />
          </div>
        </div>
        <span>
          {roadmap
            ? `${roadmap.suggested_order.length} actions`
            : isLoading
              ? "Building roadmap"
              : "No roadmap yet"}
        </span>
      </div>

      {isLoading ? <div className="emptyInline">Building the grouped remediation roadmap for this scan...</div> : null}
      {!isLoading && !roadmap ? <div className="emptyInline">Run or load a scan to generate the roadmap.</div> : null}

      {roadmap ? (
        <div className="roadmapLayout">
          <div className="roadmapTopline">
            <div className="roadmapSummaryCard">
              <strong>Roadmap summary</strong>
              <p>{roadmap.summary}</p>
            </div>
            <div className="roadmapStats">
              <div>
                <strong>{roadmap.quick_wins.length}</strong>
                <span>Quick wins</span>
              </div>
              <div>
                <strong>{roadmap.medium_term_changes.length}</strong>
                <span>Medium-term</span>
              </div>
              <div>
                <strong>{roadmap.high_effort_refactors.length}</strong>
                <span>High-effort</span>
              </div>
              <div>
                <strong>
                  {roadmap.system_health_score !== undefined && roadmap.system_health_score !== null
                    ? Math.round(roadmap.system_health_score)
                    : "--"}
                </strong>
                <span>System health</span>
              </div>
            </div>
          </div>

          <div className="roadmapGrid">
            <RoadmapBucketColumn
              title="Quick Wins"
              subtitle="Low-friction fixes that reduce noise and operational coupling first."
              actions={roadmap.quick_wins}
              tone="quick"
            />
            <RoadmapBucketColumn
              title="Medium-Term Changes"
              subtitle="Boundary improvements that make the architecture easier to work with."
              actions={roadmap.medium_term_changes}
              tone="medium"
            />
            <RoadmapBucketColumn
              title="High-Effort Refactors"
              subtitle="Deeper structural changes that reshape ownership or service boundaries."
              actions={roadmap.high_effort_refactors}
              tone="high"
            />
          </div>

          <div className="roadmapBottomGrid">
            <div className="roadmapOrderCard">
              <div className="roadmapSectionHeader">
                <strong>Suggested order</strong>
                <span>Follow this execution path</span>
              </div>
              <div className="roadmapOrderList">
                {roadmap.suggested_order.map((step) => (
                  <article key={step.action_id} className="roadmapOrderItem">
                    <div className="roadmapOrderBadge">{step.order}</div>
                    <div>
                      <strong>{step.title}</strong>
                      <small>{bucketLabel(step.bucket)}</small>
                      <p>{step.why_now}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="roadmapDependencyCard">
              <div className="roadmapSectionHeader">
                <strong>Dependencies</strong>
                <span>What should happen after what</span>
              </div>
              {roadmap.dependencies.length === 0 ? (
                <div className="emptyInline">No hard dependencies were detected between roadmap actions.</div>
              ) : (
                <div className="roadmapDependencyList">
                  {roadmap.dependencies.map((dependency) => (
                    <article key={`${dependency.action_id}-${dependency.depends_on}`} className="roadmapDependencyItem">
                      <strong>
                        {actionById.get(dependency.depends_on)?.title ?? dependency.depends_on}
                        {" -> "}
                        {actionById.get(dependency.action_id)?.title ?? dependency.action_id}
                      </strong>
                      <p>{dependency.reason}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RoadmapBucketColumn({
  title,
  subtitle,
  actions,
  tone
}: {
  title: string;
  subtitle: string;
  actions: RoadmapAction[];
  tone: "quick" | "medium" | "high";
}) {
  return (
    <section className={`roadmapColumn ${tone}`}>
      <div className="roadmapSectionHeader">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {actions.length === 0 ? <div className="emptyInline">No actions in this bucket for the current scan.</div> : null}
      {actions.length > 0 ? (
        <div className="roadmapActionList">
          {actions.map((action) => (
            <article key={action.id} className="roadmapActionCard">
              <div className="roadmapActionMeta">
                <span>{`#${action.priority_rank}`}</span>
                <strong>{Math.round(action.priority_score)}</strong>
              </div>
              <h3>{action.title}</h3>
              <p>{action.summary}</p>
              <div className="roadmapTagRow">
                <span>{action.estimated_difficulty}</span>
                {action.metrics.max_severity ? <span>{action.metrics.max_severity}</span> : null}
                <span>{`${action.related_findings.length} finding${action.related_findings.length === 1 ? "" : "s"}`}</span>
              </div>
              {action.affected_services.length > 0 ? (
                <div className="serviceChips compact">
                  {action.affected_services.map((service) => <span key={service}>{service}</span>)}
                </div>
              ) : null}
              <dl className="roadmapActionDetails">
                <div>
                  <dt>Benefit</dt>
                  <dd>{action.expected_benefit}</dd>
                </div>
                <div>
                  <dt>Why now</dt>
                  <dd>{action.suggested_order_reason}</dd>
                </div>
              </dl>
              {action.metrics.impacted_dimensions?.length ? (
                <div className="roadmapDimensions">
                  {action.metrics.impacted_dimensions.map((dimension) => <code key={dimension}>{formatType(dimension)}</code>)}
                </div>
              ) : null}
              {action.playbook ? <RefactoringPlaybookDetails playbook={action.playbook} /> : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RefactoringPlaybookDetails({ playbook }: { playbook: RefactoringPlaybook }) {
  return (
    <details className="playbookDetails">
      <summary>
        <span>Refactoring playbook</span>
        <small>{playbook.estimated_effort}</small>
      </summary>
      <div className="playbookBody">
        <div className="playbookBlock">
          <strong>Strategy</strong>
          <p>{playbook.recommended_strategy}</p>
        </div>
        <div className="playbookPhaseList">
          {playbook.phases.map((phase) => (
            <article key={phase.title} className="playbookPhase">
              <strong>{phase.title}</strong>
              <p>{phase.objective}</p>
              <ul>
                {phase.steps.map((step) => <li key={step}>{step}</li>)}
              </ul>
              {phase.verification_checks.length ? (
                <div className="playbookChecks">
                  {phase.verification_checks.map((check) => <span key={check}>{check}</span>)}
                </div>
              ) : null}
            </article>
          ))}
        </div>
        <div className="playbookGrid">
          <PlaybookList title="Verification" items={playbook.verification_checks} />
          <PlaybookList title="Rollback" items={playbook.rollback_plan} />
          <PlaybookList title="Risks" items={playbook.risks} />
        </div>
      </div>
    </details>
  );
}

function PlaybookList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) {
    return null;
  }
  return (
    <div className="playbookList">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function HealthScoreView({
  systemScore,
  serviceScores,
  onOpenDoc
}: {
  systemScore: HealthScore | null;
  serviceScores: HealthScore[];
  onOpenDoc: (slug: string) => void;
}) {
  const sortedServices = [...serviceScores].sort((a, b) => a.score - b.score).slice(0, 6);
  return (
    <section className="healthPanel">
      <div className="panelHeader compact">
        <div>
          <h2>Health Scores</h2>
          <p>Service, domain, and system-level architecture quality</p>
          <div className="docLinks">
            <DocLinkButton label="Health score guide" onClick={() => onOpenDoc("health-score-guide")} />
          </div>
        </div>
      </div>
      {!systemScore ? <div className="emptyList">No health score available yet.</div> : null}
      {systemScore ? (
        <div className={`systemScore ${gradeTone(systemScore.grade)}`}>
          <strong>{systemScore.score.toFixed(1)}</strong>
          <span>{systemScore.grade}</span>
          <p>{systemScore.explanation}</p>
        </div>
      ) : null}
      {systemScore ? <DimensionBars breakdown={systemScore.breakdown} /> : null}
      {sortedServices.length > 0 ? (
        <div className="serviceScores">
          <h3>Lowest Service Scores</h3>
          {sortedServices.map((score) => (
            <div key={score.target} className="scoreRow">
              <span>{score.target}</span>
              <meter min="0" max="100" value={score.score} />
              <strong>{score.score.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function bucketLabel(bucket: RoadmapBucket) {
  if (bucket === "quick_win") return "Quick win";
  if (bucket === "medium_term") return "Medium-term";
  return "High-effort";
}

function isPublicDemoProject(projectId: string) {
  return projectId === demoWorkspace.project.id;
}

function isDemoScan(scanId: string) {
  return demoWorkspace.scans.some((scan) => scan.id === scanId);
}

function demoPersistedScan(scanId: string): PersistedScanResult {
  const scan = demoWorkspace.scans.find((item) => item.id === scanId);
  const result = demoWorkspace.results[scanId as keyof typeof demoWorkspace.results];
  if (!scan || !result) {
    throw new Error("Demo scan payload is not available.");
  }
  return {
    scan: scan as unknown as ScanRecord,
    result: result as unknown as AnalysisResult
  };
}

function localDemoAIResponse({
  intent,
  question,
  activeScan,
  result,
  scores,
  compareBaseScan,
  roadmap,
  docQuery
}: {
  intent: AIExplainerIntent;
  question: string;
  activeScan: ScanRecord | null;
  result: AnalysisResult | null;
  scores: HealthScore[];
  compareBaseScan: ScanRecord | null;
  roadmap: RemediationRoadmap | null;
  docQuery?: string;
}): AIExplainerResponse {
  const resolvedIntent = intent === "AUTO" ? resolveDemoIntent(question, Boolean(result), Boolean(docQuery)) : intent;
  const urgentFinding = result ? getMostUrgentFinding(result.findings) : null;
  const systemScore = scores.find((score) => score.scope === "system") ?? result?.summary.health_scores?.system ?? null;

  if (resolvedIntent === "DOC_QA") {
    const docs = docsByQuery(docQuery || question, "ALL");
    const doc = docs[0] ?? docBySlug("public-demo-guide");
    return {
      intent: "DOC_QA",
      title: `Doc answer: ${doc.title}`,
      answer: `${doc.summary} Open the ${doc.title} page from the documentation workspace for the full step-by-step guide.`,
      evidence: [
        {
          kind: "doc",
          label: doc.title,
          pointer: doc.path.replace("../../docs/", "docs/"),
          snippet: doc.summary
        }
      ],
      suggestions: ["Open the full documentation page from inside MESA.", "Use the evaluator quick start if you are reviewing the demo."],
      follow_up_questions: ["How do I use this demo?", "What should I look at first in the results?"],
      limitations: ["This answer is from embedded documentation, not the live backend."],
      confidence: "HIGH",
      grounded: true,
      source: "mesa-public-demo-docs"
    };
  }

  if (!result || !activeScan) {
    return {
      intent: resolvedIntent,
      title: "Demo data not loaded",
      answer: "Load the embedded demo workspace first so MESA can show example results.",
      evidence: [],
      suggestions: ["Use the public demo workspace banner to load embedded examples."],
      follow_up_questions: ["How do I use this demo?"],
      limitations: ["No active demo scan was loaded."],
      confidence: "LOW",
      grounded: true,
      source: "mesa-public-demo"
    };
  }

  if (resolvedIntent === "PRIORITIZE_FIXES") {
    const firstAction = roadmap?.suggested_order[0];
    return {
      intent: "PRIORITIZE_FIXES",
      title: "Recommended fix order",
      answer: firstAction
        ? `Start with ${firstAction.title.toLowerCase()}. In this demo scan, that action comes first because it reduces immediate coupling and clears the path for the larger structural fixes that follow.`
        : `Start with ${summaryFindingTitle(urgentFinding ?? result.findings[0]).toLowerCase()}. This is the strongest signal in the current demo result.`,
      evidence: [
        {
          kind: "scan",
          label: "Demo scan",
          pointer: activeScan.id,
          snippet: `${result.summary.finding_count} findings across ${result.summary.service_count} services.`
        },
        ...(roadmap?.suggested_order[0]
          ? [
              {
                kind: "roadmap",
                label: "Suggested order",
                pointer: roadmap.suggested_order[0].action_id,
                snippet: roadmap.suggested_order[0].why_now
              }
            ]
          : [])
      ],
      suggestions: roadmap?.suggested_order.slice(0, 3).map((step) => step.title) ?? [recommendationPreview(urgentFinding ?? result.findings[0])],
      follow_up_questions: ["Explain the top finding.", "Why is the health score low?"],
      limitations: ["This answer is generated from embedded demo data, not from a live backend response."],
      confidence: "HIGH",
      grounded: true,
      source: "mesa-public-demo"
    };
  }

  if (resolvedIntent === "HEALTH_SCORE_EXPLANATION" && systemScore) {
    return {
      intent: "HEALTH_SCORE_EXPLANATION",
      title: "Demo health score explanation",
      answer: `${systemScore.target} is graded ${systemScore.grade.toLowerCase()} with a score of ${systemScore.score.toFixed(1)}/100. In this demo, the weakest areas are ${Object.entries(systemScore.breakdown)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .map(([dimension]) => formatType(dimension).toLowerCase())
        .join(", ")}.`,
      evidence: [
        {
          kind: "score",
          label: "System score",
          pointer: "health_scores.system",
          snippet: `${systemScore.score.toFixed(1)}/100 (${systemScore.grade})`
        }
      ],
      suggestions: systemScore.recommendations.slice(0, 3),
      follow_up_questions: ["What should I fix first?", "Show me the roadmap."],
      limitations: ["This explanation comes from embedded example results."],
      confidence: "HIGH",
      grounded: true,
      source: "mesa-public-demo"
    };
  }

  if (resolvedIntent === "COMPARE_SCANS" && compareBaseScan) {
    const latestReport = demoWorkspace.evolution[0];
    return {
      intent: "COMPARE_SCANS",
      title: "Demo comparison summary",
      answer: `Between ${shortId(compareBaseScan.id)} and ${shortId(activeScan.id)}, the example system added more services, more dependencies, and more risks. The later snapshot is more platform-centered and the overall health score dropped by ${latestReport.score_trend.system_delta}.`,
      evidence: [
        {
          kind: "comparison",
          label: "Architecture change summary",
          pointer: "architecture_change_summary.summary",
          snippet: String(latestReport.architecture_change_summary.summary)
        }
      ],
      suggestions: [...latestReport.recommendations],
      follow_up_questions: ["What should I fix first?", "Explain the roadmap order."],
      limitations: ["The comparison is between two embedded demo scans."],
      confidence: "HIGH",
      grounded: true,
      source: "mesa-public-demo"
    };
  }

  if (resolvedIntent === "POLICY_WRITING_ASSISTANCE") {
    return {
      intent: "POLICY_WRITING_ASSISTANCE",
      title: "Demo policy draft",
      answer: "This embedded demo suggests starting with rules for dependency cycles, hard-coded service URLs, and outbound dependency limits.",
      evidence: [
        {
          kind: "policy",
          label: "Current demo policy set",
          pointer: "policies",
          snippet: "The demo project already includes policies for cycles, hard-coded URLs, and outbound dependency limits."
        }
      ],
      suggestions: ["Save the current draft into a live project when the backend is available.", "Keep policy names simple and specific for evaluators."],
      follow_up_questions: ["Explain governance simply.", "What should I fix first?"],
      limitations: ["Draft generation is static in public demo mode."],
      policy_document: demoWorkspace.policyText,
      confidence: "MODERATE",
      grounded: true,
      source: "mesa-public-demo"
    };
  }

  const scanSummary = `This demo scan shows ${result.summary.finding_count} findings across ${result.summary.service_count} services. The most urgent area is ${summaryFindingTitle(urgentFinding ?? result.findings[0]).toLowerCase()}, and the roadmap is designed to show what should be cleaned up first versus what needs deeper refactoring.`;
  return {
    intent: resolvedIntent,
    title: "Demo scan summary",
    answer: scanSummary,
    evidence: [
      {
        kind: "scan",
        label: "Demo scan summary",
        pointer: activeScan.id,
        snippet: `${result.summary.finding_count} findings across ${result.summary.service_count} services.`
      },
      ...(urgentFinding
        ? [
            {
              kind: "finding",
              label: summaryFindingTitle(urgentFinding),
              pointer: urgentFinding.id,
              snippet: urgentFinding.description
            }
          ]
        : [])
    ],
    suggestions: roadmap?.suggested_order.slice(0, 3).map((step) => step.title) ?? ["Open the remediation roadmap.", "Inspect the architecture graph.", "Compare the two demo scans."],
    follow_up_questions: ["What should I fix first?", "Explain the health score.", "How do I use this demo?"],
    limitations: ["This answer comes from embedded example results and does not analyze your own repository."],
    confidence: "HIGH",
    grounded: true,
    source: "mesa-public-demo"
  };
}

function resolveDemoIntent(question: string, hasScan: boolean, hasDocQuery: boolean) {
  const normalized = `${question} ${hasDocQuery ? "doc" : ""}`.toLowerCase();
  if (normalized.includes("fix first") || normalized.includes("solve first") || normalized.includes("priority")) return "PRIORITIZE_FIXES";
  if (normalized.includes("health") || normalized.includes("score")) return "HEALTH_SCORE_EXPLANATION";
  if (normalized.includes("compare") || normalized.includes("changed")) return "COMPARE_SCANS";
  if (normalized.includes("policy") || normalized.includes("governance") || normalized.includes("yaml")) return "POLICY_WRITING_ASSISTANCE";
  if (normalized.includes("doc") || normalized.includes("guide") || normalized.includes("how do i") || normalized.includes("how to")) return "DOC_QA";
  return hasScan ? "SCAN_SUMMARY" : "DOC_QA";
}

function DimensionBars({ breakdown }: { breakdown: Record<string, number> }) {
  return (
    <div className="dimensionBars">
      {Object.entries(breakdown).map(([dimension, score]) => (
        <div key={dimension} className="dimensionRow">
          <span>{formatType(dimension)}</span>
          <div><i style={{ width: `${score}%` }} /></div>
          <strong>{Math.round(score)}</strong>
        </div>
      ))}
    </div>
  );
}

function RecommendationDetails({
  finding,
  interpretationMode
}: {
  finding: Finding;
  interpretationMode: InterpretationMode;
}) {
  const recommendation = finding.recommendations?.[0];
  if (!recommendation) {
    return (
      <section className="drawerSection recommendation">
        <h3>What to do first</h3>
        <p>{finding.recommendation}</p>
      </section>
    );
  }
  return (
    <section className="drawerSection recommendation structuredRecommendation">
      <div className="recommendationHeader">
        <strong>What to do first</strong>
        <span>{recommendation.priority} priority - {recommendation.estimated_difficulty} difficulty</span>
      </div>
      <dl>
        <dt>Likely root cause</dt>
        <dd>{recommendation.root_cause}</dd>
        <dt>Expected consequence if unchanged</dt>
        <dd>{recommendation.architectural_consequence}</dd>
        <dt>Expected impact after refactor</dt>
        <dd>{recommendation.expected_impact}</dd>
      </dl>
      {recommendation.affected_files.length > 0 ? (
        <div className="affectedFiles">
          <strong>Affected files</strong>
          {recommendation.affected_files.slice(0, 5).map((file) => <code key={file}>{file}</code>)}
        </div>
      ) : null}
      <strong>Suggested refactoring steps</strong>
      <ol>
        {recommendation.refactoring_steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      {interpretationMode === "research" ? <small>Recommendation source: {recommendation.source}</small> : null}
    </section>
  );
}

function FindingDrawer({
  finding,
  interpretationMode,
  onAskAI,
  onClose
}: {
  finding: Finding;
  interpretationMode: InterpretationMode;
  onAskAI: () => void;
  onClose: () => void;
}) {
  return (
    <div className="drawerOverlay" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <button className="drawerClose" onClick={onClose}>Close</button>
        <div className="findingMeta">
          <span>{finding.id}</span>
          <strong className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</strong>
        </div>
        <h2>{plainLanguageFindingTitle(finding)}</h2>
        <p className="drawerModeNote">
          {interpretationMode === "beginner"
            ? "Beginner mode focuses on the meaning of the result and the first actions to take."
            : "Research mode keeps the same interpretation but also shows raw detector evidence and technical labels."}
        </p>
        {interpretationMode === "research" ? (
          <div className="technicalLabel">Detector: {formatType(finding.type)}</div>
        ) : null}
        <div className="serviceChips">
          {finding.services.map((service) => <span key={service}>{service}</span>)}
        </div>
        <div className="drawerActionRow">
          <button type="button" className="secondaryButton" onClick={onAskAI}>Ask AI About This</button>
        </div>
        <section className="drawerSection">
          <h3>What MESA found</h3>
          <p>{finding.description}</p>
        </section>
        <section className="drawerSection">
          <h3>Why it matters</h3>
          <p>{findingWhyItMatters(finding)}</p>
        </section>
        <section className="drawerSection">
          <h3>Why MESA believes this</h3>
          <p>{finding.why_valid || "MESA attached structured detector evidence to support this finding."}</p>
          <div className="ledgerMetaGrid">
            <div>
              <span>Detector</span>
              <strong>{finding.detector_name || formatType(finding.type)}</strong>
            </div>
            <div>
              <span>Rule</span>
              <strong>{finding.rule_id || "Legacy finding"}</strong>
            </div>
          </div>
          {finding.evidence_chain && finding.evidence_chain.length > 0 ? (
            <ol className="evidenceChainList">
              {finding.evidence_chain.map((item, index) => (
                <li key={`${item.step}-${index}`}>
                  <strong>{formatType(item.step)}</strong>
                  <span>{item.description}</span>
                  {item.source ? (
                    <code>{item.source.file_path}{item.source.line_number ? `:${item.source.line_number}` : ""}</code>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <ul className="evidenceBulletList">
              {summarizeEvidence(finding.evidence).map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
          <small className="supportText">
            {confidenceLabel(finding.confidence)} confidence ({Math.round(finding.confidence * 100)}%). {finding.confidence_reason || confidenceGuidance(finding.confidence)}
          </small>
          {finding.source_files && finding.source_files.length > 0 ? (
            <div className="affectedFiles evidenceFiles">
              <strong>Source files</strong>
              {finding.source_files.slice(0, 6).map((file) => <code key={file}>{file}</code>)}
            </div>
          ) : null}
        </section>
        <RecommendationDetails finding={finding} interpretationMode={interpretationMode} />
        <section className="drawerSection">
          <h3>Expected impact</h3>
          <p>{recommendationImpact(finding)}</p>
        </section>
        <section className="drawerSection">
          <h3>What this does not prove</h3>
          {finding.limitations && finding.limitations.length > 0 ? (
            <ul className="evidenceBulletList">
              {finding.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
            </ul>
          ) : (
            <p>{findingLimitation(finding)}</p>
          )}
        </section>
        {interpretationMode === "research" ? (
          <section className="drawerSection">
            <h3>Raw evidence ledger</h3>
            <pre>{JSON.stringify({
              detector_name: finding.detector_name,
              rule_id: finding.rule_id,
              evidence_chain: finding.evidence_chain,
              source_files: finding.source_files,
              related_services: finding.related_services,
              evidence: finding.evidence
            }, null, 2)}</pre>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function buildGraphElements(nodes: GraphNode[], edges: AggregatedEdge[]) {
  const positions = calculateArchitecturePositions(nodes, edges);
  const degreeByNode = calculateDegrees(edges);
  const maxDegree = Math.max(0, ...degreeByNode.values());

  return [
    ...nodes.map((node) => {
      const degree = degreeByNode.get(node.id) ?? 0;
      return {
        data: {
          id: node.id,
          label: node.label ?? formatNodeLabel(node.id, node.type),
          type: node.type ?? "service",
          serviceName: node.serviceName ?? node.id,
          risk: node.risk ?? "none",
          findingCount: node.findingCount ?? 0,
          healthScore: node.healthScore ?? 0,
          properties: node.properties ?? {},
          role: degree === maxDegree && degree > 0 && node.type === "service" ? "hub" : "node",
          weight: Math.min(14, degree)
        },
        position: positions.get(node.id) ?? { x: 0, y: 0 }
      };
    }),
    ...edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type ?? "depends",
        risk: edge.risk ?? "none",
        findingCount: edge.findingCount ?? 0,
        evidence: edge.evidence ?? {},
        count: edge.count
      }
    }))
  ];
}

function calculateArchitecturePositions(nodes: GraphNode[], edges: AggregatedEdge[]) {
  const positions = new Map<string, { x: number; y: number }>();
  const serviceNodes = nodes.filter((node) => (node.type ?? "service") === "service").sort((a, b) => a.id.localeCompare(b.id));
  const serviceIds = serviceNodes.map((node) => node.id);
  const serviceIdByName = new Map(serviceNodes.map((node) => [node.serviceName ?? node.label ?? node.id, node.id]));
  const apiNodes = nodes.filter((node) => node.type === "api").sort((a, b) => a.id.localeCompare(b.id));
  const databaseNodes = nodes.filter((node) => node.type === "database").map((node) => node.id).sort();
  const supportNodes = nodes
    .filter((node) => !["service", "api", "database"].includes(node.type ?? "service"))
    .sort((a, b) => a.id.localeCompare(b.id));
  const degreeByNode = calculateDegrees(edges);
  const canvas = { width: 1420, height: 920 };
  const hub = [...serviceIds].sort((a, b) => {
    const degreeDelta = (degreeByNode.get(b) ?? 0) - (degreeByNode.get(a) ?? 0);
    return degreeDelta || a.localeCompare(b);
  })[0];

  if (!hub) return positions;

  const hubPosition = { x: canvas.width * 0.46, y: canvas.height * 0.52 };
  positions.set(hub, hubPosition);

  const inbound: string[] = [];
  const outbound: string[] = [];
  const satellites: string[] = [];

  for (const service of serviceIds.filter((item) => item !== hub)) {
    const callsHub = edges.some((edge) => edge.source === service && edge.target === hub);
    const calledByHub = edges.some((edge) => edge.source === hub && edge.target === service);
    if (callsHub && !calledByHub) {
      inbound.push(service);
    } else if (calledByHub) {
      outbound.push(service);
    } else {
      satellites.push(service);
    }
  }

  placeColumn(inbound.sort(), canvas.width * 0.16, 190, 700, positions);
  placeColumn(outbound.sort(), canvas.width * 0.82, 170, 750, positions);
  placeRow(satellites.sort(), canvas.width * 0.28, canvas.width * 0.68, 120, positions);

  const apisByService = groupNodesByService(apiNodes);
  for (const [service, apis] of apisByService) {
    const ownerPosition = positions.get(serviceIdByName.get(service) ?? service);
    if (!ownerPosition) continue;
    apis.forEach((api, index) => {
      positions.set(api.id, {
        x: clamp(ownerPosition.x + distribute(index, apis.length, -46, 46), 95, canvas.width - 95),
        y: clamp(ownerPosition.y - 112, 70, canvas.height - 115)
      });
    });
  }

  supportNodes.forEach((node, index) => {
    const ownerPosition = node.serviceName ? positions.get(serviceIdByName.get(node.serviceName) ?? node.serviceName) : null;
    positions.set(node.id, {
      x: ownerPosition ? clamp(ownerPosition.x - 120, 85, canvas.width - 85) : distribute(index, supportNodes.length, 130, canvas.width - 130),
      y: ownerPosition ? clamp(ownerPosition.y + 112, 110, canvas.height - 110) : canvas.height * 0.18
    });
  });

  const databaseOwners = new Map<string, string>();
  databaseNodes.forEach((database) => {
    const owner = ownerForDatabase(database, edges, nodes);
    if (owner) databaseOwners.set(database, owner);
  });

  databaseNodes.forEach((database, index) => {
    const owner = databaseOwners.get(database);
    const ownerPosition = owner ? positions.get(owner) : null;
    const fallbackX = distribute(index, databaseNodes.length, canvas.width * 0.2, canvas.width * 0.8);
    positions.set(database, {
      x: ownerPosition ? clamp(ownerPosition.x + 150, canvas.width * 0.12, canvas.width * 0.9) : fallbackX,
      y: ownerPosition ? clamp(ownerPosition.y + 155, canvas.height * 0.66, canvas.height * 0.92) : canvas.height * 0.84
    });
  });

  return positions;
}

function groupNodesByService(nodes: GraphNode[]) {
  const grouped = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const service = node.serviceName;
    if (!service) continue;
    grouped.set(service, [...(grouped.get(service) ?? []), node]);
  }
  return grouped;
}

function placeColumn(items: string[], x: number, yStart: number, yEnd: number, positions: Map<string, { x: number; y: number }>) {
  items.forEach((item, index) => {
    positions.set(item, { x, y: distribute(index, items.length, yStart, yEnd) });
  });
}

function placeRow(items: string[], xStart: number, xEnd: number, y: number, positions: Map<string, { x: number; y: number }>) {
  items.forEach((item, index) => {
    positions.set(item, { x: distribute(index, items.length, xStart, xEnd), y });
  });
}

function distribute(index: number, count: number, start: number, end: number) {
  if (count <= 1) return (start + end) / 2;
  return start + ((end - start) * index) / (count - 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function calculateDegrees(edges: AggregatedEdge[]) {
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + edge.count);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + edge.count);
  }
  return degrees;
}

function ownerForDatabase(database: string, edges: AggregatedEdge[], nodes: GraphNode[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const owners = edges
    .filter((edge) => edge.target === database || edge.source === database)
    .map((edge) => (edge.target === database ? edge.source : edge.target))
    .filter((nodeId) => nodeById.get(nodeId)?.type === "service");
  return owners.sort()[0];
}

function graphFromReport(result: AnalysisResult, scores: HealthScore[]): DisplayGraph {
  const nodes = result.graph.nodes.map((node) => {
    const type = node.type ?? "service";
    const serviceName = type === "service" ? node.id : node.serviceName;
    const linkedFindings = serviceName ? findingsForService(result.findings, serviceName) : [];
    const health = serviceName ? serviceHealthScore(scores, serviceName) : undefined;
    return {
      ...node,
      type,
      label: node.label ?? formatNodeLabel(node.id, type),
      serviceName,
      risk: riskFromFindings(linkedFindings, health),
      findingCount: linkedFindings.length,
      healthScore: health?.score,
      properties: { id: node.id, type }
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return {
    source: "scan-report",
    nodes,
    edges: result.graph.edges.map((edge) => enrichEdge(edge, result.findings, nodeById))
  };
}

function graphFromDigitalTwin(twin: DigitalTwinGraph, result: AnalysisResult, scores: HealthScore[]): DisplayGraph {
  const rawNodeById = new Map(twin.nodes.map((node) => [node.element_id, node]));
  const apiCountsByService = new Map<string, number>();
  const apiBundleByRawId = new Map<string, string>();
  const nodes: GraphNode[] = [];

  for (const rawNode of twin.nodes) {
    const type = primaryGraphType(rawNode.labels);
    const serviceName = serviceNameForNode(type, rawNode.properties);
    if (type === "api" && serviceName) {
      apiCountsByService.set(serviceName, (apiCountsByService.get(serviceName) ?? 0) + 1);
      apiBundleByRawId.set(rawNode.element_id, `api:${serviceName}`);
      continue;
    }
    const node = nodeFromDigitalTwin(rawNode, result.findings, scores);
    if (node) nodes.push(node);
  }

  for (const [serviceName, count] of apiCountsByService) {
    const linkedFindings = findingsForService(result.findings, serviceName);
    const health = serviceHealthScore(scores, serviceName);
    nodes.push({
      id: `api:${serviceName}`,
      type: "api",
      label: `APIs (${count})`,
      serviceName,
      risk: riskFromFindings(linkedFindings, health),
      findingCount: linkedFindings.length,
      healthScore: health?.score,
      properties: { service: serviceName, api_count: count }
    });
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = twin.relationships
    .map((relationship) => {
      const source = apiBundleByRawId.get(relationship.source) ?? relationship.source;
      const target = apiBundleByRawId.get(relationship.target) ?? relationship.target;
      const sourceRaw = rawNodeById.get(relationship.source);
      const targetRaw = rawNodeById.get(relationship.target);
      return {
        source,
        target,
        sourceRaw,
        targetRaw,
        relationship
      };
    })
    .filter((item) => item.source !== item.target && nodeById.has(item.source) && nodeById.has(item.target))
    .map((item) => enrichEdge({
      source: item.source,
      target: item.target,
      type: normalizeRelationshipType(item.relationship.type),
      evidence: {
        ...item.relationship.properties,
        source_node_type: item.sourceRaw ? primaryGraphType(item.sourceRaw.labels) : undefined,
        target_node_type: item.targetRaw ? primaryGraphType(item.targetRaw.labels) : undefined
      }
    }, result.findings, nodeById));
  return { source: "digital-twin", nodes, edges };
}

function nodeFromDigitalTwin(
  node: DigitalTwinGraph["nodes"][number],
  findings: Finding[],
  scores: HealthScore[]
): GraphNode | null {
  const type = primaryGraphType(node.labels);
  if (type === "project") return null;
  const serviceName = serviceNameForNode(type, node.properties);
  const label = labelForDigitalTwinNode(type, node.properties, node.element_id);
  const linkedFindings = serviceName ? findingsForService(findings, serviceName) : [];
  const health = serviceName ? serviceHealthScore(scores, serviceName) : undefined;
  return {
    id: node.element_id,
    type,
    label,
    serviceName,
    risk: riskFromFindings(linkedFindings, health),
    findingCount: linkedFindings.length,
    healthScore: health?.score,
    properties: node.properties
  };
}

function primaryGraphType(labels: string[]) {
  const label = labels.find((item) => item !== "ArchitectureNode") ?? labels[0] ?? "Service";
  const mapped: Record<string, string> = {
    Project: "project",
    Service: "service",
    API: "api",
    Database: "database",
    Config: "config",
    Library: "library",
    MessageBroker: "message_broker",
    EnvironmentVariable: "environment_variable"
  };
  return mapped[label] ?? label.toLowerCase();
}

function serviceNameForNode(type: string, properties: Record<string, unknown>) {
  if (type === "service") return propertyString(properties, "name");
  return propertyString(properties, "service") ?? propertyString(properties, "owner") ?? propertyString(properties, "service_name");
}

function labelForDigitalTwinNode(type: string, properties: Record<string, unknown>, fallback: string) {
  if (type === "api") {
    const method = propertyString(properties, "method");
    const path = propertyString(properties, "path") ?? propertyString(properties, "endpoint");
    return [method, path].filter(Boolean).join(" ") || "API";
  }
  if (type === "database") return databaseLabel(properties, fallback);
  if (type === "config") return propertyString(properties, "name") ?? propertyString(properties, "key") ?? "config";
  if (type === "library") return propertyString(properties, "name") ?? "library";
  if (type === "message_broker") return propertyString(properties, "name") ?? "broker";
  if (type === "environment_variable") return propertyString(properties, "name") ?? propertyString(properties, "key") ?? "env var";
  return propertyString(properties, "name") ?? propertyString(properties, "key") ?? formatNodeLabel(fallback, type);
}

function databaseLabel(properties: Record<string, unknown>, fallback: string) {
  const value = propertyString(properties, "database") ?? propertyString(properties, "name") ?? propertyString(properties, "url") ?? fallback;
  return value.replace(/^db:/, "").split("/").pop() ?? value;
}

function enrichEdge(edge: GraphEdge, findings: Finding[], nodeById: Map<string, GraphNode>): GraphEdge {
  const sourceNode = nodeById.get(edge.source);
  const targetNode = nodeById.get(edge.target);
  const sourceService = sourceNode?.serviceName ?? edge.source;
  const targetService = targetNode?.serviceName ?? edge.target;
  const linkedFindings = findingsForEdge(findings, sourceService, targetService, edge.type ?? "depends");
  return {
    ...edge,
    label: edge.label ?? formatEdgeLabel(edge.type ?? "depends", 1),
    risk: edgeRisk(edge.type ?? "depends", linkedFindings),
    findingCount: linkedFindings.length,
    evidence: edge.evidence ?? { source_location: edge.source_location }
  };
}

function findingsForService(findings: Finding[], service: string) {
  return findings.filter((finding) => finding.services.includes(service));
}

function findingsForEdge(findings: Finding[], sourceService: string, targetService: string, edgeType: string) {
  return findings.filter((finding) => {
    const hasBothServices = finding.services.includes(sourceService) && finding.services.includes(targetService);
    if (hasBothServices) return true;
    if (edgeType.includes("database")) return finding.type.includes("SHARED") || finding.type.includes("DATABASE");
    return false;
  });
}

function serviceHealthScore(scores: HealthScore[], service: string) {
  return scores.find((score) => score.scope === "service" && score.target === service);
}

function riskFromFindings(findings: Finding[], health?: HealthScore) {
  const highest = getHighestSeverity(findings);
  if (highest !== "None") return highest.toLowerCase();
  if (health && health.score < 40) return "high";
  if (health && health.score < 65) return "medium";
  return "none";
}

function edgeRisk(edgeType: string, findings: Finding[]) {
  if (findings.length > 0) return getHighestSeverity(findings).toLowerCase();
  if (["shared_database", "shares_database_with"].includes(edgeType)) return "high";
  if (["hard_coded_dependency", "hard_coded_service_dependency"].includes(edgeType)) return "medium";
  return "none";
}

function selectionForNode(data: Record<string, unknown>, findings: Finding[], scores: HealthScore[]): GraphSelection {
  const service = String(data.serviceName ?? data.id);
  const linkedFindings = findingsForService(findings, service);
  return {
    kind: "node",
    id: String(data.id),
    title: String(data.label ?? data.id),
    subtitle: `${formatType(String(data.type ?? "service"))}${service !== data.id ? ` owned by ${service}` : ""}`,
    properties: propertyRecord(data.properties),
    findings: linkedFindings,
    healthScore: serviceHealthScore(scores, service)
  };
}

function selectionForEdge(data: Record<string, unknown>, nodes: GraphNode[], findings: Finding[]): GraphSelection {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const source = nodeById.get(String(data.source));
  const target = nodeById.get(String(data.target));
  const sourceService = source?.serviceName ?? source?.label ?? String(data.source);
  const targetService = target?.serviceName ?? target?.label ?? String(data.target);
  const linkedFindings = findingsForEdge(findings, sourceService, targetService, String(data.type ?? "depends"));
  return {
    kind: "edge",
    id: String(data.id),
    title: `${source?.label ?? sourceService} -> ${target?.label ?? targetService}`,
    subtitle: formatType(String(data.type ?? "dependency")),
    properties: propertyRecord(data.evidence),
    findings: linkedFindings
  };
}

function propertyString(properties: Record<string, unknown>, key: string) {
  const value = properties[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function propertyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeRelationshipType(type: string) {
  return type.toLowerCase();
}

function renderMarkdown(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre key={`code-${index}`} className="docsCodeBlock">
          <code data-language={language || undefined}>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (/^###\s+/.test(line)) {
      blocks.push(<h3 key={`h3-${index}`}>{line.replace(/^###\s+/, "")}</h3>);
      index += 1;
      continue;
    }

    if (/^##\s+/.test(line)) {
      blocks.push(<h2 key={`h2-${index}`}>{line.replace(/^##\s+/, "")}</h2>);
      index += 1;
      continue;
    }

    if (/^#\s+/.test(line)) {
      blocks.push(<h1 key={`h1-${index}`}>{line.replace(/^#\s+/, "")}</h1>);
      index += 1;
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^-\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>)}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>)}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith("```") &&
      !/^#{1,3}\s+/.test(lines[index]) &&
      !/^- /.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(paragraphLines.join(" "))}</p>);
  }

  return blocks;
}

function renderInlineMarkdown(text: string) {
  const segments = text.split(/(`[^`]+`)/g);
  return segments.map((segment, index) => {
    if (segment.startsWith("`") && segment.endsWith("`")) {
      return <code key={`${segment}-${index}`}>{segment.slice(1, -1)}</code>;
    }
    return <React.Fragment key={`${segment}-${index}`}>{segment}</React.Fragment>;
  });
}

function Metric({
  label,
  value,
  tone,
  detail,
  kind = "summary",
  featured = false,
  wide = false,
  detailLines = 3,
  expandableDetail = false,
  fullDetail
}: {
  label: string;
  value: string | number;
  tone?: string;
  detail?: string;
  kind?: "number" | "status" | "service" | "summary";
  featured?: boolean;
  wide?: boolean;
  detailLines?: 2 | 3 | 4 | 5 | 6;
  expandableDetail?: boolean;
  fullDetail?: string;
}) {
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const valueLength = String(value).length;
  const valueClassName = [
    "metricValue",
    `metricValue-${kind}`,
    valueLength > 18 ? "long" : "",
    valueLength > 30 ? "xlong" : ""
  ].filter(Boolean).join(" ");
  return (
    <article
      className={`metric ${tone ?? ""} ${featured ? "featured" : ""} ${wide ? "wide" : ""}`}
      title={typeof value === "string" ? value : undefined}
    >
      {kind === "service" ? (
        <code className={valueClassName}>{value}</code>
      ) : (
        <strong className={valueClassName}>{value}</strong>
      )}
      <span>{label}</span>
      {detail ? <small className={`detailLines-${detailLines}`} title={detail}>{detail}</small> : null}
      {expandableDetail && fullDetail ? (
        <>
          <button
            type="button"
            className="metricMoreButton"
            onClick={() => setIsDetailOpen((current) => !current)}
            aria-expanded={isDetailOpen}
          >
            {isDetailOpen ? "Hide detail" : "See more"}
          </button>
          {isDetailOpen ? (
            <div className="metricPopover" role="dialog" aria-label={`${label} detail`}>
              <div className="metricPopoverHeader">
                <strong>{label}</strong>
                <button type="button" className="metricPopoverClose" onClick={() => setIsDetailOpen(false)}>
                  Close
                </button>
              </div>
              <div className="metricPopoverBody">
                <p>{fullDetail}</p>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function aggregateEdges(edges: GraphEdge[]): AggregatedEdge[] {
  const grouped = new Map<string, AggregatedEdge>();
  for (const edge of edges) {
    const type = edge.type ?? "depends";
    const key = `${edge.source}::${edge.target}::${type}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      existing.findingCount = Math.max(existing.findingCount ?? 0, edge.findingCount ?? 0);
      existing.risk = strongerRisk(existing.risk, edge.risk);
      existing.label = formatEdgeLabel(type, existing.count, existing.risk, existing.findingCount);
      continue;
    }
    grouped.set(key, {
      ...edge,
      id: key,
      count: 1,
      label: formatEdgeLabel(type, 1, edge.risk, edge.findingCount)
    });
  }
  return [...grouped.values()];
}

function filterFindings(findings: Finding[], filters: Filters) {
  return findings.filter((finding) => {
    if (filters.type !== "ALL" && finding.type !== filters.type) return false;
    if (filters.severity !== "ALL" && finding.severity !== filters.severity) return false;
    if (filters.service !== "ALL" && !finding.services.includes(filters.service)) return false;
    return finding.confidence >= filters.minConfidence;
  });
}

function buildFilterOptions(findings: Finding[]) {
  return {
    types: [...new Set(findings.map((finding) => finding.type))].sort(),
    severities: [...new Set(findings.map((finding) => finding.severity))].sort((a, b) => severityRank[b] - severityRank[a]),
    services: [...new Set(findings.flatMap((finding) => finding.services))].sort()
  };
}

function comparisonBaseScan(history: ScanRecord[], activeScanId: string) {
  const index = history.findIndex((scan) => scan.id === activeScanId);
  if (index === -1) return null;
  return history[index + 1] ?? history[index - 1] ?? null;
}

function aiStatusLabel(state: AIExplainerStatus["state"]) {
  return {
    GROUNDED_ONLY: "Grounded-only mode",
    MISSING_API_KEY: "Missing API key",
    PLACEHOLDER_API_KEY: "Placeholder API key",
    INVALID_API_KEY: "Invalid API key",
    MODEL_UNAVAILABLE: "Model unavailable",
    ACCESS_DENIED: "Access denied",
    CONNECTION_ERROR: "Connection problem",
    READY: "Live AI ready"
  }[state];
}

function aiStatusTone(state: AIExplainerStatus["state"]) {
  if (state === "READY") return "good";
  if (state === "GROUNDED_ONLY") return "neutral";
  if (state === "CONNECTION_ERROR" || state === "MODEL_UNAVAILABLE") return "medium";
  return "high";
}

function aiAnswerProvider(source?: string) {
  if (source?.startsWith("openai-hybrid")) {
    return { label: "Answered by OpenAI", tone: "good" };
  }
  if (source?.includes("fallback")) {
    return { label: "Answered by MESA fallback", tone: "high" };
  }
  return { label: "Answered by MESA", tone: "neutral" };
}

class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, message?: string) {
    super(message ?? `API returned ${status}`);
    this.status = status;
    this.detail = message ?? `API returned ${status}`;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const detail = await readApiErrorDetail(response);
    throw new ApiError(response.status, detail || `API returned ${response.status}`);
  }
  return (await response.json()) as T;
}

async function readApiErrorDetail(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json() as { detail?: unknown };
      if (typeof payload.detail === "string") return payload.detail;
      return JSON.stringify(payload);
    } catch {
      return `API returned ${response.status}`;
    }
  }
  return await response.text();
}

async function streamAIResponse(
  path: string,
  payload: Record<string, unknown>,
  onDelta: (chunk: string) => void
): Promise<AIExplainerResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok || !response.body) throw new Error(`API returned ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: AIExplainerResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const lines = rawEvent.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLine = lines.find((line) => line.startsWith("data:"));
      if (!eventLine || !dataLine) continue;
      const eventName = eventLine.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>;
      if (eventName === "delta" && typeof data.text === "string") {
        onDelta(data.text);
      }
      if (eventName === "done") {
        finalPayload = data as unknown as AIExplainerResponse;
      }
    }
  }

  if (!finalPayload) throw new Error("No final AI response was returned");
  return finalPayload;
}

function servicePathsFromText(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function policyDocumentFromRecords(policies: PolicyRecord[]) {
  const lines = ["policies:"];
  for (const policy of policies) {
    lines.push(`  - id: ${policy.id}`);
    lines.push(`    name: ${policy.name}`);
    lines.push(`    rule: ${policy.rule}`);
    lines.push(`    severity: ${policy.severity.toLowerCase()}`);
    lines.push(`    enabled: ${policy.enabled ? "true" : "false"}`);
    if (policy.description) lines.push(`    description: ${policy.description}`);
  }
  return lines.join("\n") + "\n";
}

function normalizeResearchRecordPayload(record: ResearchEvaluationRecord) {
  return {
    scan_id: record.scan_id ?? null,
    repo_name: record.repo_name,
    repo_url: emptyToNull(record.repo_url),
    commit_ref: emptyToNull(record.commit_ref),
    scan_date: emptyToNull(record.scan_date),
    project_type: emptyToNull(record.project_type),
    expected_services: record.expected_services ?? null,
    detected_services: record.detected_services,
    expected_patterns: emptyToNull(record.expected_patterns),
    detected_patterns: emptyToNull(record.detected_patterns),
    total_findings: record.total_findings,
    critical_findings: record.critical_findings,
    high_findings: record.high_findings,
    medium_findings: record.medium_findings,
    low_findings: record.low_findings,
    true_positives: record.true_positives ?? null,
    false_positives: record.false_positives ?? null,
    false_negatives: record.false_negatives ?? null,
    notes: emptyToNull(record.notes),
    limitations: emptyToNull(record.limitations),
    research_relevance: emptyToNull(record.research_relevance),
    suitable_for_report: record.suitable_for_report
  };
}

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function draftMetricPreview(record: ResearchEvaluationRecord) {
  const tp = record.true_positives;
  const fp = record.false_positives;
  const fn = record.false_negatives;
  if (tp === null || tp === undefined || fp === null || fp === undefined || fn === null || fn === undefined) {
    return { precision: null, recall: null, f1: null };
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn > 0 ? tp / (tp + fn) : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : null;
  return { precision, recall, f1 };
}

function averageMetric(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => typeof value === "number");
  if (usable.length === 0) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function formatMetricValue(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return value <= 1 ? value.toFixed(4) : String(value);
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readProjectIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("project") ?? "";
}

function readSectionFromUrl(): AppSection {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("section");
  const knownSections = new Set<AppSection>([
    "overview",
    "scan",
    "services",
    "findings",
    "graph",
    "history",
    "evolution",
    "roadmap",
    "ai",
    "evaluation",
    "policies",
    "docs"
  ]);
  return value && knownSections.has(value as AppSection) ? (value as AppSection) : "overview";
}

function syncAppStateToUrl(
  projectId: string,
  section: AppSection,
  historyMode: "push" | "replace" = "replace"
) {
  const url = new URL(window.location.href);
  if (projectId) {
    url.searchParams.set("project", projectId);
  } else {
    url.searchParams.delete("project");
  }
  if (section !== "overview") {
    url.searchParams.set("section", section);
  } else {
    url.searchParams.delete("section");
  }
  window.history[historyMode === "push" ? "pushState" : "replaceState"]({}, "", url);
}

function resolveProjectSelection(projects: ProjectRecord[], currentProjectId: string, preferredProjectId = "") {
  if (currentProjectId && projects.some((project) => project.id === currentProjectId)) {
    return currentProjectId;
  }
  if (preferredProjectId && projects.some((project) => project.id === preferredProjectId)) {
    return preferredProjectId;
  }
  return projects[0]?.id ?? "";
}

function isAbortError(caught: unknown) {
  return caught instanceof DOMException && caught.name === "AbortError";
}

function isNotFoundError(caught: unknown) {
  return caught instanceof ApiError && caught.status === 404;
}

function flattenScores(scores?: AnalysisResult["summary"]["health_scores"]): HealthScore[] {
  if (!scores) return [];
  return [scores.system, ...scores.domain, ...scores.service].filter(Boolean);
}

function formatEdgeLabel(type: string, count: number, risk = "none", findingCount = 0) {
  if (risk === "critical") return findingCount > 0 ? `${findingCount} risks` : "critical";
  if (risk === "high") return findingCount > 0 ? `${findingCount} risks` : "high risk";
  const compactLabels: Record<string, string> = {
    api_call: "api",
    calls: "call",
    depends_on: "depends",
    shared_database: "shared db",
    shares_database_with: "shared db",
    uses_database: "db",
    reads_from: "db read",
    writes_to: "db write"
  };
  const shouldLabel = ["shared_database", "shares_database_with", "uses_database", "reads_from", "writes_to"].includes(type) || count > 2;
  if (!shouldLabel) return "";
  const label = compactLabels[type] ?? type.replace(/_/g, " ");
  return count > 1 ? `${label} x${count}` : label;
}

function strongerRisk(current = "none", next = "none") {
  const rank: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  return (rank[next] ?? 0) > (rank[current] ?? 0) ? next : current;
}

function formatNodeLabel(id: string, type?: string) {
  if (type !== "database") return id;
  const database = id.split("/").pop()?.replace(/^db:/, "") ?? id.replace(/^db:/, "");
  return `${database} db`;
}

function plainLanguageFindingTitle(finding: Finding) {
  const titles: Record<string, string> = {
    GOD_SERVICE: "A service is doing too much",
    CHATTY_SERVICE: "Two services are talking too often",
    SHARED_DATABASE: "Multiple services rely on the same database",
    HARD_CODED_SERVICE_URL: "A service dependency is hard coded",
    DEPENDENCY_CYCLE: "Services depend on each other in a loop"
  };
  return titles[finding.type] ?? formatType(finding.type);
}

function summaryFindingTitle(finding: Finding) {
  const titles: Record<string, string> = {
    GOD_SERVICE: "Overloaded service",
    CHATTY_SERVICE: "Chatty service flow",
    SHARED_DATABASE: "Shared database risk",
    HARD_CODED_SERVICE_URL: "Hard-coded dependency",
    DEPENDENCY_CYCLE: "Dependency cycle",
    GOVERNANCE_POLICY_VIOLATION: "Policy violation"
  };
  return titles[finding.type] ?? plainLanguageFindingTitle(finding);
}

function compactMetricDetail(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function renderHighlightedText(text: string) {
  const parts = tokenizeHighlightedText(text);
  return parts.map((part, index) =>
    part.kind === "code" ? (
      <code key={`${part.value}-${index}`} className="inlineCode">
        {part.value}
      </code>
    ) : (
      <React.Fragment key={`${part.value}-${index}`}>{part.value}</React.Fragment>
    )
  );
}

function tokenizeHighlightedText(text: string) {
  const pattern = /(https?:\/\/[^\s)]+|\/[^\s,;]+|[a-z0-9]+(?:-[a-z0-9]+){1,}(?=[\s.,;:)])?)/gi;
  const parts: Array<{ kind: "text" | "code"; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const [raw] = match;
    const start = match.index;
    if (start > lastIndex) {
      parts.push({ kind: "text", value: text.slice(lastIndex, start) });
    }

    const trimmed = trimTrailingPunctuation(raw);
    const trailing = raw.slice(trimmed.length);
    parts.push({ kind: "code", value: trimmed });
    if (trailing) {
      parts.push({ kind: "text", value: trailing });
    }
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/[.,;:]+$/, "");
}

function findingWhyItMatters(finding: Finding) {
  if (finding.type.includes("GOD")) return "This service can become hard to change safely because too many responsibilities are concentrated in one place.";
  if (finding.type.includes("CHATTY")) return "Frequent cross-service calls can slow requests down and make failures spread more easily between services.";
  if (finding.type.includes("SHARED") || finding.type.includes("DATABASE")) return "Shared data ownership weakens service boundaries and makes independent releases more difficult.";
  if (finding.type.includes("HARD_CODED")) return "Hard-coded dependencies reduce portability and make environment changes or service moves more fragile.";
  if (finding.type.includes("CYCLE")) return "Dependency loops usually increase coupling and make it harder to isolate, test, and evolve services.";
  return "This finding suggests a structural risk that could reduce maintainability, clarity, or service independence.";
}

function findingLimitation(finding: Finding) {
  if (finding.type.includes("CHATTY")) return "This does not prove the calls are always bad. It indicates a pattern worth validating against traffic, latency, and business workflow needs.";
  if (finding.type.includes("SHARED") || finding.type.includes("DATABASE")) return "This does not prove the database schema is wrong. It highlights a likely ownership boundary that needs architectural review.";
  if (finding.type.includes("HARD_CODED")) return "This does not prove runtime failures are happening now. It shows a portability and maintainability risk in the current implementation.";
  if (finding.type.includes("GOD")) return "This does not prove the service is impossible to maintain. It signals that responsibility may be too concentrated and should be reviewed.";
  if (finding.type.includes("CYCLE")) return "This does not prove every dependency in the cycle is unnecessary. It shows a loop that deserves closer design analysis.";
  return "This result is evidence of a likely architectural issue, not a complete explanation of all runtime behavior.";
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.9) return "Very high";
  if (confidence >= 0.75) return "High";
  if (confidence >= 0.55) return "Moderate";
  return "Low";
}

function confidenceGuidance(confidence: number) {
  if (confidence >= 0.9) return "The detector found strong signals that consistently support this result.";
  if (confidence >= 0.75) return "The detector found several supporting signals, but human review is still useful before acting.";
  if (confidence >= 0.55) return "The result is plausible, though the evidence is lighter and should be reviewed carefully.";
  return "Treat this as an early signal that needs manual confirmation before making architectural changes.";
}

function recommendationPreview(finding: Finding) {
  const recommendation = finding.recommendations?.[0];
  if (recommendation?.refactoring_steps?.[0]) return recommendation.refactoring_steps[0];
  return finding.recommendation;
}

function recommendationImpact(finding: Finding) {
  const recommendation = finding.recommendations?.[0];
  if (recommendation?.expected_impact) return recommendation.expected_impact;
  return "Addressing this finding should reduce architectural risk and improve clarity of service boundaries.";
}

function summarizeEvidence(evidence: Array<Record<string, unknown>>) {
  if (evidence.length === 0) return ["No structured detector evidence was attached to this finding."];
  return evidence.slice(0, 4).map((record, index) => {
    const fragments = Object.entries(record)
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 3)
      .map(([key, value]) => `${formatType(key)}: ${String(value)}`);
    return fragments.length > 0 ? fragments.join(" | ") : `Evidence item ${index + 1} contains nested detector metadata.`;
  });
}

function getMostUrgentFinding(findings: Finding[]) {
  return [...findings].sort((left, right) => {
    const severityDelta = (severityRank[right.severity] ?? 0) - (severityRank[left.severity] ?? 0);
    if (severityDelta !== 0) return severityDelta;
    return right.confidence - left.confidence;
  })[0];
}

function getHotspotService(findings: Finding[], scores: HealthScore[]) {
  const serviceCounts = new Map<string, { count: number; severity: string; score?: number }>();
  findings.forEach((finding) => {
    finding.services.forEach((service) => {
      const current = serviceCounts.get(service) ?? { count: 0, severity: "low", score: serviceHealthScore(scores, service)?.score };
      const nextSeverity = (severityRank[finding.severity] ?? 0) > (severityRank[current.severity] ?? 0) ? finding.severity : current.severity;
      serviceCounts.set(service, {
        count: current.count + 1,
        severity: nextSeverity,
        score: current.score
      });
    });
  });
  const [service, meta] = [...serviceCounts.entries()].sort((left, right) => {
    const countDelta = right[1].count - left[1].count;
    if (countDelta !== 0) return countDelta;
    const severityDelta = (severityRank[right[1].severity] ?? 0) - (severityRank[left[1].severity] ?? 0);
    if (severityDelta !== 0) return severityDelta;
    return (left[1].score ?? 100) - (right[1].score ?? 100);
  })[0] ?? [];
  if (!service || !meta) return null;
  return {
    service,
    tone: meta.severity.toLowerCase(),
    detail: `${meta.count} linked findings${meta.score !== undefined ? `, health ${Math.round(meta.score)}` : ""}`
  };
}

function formatType(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}


function getHighestSeverity(findings: Finding[]) {
  if (findings.length === 0) return "None";
  return findings.reduce((highest, finding) => {
    return severityRank[finding.severity] > severityRank[highest] ? finding.severity : highest;
  }, findings[0].severity);
}

function gradeTone(grade: string) {
  if (grade === "Excellent" || grade === "Good") return "low";
  if (grade === "Moderate") return "medium";
  return "high";
}

function formatSigned(value?: number | null) {
  if (value === null || value === undefined) return "--";
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${Number(value).toFixed(1)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "No timestamp";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function messageFor(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

const graphStyle: Array<{ selector: string; style: Record<string, string | number> }> = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "background-color": "#2563eb",
      "border-color": "#bfdbfe",
      "border-width": 2,
      color: "#0f172a",
      "font-size": "9px",
      "font-weight": 800,
      "text-valign": "bottom",
      "text-halign": "center",
      "text-wrap": "wrap",
      "text-max-width": "92px",
      "text-margin-y": 8,
      "text-background-color": "#ffffff",
      "text-background-opacity": 0.9,
      "text-background-padding": "3px",
      "text-border-color": "#e2e8f0",
      "text-border-width": 1,
      "text-border-opacity": 0.9,
      width: "mapData(weight, 0, 14, 26, 42)",
      height: "mapData(weight, 0, 14, 26, 42)",
      "overlay-opacity": 0
    }
  },
  {
    selector: "node[role = 'hub']",
    style: {
      "background-color": "#1d4ed8",
      "border-color": "#93c5fd",
      "border-width": 4,
      width: "mapData(weight, 0, 14, 36, 50)",
      height: "mapData(weight, 0, 14, 36, 50)",
      "font-size": "10px"
    }
  },
  {
    selector: "node[type = 'api']",
    style: {
      "background-color": "#059669",
      "border-color": "#a7f3d0",
      shape: "diamond",
      width: 24,
      height: 24,
      "font-size": "8px",
      "text-max-width": "74px",
      color: "#065f46"
    }
  },
  {
    selector: "node[type = 'database']",
    style: {
      "background-color": "#7c3aed",
      "border-color": "#ddd6fe",
      shape: "round-rectangle",
      width: 38,
      height: 24,
      "font-size": "8px",
      "text-max-width": "72px",
      color: "#4c1d95"
    }
  },
  {
    selector: "node[type = 'config'], node[type = 'library'], node[type = 'message_broker'], node[type = 'environment_variable']",
    style: {
      "background-color": "#64748b",
      "border-color": "#cbd5e1",
      shape: "round-rectangle",
      width: 24,
      height: 18,
      "font-size": "0px",
      "text-opacity": 0,
      "text-max-width": "0px"
    }
  },
  {
    selector: "node[risk = 'critical']",
    style: {
      "border-color": "#dc2626",
      "border-width": 5
    }
  },
  {
    selector: "node[risk = 'high']",
    style: {
      "border-color": "#f97316",
      "border-width": 4
    }
  },
  {
    selector: "node[risk = 'medium']",
    style: {
      "border-color": "#f59e0b",
      "border-width": 4
    }
  },
  {
    selector: "edge",
    style: {
      label: "data(label)",
      width: "mapData(count, 1, 8, 0.8, 2.4)",
      "line-color": "#94a3b8",
      "target-arrow-color": "#94a3b8",
      "target-arrow-shape": "triangle",
      "target-arrow-scale": 0.65,
      "curve-style": "bezier",
      "control-point-step-size": 36,
      "font-size": "7px",
      "font-weight": 800,
      color: "#334155",
      "text-background-color": "#ffffff",
      "text-background-opacity": 0.95,
      "text-background-padding": "2px",
      "text-border-color": "#e2e8f0",
      "text-border-opacity": 1,
      "text-border-width": 1,
      "text-rotation": "none",
      opacity: 0.62
    }
  },
  {
    selector: "edge[type = 'exposes_api'], edge[type = 'consumes_api']",
    style: {
      "line-color": "#059669",
      "target-arrow-color": "#059669",
      "line-style": "dotted",
      opacity: 0.62
    }
  },
  {
    selector: "edge[type = 'uses_database'], edge[type = 'reads_from'], edge[type = 'writes_to'], edge[type = 'shared_database'], edge[type = 'shares_database_with']",
    style: {
      "line-color": "#7c3aed",
      "target-arrow-color": "#7c3aed",
      "line-style": "dashed"
    }
  },
  {
    selector: "edge[risk = 'critical']",
    style: {
      "line-color": "#dc2626",
      "target-arrow-color": "#dc2626",
      width: 2.8,
      opacity: 0.9
    }
  },
  {
    selector: "edge[risk = 'high']",
    style: {
      "line-color": "#f97316",
      "target-arrow-color": "#f97316",
      width: 2.5,
      opacity: 0.88
    }
  },
  {
    selector: "edge[risk = 'medium']",
    style: {
      "line-color": "#f59e0b",
      "target-arrow-color": "#f59e0b",
      width: 2.4
    }
  },
  {
    selector: ":selected",
    style: {
      "border-color": "#0f172a",
      "line-color": "#0f172a",
      "target-arrow-color": "#0f172a"
    }
  }
];

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
