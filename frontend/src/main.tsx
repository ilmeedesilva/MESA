import React from "react";
import ReactDOM from "react-dom/client";
import cytoscape from "cytoscape";
import { demoWorkspace } from "./demoData";
import { ApiError, api, messageFor, pollScanJob, streamAIResponse } from "./api";
import { DimensionBars, FindingDrawer } from "./FindingDrawer";
import { DocLinkButton } from "./DocLinkButton";
import { HealthScoreView, RemediationRoadmapPanel } from "./RemediationRoadmapPanel";
import { BenchmarksPanel } from "./BenchmarksPanel";
import { EvolutionPanel } from "./EvolutionPanel";
import { FindingsDashboard } from "./FindingsDashboard";
import { AIExplainerPanel } from "./AIExplainerPanel";
import { DocumentationPortal } from "./DocumentationPortal";
import { GraphInspector, PublicDemoBanner } from "./GraphInspector";
import { ResearchEvaluationPanel } from "./ResearchEvaluationPanel";
import {
  bucketLabel,
  demoPersistedScan,
  isDemoScan,
  isPublicDemoProject,
  localDemoAIResponse
} from "./demoMode";
import {
  Metric,
  aggregateEdges,
  aiAnswerProvider,
  aiStatusLabel,
  aiStatusTone,
  averageMetric,
  buildFilterOptions,
  buildGraphElements,
  calculateArchitecturePositions,
  calculateDegrees,
  clamp,
  compactMetricDetail,
  comparisonBaseScan,
  confidenceGuidance,
  confidenceLabel,
  databaseLabel,
  distribute,
  downloadTextFile,
  draftMetricPreview,
  edgeRisk,
  emptyToNull,
  enrichEdge,
  filterFindings,
  findingLimitation,
  findingWhyItMatters,
  findingsForEdge,
  findingsForService,
  flattenScores,
  formatDate,
  formatEdgeLabel,
  formatMetricValue,
  formatNodeLabel,
  formatSigned,
  formatType,
  getHighestSeverity,
  getHotspotService,
  getMostUrgentFinding,
  gradeTone,
  graphFromDigitalTwin,
  graphFromReport,
  graphRichnessScore,
  graphStyle,
  groupNodesByService,
  isAbortError,
  isNotFoundError,
  isRenderableGraph,
  labelForDigitalTwinNode,
  nodeFromDigitalTwin,
  normalizeRelationshipType,
  normalizeResearchRecordPayload,
  ownerForDatabase,
  placeColumn,
  placeRow,
  plainLanguageFindingTitle,
  policyDocumentFromRecords,
  preferredGraph,
  primaryGraphType,
  propertyRecord,
  propertyString,
  readProjectIdFromUrl,
  readSectionFromUrl,
  recommendationImpact,
  recommendationPreview,
  renderHighlightedText,
  renderInlineMarkdown,
  renderMarkdown,
  resolveProjectSelection,
  riskFromFindings,
  selectionForEdge,
  selectionForNode,
  serviceHealthScore,
  serviceNameForNode,
  servicePathsFromText,
  shortId,
  strongerRisk,
  summarizeEvidence,
  summaryFindingTitle,
  syncAppStateToUrl,
  tokenizeHighlightedText,
  trimTrailingPunctuation
} from "./viewHelpers";
import "./styles.css";

import type {
  AIExplainerEvidence,
  AIExplainerIntent,
  AIExplainerResponse,
  AIExplainerStatus,
  AggregatedEdge,
  AnalysisResult,
  ApiAvailability,
  AppSection,
  BenchmarkEvaluationReport,
  BenchmarkListing,
  BenchmarkMetrics,
  DigitalTwinGraph,
  DisplayGraph,
  EvidenceChainItem,
  EvolutionReport,
  Filters,
  Finding,
  FindingRecommendation,
  GraphEdge,
  GraphNode,
  GraphSelection,
  HealthScore,
  InterpretationMode,
  PersistedScanResult,
  PolicyRecord,
  ProjectListStatus,
  ProjectRecord,
  ProjectSetup,
  RefactoringPlaybook,
  RefactoringPlaybookPhase,
  RemediationRoadmap,
  RepoScanPreview,
  ResearchEvaluationDraft,
  ResearchEvaluationRecord,
  RoadmapAction,
  RoadmapBucket,
  RoadmapDependency,
  RoadmapPlanStep,
  ScanJobRecord,
  ScanRecord,
  ServiceDiscoveryCandidate,
  WorkflowStep
} from "./types";

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
      { id: "evaluation", label: "Evaluation", description: "Research evidence and validation" },
      { id: "benchmarks", label: "Benchmarks", description: "Ground-truth precision/recall/F1 against seeded and real repositories" }
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
  "findings",
  "graph",
  "history",
  "evolution",
  "roadmap",
  "ai",
  "evaluation"
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
  const sidebarToggleIntentRef = React.useRef<"auto" | "manual">("auto");
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
    syncAppStateToUrl(selectedProjectId, currentSection, "replace");
  }, [currentSection, selectedProjectId]);

  React.useEffect(() => {
    if (!selectedProjectId) {
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
      setHistory(demoWorkspace.scans as unknown as ScanRecord[]);
      setEvolution(demoWorkspace.evolution as unknown as EvolutionReport[]);
      setPolicyCount(demoWorkspace.policies.length);
      setPolicyText(demoWorkspace.policyText);
      if (!activeScan) {
        void loadScan(demoWorkspace.scans[0].id);
      }
      return;
    }
    void loadSelectedProjectState(selectedProjectId);
  }, [apiAvailability, isPublicDemoMode, selectedProjectId]);

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
    const handleResize = () => {
      const shouldCollapse = window.innerWidth < 1360;
      if (window.innerWidth < 1180) {
        setSidebarCollapsed(false);
        sidebarToggleIntentRef.current = "auto";
        return;
      }
      if (sidebarToggleIntentRef.current === "auto") {
        setSidebarCollapsed(shouldCollapse);
      }
    };
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
        const preferredScanId =
          activeScan && activeScan.project_id === projectId
            ? activeScan.id
            : undefined;
        const nextScan =
          (preferredScanId
            ? scans.find((scan) => scan.id === preferredScanId)
            : undefined) ?? scans[0];
        await loadScan(nextScan.id, { projectId, historyMode: "replace" });
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
      if (scans.length === 0) {
        setActiveScan(null);
        setResult(null);
        setDisplayGraph(null);
        setScores([]);
        setRoadmap(null);
        return;
      }
      if (activeScan?.project_id === projectId && scans.every((scan) => scan.id !== activeScan.id)) {
        await loadScan(scans[0].id, { projectId, historyMode: "replace" });
      }
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
        ? await (async () => {
            const job = await api<ScanJobRecord>(
              `/api/projects/${selectedProjectId}/repo-scans/async`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  source_type: sourceType,
                  location: sourceLocation,
                  ref: sourceType === "GITHUB_URL" ? sourceRef.trim() || undefined : undefined,
                  service_paths: selectedDiscoveryPaths
                })
              }
            );
            return pollScanJob(job.id);
          })()
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
      const reportGraph = graphFromReport(scanResult, currentScores);
      const twinGraph = graphFromDigitalTwin(twin, scanResult, currentScores);
      setDisplayGraph(preferredGraph(reportGraph, twinGraph));
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
  const activeSetupStepIndex = Math.max(0, workflowSteps.findIndex((step) => step.id === activeSetupStepId));
  const activeSetupStep = workflowSteps[activeSetupStepIndex] ?? workflowSteps[0];

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
    navigateToSection("scan");
  }

  function navigateToSection(section: AppSection, historyMode: "push" | "replace" = "push") {
    setCurrentSection(section);
    syncAppStateToUrl(selectedProjectId, section, historyMode);
  }

  function askAIAboutFinding(finding: Finding, question: string) {
    setAiQuestion(question);
    navigateToSection("ai");
    void requestAIExplanation("FINDING_EXPLANATION", {
      question,
      findingId: finding.id
    });
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
        <div className={showCreateProjectForm ? "projectStepLayout withCreatePanel" : "projectStepLayout"}>
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
            <div className="projectSelectionControls">
              <div className="projectSelectionField">
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
              </div>
              {selectedProject ? (
                <div className="selectedProjectSummary">
                  <strong>Selected</strong>
                  <span>{selectedProject.name}</span>
                  <small>{selectedProject.description || "Saved project ready to restore and rescan."}</small>
                </div>
              ) : null}
            </div>
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
        <div className="panelButtonRow sourceActionRow">
          <button className="secondaryButton" onClick={previewRepositorySource} disabled={isPreviewingRepo}>
            {isPreviewingRepo ? "Previewing..." : "Preview Discovery"}
          </button>
          <button
            type="button"
            onClick={() => focusWorkflowStep("review")}
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
            <button type="button" className="fullButton" onClick={() => focusWorkflowStep("policies")} disabled={selectedDiscoveryPaths.length === 0}>
              Continue to Policies
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
        <div className="panelButtonRow">
          <button type="button" onClick={() => focusWorkflowStep("source")}>
            Back to Source
          </button>
          <button type="button" className="secondaryButton" onClick={() => focusWorkflowStep("policies")} disabled={manualServicePaths.length === 0 && selectedDiscoveryPaths.length === 0}>
            Continue
          </button>
        </div>
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
          <button type="button" onClick={() => focusWorkflowStep("scan")} disabled={!selectedProject}>
            Go to Run Scan
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
        <div className="scanReadinessGrid">
          <div className="scanReadinessItem">
            <span>Project</span>
            <strong>{selectedProject?.name ?? "Not selected"}</strong>
          </div>
          <div className="scanReadinessItem">
            <span>Source</span>
            <strong>{sourceLocation.trim() ? sourceType : "Manual service list"}</strong>
          </div>
          <div className="scanReadinessItem">
            <span>Services</span>
            <strong>{String(selectedDiscoveryPaths.length || manualServicePaths.length || 0)}</strong>
          </div>
          <div className="scanReadinessItem">
            <span>Policies</span>
            <strong>{policyCount > 0 ? `${policyCount} saved` : "Optional"}</strong>
          </div>
        </div>
        <p className="hint">Run the current selection to generate findings, scores, history, and graph evidence.</p>
        <div className="panelButtonRow">
          <button type="button" className="secondaryButton" onClick={() => focusWorkflowStep("policies")} disabled={!selectedProject}>
            Back to Policies
          </button>
          <button onClick={runScan} disabled={isScanning || !selectedProject || usingEmbeddedDemo}>
            {isScanning ? "Scanning..." : repoPreview ? "Run Repo Scan" : "Run Scan"}
          </button>
        </div>
      </section>
    );
  }

  function renderInterpretationCard() {
    return (
      <section className="interpretationPanel globalInterpretationPanel">
        <div className="interpretationIntro">
          <div className="eyebrow">Global Interpretation Mode</div>
          <h2>Choose how MESA explains results everywhere</h2>
          <p>
            Switch between a guided plain-language view and a deeper research-oriented explanation. This applies across findings, drawers, AI prompts, and scan workspaces.
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

        <section className="workspaceSingleColumn">
          {renderHistoryPanel()}
        </section>
      </div>
    );
  }

  function renderScanWorkspace() {
    const stepContent = (() => {
      if (activeSetupStepId === "project") return renderProjectSelectionPanel();
      if (activeSetupStepId === "source") return renderSourceConfigurationPanel();
      if (activeSetupStepId === "review") return renderServicesPanel();
      if (activeSetupStepId === "policies") return renderPoliciesPanel();
      return renderRunScanPanel();
    })();

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
        </section>

        {showSetupWorkspace ? (
          <section className="workspaceSplit workspaceSplitWide scanWorkspaceLayout">
            <div className="workspaceStack">
              <section className="stepWorkspaceCard">
                <div className="stepWorkspaceHeader">
                  <div>
                    <div className="eyebrow">Step Workspace</div>
                    <h2>{activeSetupStep.label}</h2>
                    <p>{activeSetupStep.description}</p>
                  </div>
                  <div className="stepWorkspaceMeta">
                    <strong>{`Step ${activeSetupStepIndex + 1} of ${workflowSteps.length}`}</strong>
                    <span>{activeSetupStep.optional ? "Optional" : "Required"}</span>
                  </div>
                </div>
                {stepContent}
              </section>
            </div>
            <div className="workspaceStack">
              <section className="workspaceInfoCard scanChecklistCard">
                <div className="eyebrow">Workflow Snapshot</div>
                <h2>Keep everything in one scan workspace</h2>
                <p>
                  This flow now stays inside the scan tab. Move step by step here without being redirected into extra sections.
                </p>
                <div className="scanChecklist">
                  {workflowSteps.map((step, index) => (
                    <button
                      key={step.id}
                      type="button"
                      className={`scanChecklistItem ${step.id === activeSetupStepId ? "active" : ""} ${step.done ? "done" : ""}`}
                      onClick={() => focusWorkflowStep(step.id)}
                    >
                      <span>{`0${index + 1}`.slice(-2)}</span>
                      <strong>{step.label}</strong>
                      <small>{step.done ? "Ready" : step.optional ? "Optional" : "Pending"}</small>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </section>
        ) : null}
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
          askAIAboutFinding(
            finding,
            `Explain simply why ${plainLanguageFindingTitle(finding).toLowerCase()} should be reviewed.`
          );
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

  function renderGlobalScanHistoryRail() {
    if (!selectedProject || history.length === 0 || currentSection === "history" || currentSection === "docs") {
      return null;
    }
    return (
      <aside className="globalScanRail">
        <section className="globalScanRailCard">
          <div className="panelHeader compact">
            <h3>Recent Scans</h3>
            <button type="button" className="railLinkButton" onClick={() => navigateToSection("history")}>
              Full history
            </button>
          </div>
          <div className="globalScanRailList">
            {history.slice(0, 6).map((scan) => (
              <button
                key={scan.id}
                type="button"
                className={activeScan?.id === scan.id ? "globalScanItem active" : "globalScanItem"}
                onClick={() => void loadScan(scan.id, { projectId: selectedProjectId })}
                disabled={isLoadingScan}
              >
                <strong>{shortId(scan.id)}</strong>
                <span>{scan.finding_count} findings</span>
                <small>{formatDate(scan.completed_at ?? scan.created_at)}</small>
              </button>
            ))}
          </div>
        </section>
      </aside>
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
      case "benchmarks":
        return <BenchmarksPanel />;
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

  const globalScanHistoryRail = renderGlobalScanHistoryRail();

  return (
    <main className={sidebarCollapsed ? "appShell sidebarCollapsed" : "appShell"}>
      <aside className={sidebarCollapsed ? "appSidebar collapsed" : "appSidebar"}>
        <div className="appSidebarTop">
          <div className="appIdentity">
            {sidebarCollapsed ? (
              <div className="appIdentityMark" aria-label="MESA">
                M
              </div>
            ) : (
              <>
                <div className="eyebrow">Architecture Analyzer</div>
                <h1>MESA</h1>
                <p>Structured project selection, scanning, findings analysis, and research evidence in one workspace.</p>
              </>
            )}
          </div>
          <button
            type="button"
            className="sidebarToggle"
            onClick={() => {
              sidebarToggleIntentRef.current = "manual";
              setSidebarCollapsed((current) => !current);
            }}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span>{sidebarCollapsed ? ">" : "<"}</span>
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

        <section className={sidebarCollapsed ? "sidebarFooterAction collapsed" : "sidebarFooterAction"}>
          {!sidebarCollapsed ? (
            <>
              <div>
                <div className="eyebrow">Demo Workspace</div>
                <p>{isPublicDemoMode ? "You are browsing the embedded evaluator demo." : "Load the embedded public demo when you want a safe example project."}</p>
              </div>
              <button
                type="button"
                className={isPublicDemoMode ? "secondaryButton sidebarDemoButton" : "sidebarDemoButton"}
                onClick={() => {
                  if (isPublicDemoMode) {
                    leavePublicDemo();
                    return;
                  }
                  activatePublicDemo();
                }}
              >
                {isPublicDemoMode ? "Return to Live Workspace" : "Load Demo Workspace"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={isPublicDemoMode ? "secondaryButton sidebarDemoButton compact" : "sidebarDemoButton compact"}
              onClick={() => {
                if (isPublicDemoMode) {
                  leavePublicDemo();
                  return;
                }
                activatePublicDemo();
              }}
              title={isPublicDemoMode ? "Return to live workspace" : "Load demo workspace"}
            >
              Demo
            </button>
          )}
        </section>
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
          </div>
        </header>

        <PublicDemoBanner
          apiAvailability={apiAvailability}
          isPublicDemoMode={isPublicDemoMode}
          usingEmbeddedDemo={usingEmbeddedDemo}
          onOpenDoc={openDoc}
        />

        <section className="globalControlBar">
          {renderInterpretationCard()}
        </section>

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

          <div className={globalScanHistoryRail ? "workspaceBody workspaceBodyWithRail" : "workspaceBody"}>
            <div className="workspacePrimaryContent">
              {renderSectionContent()}
            </div>
            {globalScanHistoryRail}
          </div>
        </section>
      </div>

      {selectedFinding ? (
        <FindingDrawer
          finding={selectedFinding}
          interpretationMode={interpretationMode}
          onAskAI={() => {
            askAIAboutFinding(
              selectedFinding,
              `Explain simply what to solve first about ${plainLanguageFindingTitle(selectedFinding).toLowerCase()}.`
            );
          }}
          onClose={() => setSelectedFinding(null)}
        />
      ) : null}
    </main>
  );
}












ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
