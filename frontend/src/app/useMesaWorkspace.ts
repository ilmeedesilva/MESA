import React from "react";
import { demoWorkspace } from "../demoData";
import { readStoredInterpretationMode, storeInterpretationMode } from "./interpretationMode";
import { ApiError, api, messageFor, pollScanJob, streamAIResponse } from "../api";
import { demoPersistedScan, isDemoScan, isPublicDemoProject, localDemoAIResponse } from "../demoMode";
import {
  buildFilterOptions,
  comparisonBaseScan,
  downloadTextFile,
  filterFindings,
  flattenScores,
  formatDate,
  getHighestSeverity,
  getHotspotService,
  getMostUrgentFinding,
  graphFromDigitalTwin,
  graphFromReport,
  isAbortError,
  isNotFoundError,
  normalizeResearchRecordPayload,
  policyDocumentFromRecords,
  preferredGraph,
  readProjectIdFromUrl,
  resolveProjectSelection,
  servicePathsFromText
} from "../viewHelpers";
import { useEffectEvent } from "../hooks/useEffectEvent";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { defaultPaths, defaultPolicyDocument } from "./defaults";
import { navigationItems, sectionsRequiringProject } from "./navigation";
import { readRoute, writeUrl, type Route } from "./router";
import type {
  AIExplainerIntent,
  AIExplainerResponse,
  AIExplainerStatus,
  AnalysisResult,
  ApiAvailability,
  AppSection,
  DigitalTwinGraph,
  DisplayGraph,
  EvolutionReport,
  Filters,
  Finding,
  GraphSelection,
  HealthScore,
  InterpretationMode,
  PersistedScanResult,
  PolicyRecord,
  ProjectListStatus,
  ProjectRecord,
  ProjectSetup,
  RemediationRoadmap,
  RepoScanPreview,
  ResearchEvaluationRecord,
  ScanJobRecord,
  ScanRecord,
  WorkflowStep
} from "../types";

/**
 * All state, data loading and actions for the MESA workspace. The App component
 * renders the layout and pages from what this hook returns.
 */
export function useMesaWorkspace() {
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
  // The route the page was opened with (hash, or the old ?section= parameter).
  const [initialRoute] = React.useState<Route>(() => readRoute());
  // The open finding is kept by ID and looked up in the current scan. A finding from a link
  // waits as "pending" until a scan has loaded.
  const [selectedFindingId, setSelectedFindingId] = React.useState<string | null>(null);
  const [pendingFindingId, setPendingFindingId] = React.useState<string | null>(initialRoute.findingId ?? null);
  const [selectedGraphElement, setSelectedGraphElement] = React.useState<GraphSelection | null>(null);
  const [interpretationMode, setInterpretationModeState] =
    React.useState<InterpretationMode>(readStoredInterpretationMode);
  const setInterpretationMode = React.useCallback((mode: InterpretationMode) => {
    setInterpretationModeState(mode);
    storeInterpretationMode(mode);
  }, []);
  const [showSetupWorkspace, setShowSetupWorkspace] = React.useState(true);
  const [hasAutoCollapsedSetup, setHasAutoCollapsedSetup] = React.useState(false);
  const [activeSetupStepId, setActiveSetupStepId] = React.useState<WorkflowStep["id"]>("project");
  const [currentSection, setCurrentSection] = React.useState<AppSection>(initialRoute.section);
  const [apiAvailability, setApiAvailability] = React.useState<ApiAvailability>("checking");
  const [isPublicDemoMode, setIsPublicDemoMode] = React.useState(false);
  const [isLoadingProjectState, setIsLoadingProjectState] = React.useState(false);
  const [aiQuestion, setAiQuestion] = React.useState("");
  const [aiResponse, setAiResponse] = React.useState<AIExplainerResponse | null>(null);
  const [isExplaining, setIsExplaining] = React.useState(false);
  const [streamingAnswer, setStreamingAnswer] = React.useState("");
  const [aiStatus, setAiStatus] = React.useState<AIExplainerStatus | null>(null);
  const [isCheckingAIStatus, setIsCheckingAIStatus] = React.useState(false);
  const [selectedDocSlug, setSelectedDocSlug] = React.useState(initialRoute.docSlug ?? "evaluator-quick-start");
  const [docsQuery, setDocsQuery] = React.useState("");
  const [docsCategory, setDocsCategory] = React.useState("ALL");
  const [filters, setFilters] = React.useState<Filters>({
    type: "ALL",
    severity: "ALL",
    service: "ALL",
    minConfidence: 0
  });
  const initialProjectIdRef = React.useRef(readProjectIdFromUrl());
  const projectListRequestRef = React.useRef(0);
  const projectStateRequestRef = React.useRef(0);
  const scanRequestRef = React.useRef(0);
  // The sidebar collapses by itself on narrower desktops unless the user expanded or collapsed
  // it. That choice is kept when the window is resized.
  // Layout by width: phone (menu button and slide-in sidebar), tablet (icon rail whose toggle
  // opens the full sidebar over the page) and desktop (sidebar, or the rail on narrower desktops).
  const [sidebarPreference, setSidebarPreference] = React.useState<"auto" | "expanded" | "collapsed">("auto");
  const isPhone = useMediaQuery("(max-width: 767.98px)");
  const isDesktop = useMediaQuery("(min-width: 1200px)");
  const isWideDesktop = useMediaQuery("(min-width: 1360px)");
  const layoutMode: "phone" | "tablet" | "desktop" = isPhone ? "phone" : isDesktop ? "desktop" : "tablet";
  const sidebarCollapsed =
    layoutMode === "tablet"
      ? true
      : layoutMode === "phone"
        ? false
        : sidebarPreference === "auto"
          ? !isWideDesktop
          : sidebarPreference === "collapsed";
  // The phone menu or the tablet overlay sidebar.
  const [navOpen, setNavOpen] = React.useState(false);
  React.useEffect(() => {
    setNavOpen(false);
  }, [layoutMode]);
  const projectStateAbortRef = React.useRef<AbortController | null>(null);
  const scanAbortRef = React.useRef<AbortController | null>(null);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const manualServicePaths = React.useMemo(() => servicePathsFromText(paths), [paths]);

  const selectedFinding =
    (selectedFindingId && result?.findings.find((finding) => finding.id === selectedFindingId)) || null;

  // The route shown in the address bar. A pending finding stays in it until its scan loads.
  const currentRoute = React.useMemo<Route>(
    () => ({
      section: currentSection,
      findingId: currentSection === "findings" ? (selectedFindingId ?? pendingFindingId ?? undefined) : undefined,
      docSlug: currentSection === "docs" ? selectedDocSlug : undefined
    }),
    [currentSection, pendingFindingId, selectedDocSlug, selectedFindingId]
  );

  // Keep the address bar in step with the state; navigation actions push their own entries.
  React.useEffect(() => {
    writeUrl(selectedProjectId, currentRoute, "replace");
  }, [currentRoute, selectedProjectId]);

  // Open a finding from a link once a scan with that finding has loaded.
  React.useEffect(() => {
    if (!pendingFindingId || !result) return;
    if (result.findings.some((finding) => finding.id === pendingFindingId)) setSelectedFindingId(pendingFindingId);
    setPendingFindingId(null);
  }, [pendingFindingId, result]);

  // Back, forward and edits to the hash: show the page the URL describes. In the embedded
  // demo the project is fixed, so only the page changes.
  const applyLocation = useEffectEvent(() => {
    const route = readRoute();
    if (!(isPublicDemoMode && apiAvailability !== "online")) setSelectedProjectId(readProjectIdFromUrl());
    setCurrentSection(route.section);
    if (route.docSlug) setSelectedDocSlug(route.docSlug);
    if (!route.findingId) {
      setSelectedFindingId(null);
      setPendingFindingId(null);
    } else if (result?.findings.some((finding) => finding.id === route.findingId)) {
      setSelectedFindingId(route.findingId);
    } else {
      setSelectedFindingId(null);
      setPendingFindingId(route.findingId);
    }
  });
  React.useEffect(() => {
    const handleLocationChange = () => applyLocation();
    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, [applyLocation]);

  // Runs when the selected project, demo mode or API availability changes.
  const syncSelectedProjectState = useEffectEvent(() => {
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
  });
  React.useEffect(() => {
    syncSelectedProjectState();
  }, [apiAvailability, isPublicDemoMode, selectedProjectId, syncSelectedProjectState]);

  // Once on start: AI status and research records, then the API health probe.
  const loadInitialData = useEffectEvent(() => {
    void loadAIStatus();
    void loadResearchRecords();
  });
  React.useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const probeApiOnStart = useEffectEvent(() => {
    void probeApiAvailability();
  });
  React.useEffect(() => {
    probeApiOnStart();
  }, [probeApiOnStart]);

  // Load the project list whenever the live API becomes the data source.
  const loadProjectsForLiveApi = useEffectEvent(() => {
    if (apiAvailability !== "online" || isPublicDemoMode) return;
    void loadProjects();
  });
  React.useEffect(() => {
    loadProjectsForLiveApi();
  }, [apiAvailability, isPublicDemoMode, loadProjectsForLiveApi]);

  // Refresh research records each time the Evaluation section is opened.
  const refreshResearchRecordsForSection = useEffectEvent(() => {
    if (currentSection === "evaluation") void loadResearchRecords();
  });
  React.useEffect(() => {
    refreshResearchRecordsForSection();
  }, [currentSection, refreshResearchRecordsForSection]);

  const filteredFindings = React.useMemo(() => filterFindings(result?.findings ?? [], filters), [filters, result]);

  const filterOptions = React.useMemo(() => buildFilterOptions(result?.findings ?? []), [result]);

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
    setSelectedFindingId(null);
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
    writeUrl(projectId, { ...currentRoute, findingId: undefined }, historyMode);
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
        writeUrl("", { ...currentRoute, findingId: undefined }, options?.historyMode ?? "replace");
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
        const preferredScanId = activeScan && activeScan.project_id === projectId ? activeScan.id : undefined;
        const nextScan = (preferredScanId ? scans.find((scan) => scan.id === preferredScanId) : undefined) ?? scans[0];
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
      setError("You are viewing demo data. Start the full backend stack to run live scans.");
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
            const job = await api<ScanJobRecord>(`/api/projects/${selectedProjectId}/repo-scans/async`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                source_type: sourceType,
                location: sourceLocation,
                ref: sourceType === "GITHUB_URL" ? sourceRef.trim() || undefined : undefined,
                service_paths: selectedDiscoveryPaths
              })
            });
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
      setSelectedFindingId(null);
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
      setError("Repository preview needs the live backend. The demo data only includes example scans.");
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
      const selectedPaths = preview.discovered_services
        .filter((candidate) => candidate.selected_by_default)
        .map((candidate) => candidate.relative_path);
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
      current.includes(relativePath) ? current.filter((path) => path !== relativePath) : [...current, relativePath]
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
      setRoadmap(
        demoWorkspace.roadmaps[scanId as keyof typeof demoWorkspace.roadmaps] as unknown as RemediationRoadmap
      );
      setSelectedFindingId(null);
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
      setSelectedFindingId(null);
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
      setRoadmap(
        demoWorkspace.roadmaps[scanId as keyof typeof demoWorkspace.roadmaps] as unknown as RemediationRoadmap
      );
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
      setError("Research records need the live backend. The demo data only includes example scans.");
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
      setResearchRecords((current) => current.map((item) => (item.id === updated.id ? updated : item)));
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
      setSelectedResearchRecordId((current) => (current === recordId ? "" : current));
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
            ? (response.policy_document ?? current)
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
            ? (response.policy_document ?? current)
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
        message: "Showing demo data without a live backend."
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
  const workflowSteps = React.useMemo<WorkflowStep[]>(
    () => [
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
    ],
    [hasProject, hasSourceConfigured, hasServiceSelection, hasSavedPolicies, hasCompletedScan]
  );
  const pendingWorkflowSteps = workflowSteps.filter((step) => !step.done);
  const activeWorkflowStep =
    workflowSteps.find((step) => step.active) ?? pendingWorkflowSteps[0] ?? workflowSteps[workflowSteps.length - 1];
  const activeSetupStepIndex = Math.max(
    0,
    workflowSteps.findIndex((step) => step.id === activeSetupStepId)
  );
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
    setSelectedFindingId(null);
    setPendingFindingId(null);
    writeUrl(selectedProjectId, { section, docSlug: section === "docs" ? selectedDocSlug : undefined }, historyMode);
  }

  /** Opens a finding in the drawer, with its own URL (#/findings/<id>). */
  function openFinding(findingId: string) {
    const mode = selectedFindingId ? "replace" : "push";
    setCurrentSection("findings");
    setSelectedFindingId(findingId);
    setPendingFindingId(null);
    writeUrl(selectedProjectId, { section: "findings", findingId }, mode, { mesaFindingOpenedInApp: true });
  }

  /** Closes the drawer. If the finding was opened in the app, go back so history has no extra entry. */
  function closeFinding() {
    const state = window.history.state as { mesaFindingOpenedInApp?: boolean } | null;
    if (state?.mesaFindingOpenedInApp) {
      window.history.back();
      return;
    }
    setSelectedFindingId(null);
    setPendingFindingId(null);
  }

  /** Shows a documentation page; "replace" is used when the docs list picks a page by itself. */
  function selectDoc(slug: string, historyMode: "push" | "replace" = "push") {
    setSelectedDocSlug(slug);
    writeUrl(selectedProjectId, { section: "docs", docSlug: slug }, historyMode);
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
    setCurrentSection("docs");
    setSelectedFindingId(null);
    setPendingFindingId(null);
    writeUrl(selectedProjectId, { section: "docs", docSlug: slug }, "push");
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
  const currentSectionMeta = navigationItems.find((item) => item.id === currentSection) ?? navigationItems[0];
  const sectionNeedsProject = sectionsRequiringProject.has(currentSection);
  const sourceLabel = sourceLocation.trim() ? sourceLocation.trim() : "Manual service paths";
  const activeScanDateLabel = activeScan ? formatDate(activeScan.completed_at ?? activeScan.created_at) : "No scan yet";

  /** Desktop: expand or collapse the sidebar. Phone and tablet: open or close the menu. */
  function toggleSidebar() {
    if (layoutMode !== "desktop") {
      setNavOpen((open) => !open);
      return;
    }
    setSidebarPreference(sidebarCollapsed ? "expanded" : "collapsed");
  }

  function closeNav() {
    setNavOpen(false);
  }

  function toggleDemoWorkspace() {
    if (isPublicDemoMode) {
      leavePublicDemo();
      return;
    }
    activatePublicDemo();
  }

  return {
    // project list and selection
    projects,
    projectListStatus,
    projectListError,
    selectedProjectId,
    selectedProject,
    isLoadingProjectState,
    projectName,
    setProjectName,
    projectDescription,
    setProjectDescription,
    showCreateProjectForm,
    setShowCreateProjectForm,
    isCreating,
    createProject,
    updateSelectedProject,
    handleTopProjectSelection,
    openCreateProjectFlow,
    // scan source and services
    sourceType,
    setSourceType,
    sourceLocation,
    setSourceLocation,
    sourceRef,
    setSourceRef,
    sourceLabel,
    repoPreview,
    setRepoPreview,
    isPreviewingRepo,
    previewRepositorySource,
    selectedDiscoveryPaths,
    setSelectedDiscoveryPaths,
    toggleDiscoveredService,
    applyDiscoveredServices,
    paths,
    setPaths,
    manualServicePaths,
    // policies
    policyCount,
    policyText,
    setPolicyText,
    isSavingPolicies,
    savePolicies,
    // guided scan workflow
    nextAction,
    workflowSteps,
    activeSetupStep,
    activeSetupStepId,
    activeSetupStepIndex,
    showSetupWorkspace,
    setShowSetupWorkspace,
    focusWorkflowStep,
    isScanning,
    runScan,
    // scans and results
    history,
    evolution,
    activeScan,
    activeScanDateLabel,
    isLoadingScan,
    loadScan,
    result,
    displayGraph,
    selectedGraphElement,
    setSelectedGraphElement,
    scores,
    systemScore,
    serviceScores,
    highestSeverity,
    hotspot,
    urgentFinding,
    compareBaseScan,
    roadmap,
    isLoadingRoadmap,
    // findings
    filters,
    setFilters,
    filterOptions,
    filteredFindings,
    selectedFinding,
    openFinding,
    closeFinding,
    interpretationMode,
    setInterpretationMode,
    // AI explainer
    aiQuestion,
    setAiQuestion,
    aiResponse,
    aiStatus,
    streamingAnswer,
    isExplaining,
    isCheckingAIStatus,
    requestAIExplanation,
    loadAIStatus,
    askAIAboutFinding,
    // research records
    researchRecords,
    selectedResearchRecordId,
    setSelectedResearchRecordId,
    isLoadingResearchRecords,
    isSavingResearchRecord,
    isExportingResearchRecords,
    loadResearchRecords,
    createResearchRecordFromScan,
    updateResearchRecord,
    deleteResearchRecord,
    exportResearchRecords,
    // documentation
    selectedDocSlug,
    selectDoc,
    docsQuery,
    setDocsQuery,
    docsCategory,
    setDocsCategory,
    openDoc,
    // navigation, layout and demo mode
    currentSection,
    currentSectionMeta,
    sectionNeedsProject,
    navigateToSection,
    layoutMode,
    sidebarCollapsed,
    navOpen,
    toggleSidebar,
    closeNav,
    apiAvailability,
    isPublicDemoMode,
    usingEmbeddedDemo,
    toggleDemoWorkspace,
    error
  };
}

export type MesaWorkspace = ReturnType<typeof useMesaWorkspace>;
