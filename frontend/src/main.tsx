import React from "react";
import ReactDOM from "react-dom/client";
import cytoscape from "cytoscape";
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

const defaultPaths = [
  "/workspace/tests/fixtures/god/platform-service",
  "/workspace/tests/fixtures/god/order-service",
  "/workspace/tests/fixtures/god/billing-service",
  "/workspace/tests/fixtures/god/inventory-service",
  "/workspace/tests/fixtures/god/user-service",
  "/workspace/tests/fixtures/god/payment-service",
  "/workspace/tests/fixtures/god/notification-service"
].join("\n");

const projectStorageKey = "mesa.projects";

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

function App() {
  const [projects, setProjects] = React.useState<ProjectRecord[]>(loadStoredProjects);
  const [selectedProjectId, setSelectedProjectId] = React.useState(() => projects[0]?.id ?? "");
  const [projectName, setProjectName] = React.useState("MESA Demo Project");
  const [projectDescription, setProjectDescription] = React.useState("Static architecture analysis demo");
  const [paths, setPaths] = React.useState(defaultPaths);
  const [sourceType, setSourceType] = React.useState("LOCAL_PATH");
  const [sourceLocation, setSourceLocation] = React.useState("");
  const [sourceRef, setSourceRef] = React.useState("main");
  const [repoPreview, setRepoPreview] = React.useState<RepoScanPreview | null>(null);
  const [selectedDiscoveryPaths, setSelectedDiscoveryPaths] = React.useState<string[]>([]);
  const [history, setHistory] = React.useState<ScanRecord[]>([]);
  const [evolution, setEvolution] = React.useState<EvolutionReport[]>([]);
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
  const [isSavingPolicies, setIsSavingPolicies] = React.useState(false);
  const [selectedFinding, setSelectedFinding] = React.useState<Finding | null>(null);
  const [selectedGraphElement, setSelectedGraphElement] = React.useState<GraphSelection | null>(null);
  const [interpretationMode, setInterpretationMode] = React.useState<InterpretationMode>("beginner");
  const [filters, setFilters] = React.useState<Filters>({
    type: "ALL",
    severity: "ALL",
    service: "ALL",
    minConfidence: 0
  });
  const graphRef = React.useRef<HTMLDivElement | null>(null);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const manualServicePaths = React.useMemo(() => servicePathsFromText(paths), [paths]);

  React.useEffect(() => {
    localStorage.setItem(projectStorageKey, JSON.stringify(projects));
  }, [projects]);

  React.useEffect(() => {
    if (!selectedProjectId) {
      setHistory([]);
      setEvolution([]);
      setPolicyCount(0);
      setPolicyText(defaultPolicyDocument);
      setActiveScan(null);
      setResult(null);
      setDisplayGraph(null);
      setScores([]);
      return;
    }
    void loadHistory(selectedProjectId);
    void loadPolicies(selectedProjectId);
  }, [selectedProjectId]);

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

  async function createProject() {
    setError(null);
    setIsCreating(true);
    try {
      const project = await api<ProjectRecord>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName, description: projectDescription })
      });
      setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
      setSelectedProjectId(project.id);
    } catch (caught) {
      setError(messageFor(caught, "Project creation failed"));
    } finally {
      setIsCreating(false);
    }
  }

  async function runScan() {
    if (!selectedProjectId) {
      setError("Create or select a project before running a scan.");
      return;
    }
    if (sourceLocation.trim() && !repoPreview) {
      setError("Preview the repository source before running a repository-backed scan.");
      return;
    }
    if (repoPreview && repoPreview.discovered_services.length > 0 && selectedDiscoveryPaths.length === 0) {
      setError("Select at least one discovered service before running a repository-backed scan.");
      return;
    }
    setError(null);
    setIsScanning(true);
    try {
      const payload = repoPreview
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
      await loadDigitalTwinGraph(payload.scan.id, payload.result, nextScores);
      await loadHistory(selectedProjectId, payload.scan.id);
    } catch (caught) {
      setError(messageFor(caught, "Scan failed"));
    } finally {
      setIsScanning(false);
    }
  }

  async function previewRepositorySource() {
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
      setSelectedDiscoveryPaths(
        preview.discovered_services
          .filter((candidate) => candidate.selected_by_default)
          .map((candidate) => candidate.relative_path)
      );
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
    try {
      setEvolution(await api<EvolutionReport[]>(`/api/projects/${projectId}/evolution`));
    } catch {
      setEvolution([]);
    }
  }

  async function loadPolicies(projectId: string) {
    try {
      const policies = await api<PolicyRecord[]>(`/api/projects/${projectId}/policies`);
      setPolicyCount(policies.length);
      if (policies.length > 0) setPolicyText(policyDocumentFromRecords(policies));
    } catch {
      setPolicyCount(0);
    }
  }

  async function savePolicies() {
    if (!selectedProjectId) {
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

  async function loadScan(scanId: string) {
    setError(null);
    setIsLoadingScan(true);
    try {
      const payload = await api<PersistedScanResult>(`/api/scans/${scanId}`);
      setActiveScan(payload.scan);
      setResult(payload.result);
      let nextScores = flattenScores(payload.result.summary.health_scores);
      setScores(nextScores);
      setDisplayGraph(graphFromReport(payload.result, nextScores));
      setSelectedFinding(null);
      setSelectedGraphElement(null);
      try {
        nextScores = await api<HealthScore[]>(`/api/scans/${scanId}/scores`);
        setScores(nextScores);
      } catch {
        setScores(nextScores);
      }
      await loadDigitalTwinGraph(scanId, payload.result, nextScores);
    } catch (caught) {
      setError(messageFor(caught, "Could not load scan"));
    } finally {
      setIsLoadingScan(false);
    }
  }

  async function loadDigitalTwinGraph(scanId: string, scanResult: AnalysisResult, currentScores: HealthScore[]) {
    try {
      const twin = await api<DigitalTwinGraph>(`/api/scans/${scanId}/graph`);
      setDisplayGraph(graphFromDigitalTwin(twin, scanResult, currentScores));
    } catch {
      setDisplayGraph(graphFromReport(scanResult, currentScores));
    }
  }

  const highestSeverity = getHighestSeverity(result?.findings ?? []);
  const systemScore = scores.find((score) => score.scope === "system") ?? result?.summary.health_scores?.system;
  const serviceScores = scores.filter((score) => score.scope === "service");
  const urgentFinding = getMostUrgentFinding(result?.findings ?? []);
  const hotspot = getHotspotService(result?.findings ?? [], serviceScores);
  const hasProject = Boolean(selectedProjectId);
  const hasSourceConfigured = Boolean(sourceLocation.trim()) || manualServicePaths.length > 0;
  const hasRepoPreview = Boolean(repoPreview);
  const hasServiceSelection = repoPreview ? selectedDiscoveryPaths.length > 0 : manualServicePaths.length > 0;
  const hasSavedPolicies = policyCount > 0;
  const hasCompletedScan = Boolean(activeScan && result);
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

  return (
    <main>
      <section className="toolbar">
        <div>
          <div className="eyebrow">Guided Architecture Scan Workflow</div>
          <h1>MESA</h1>
          <p>Move from project setup to source review, service discovery, governance, and architecture results.</p>
        </div>
        <div className="toolbarActions">
          <span>{selectedProject ? selectedProject.name : "No project selected"}</span>
          <button onClick={runScan} disabled={isScanning || !selectedProjectId}>
            {isScanning ? "Scanning..." : repoPreview ? "Run Repo Scan" : "Run Scan"}
          </button>
        </div>
      </section>

      <section className="workflowHero">
        <div className="workflowSummary">
          <div>
            <div className="eyebrow">Next Action</div>
            <h2>Guided Scan Flow</h2>
            <p>{nextAction}</p>
          </div>
          <div className="workflowStatus">
            <strong>{workflowSteps.filter((step) => step.done).length}/{workflowSteps.length}</strong>
            <span>steps ready</span>
          </div>
        </div>
        <div className="workflowStrip">
          {workflowSteps.map((step, index) => (
            <article
              key={step.id}
              className={`workflowStep ${step.done ? "done" : ""} ${step.active ? "active" : ""} ${step.optional ? "optional" : ""}`}
            >
              <div className="workflowStepTop">
                <span>Step {index + 1}</span>
                {step.optional ? <small>Optional</small> : null}
              </div>
              <strong>{step.label}</strong>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboardShell">
        <aside className="sideRail">
          <section className="panelBlock">
            <div className="panelHeader compact">
              <h2>Step 1. Project</h2>
              <span>{projects.length} saved</span>
            </div>
            <label htmlFor="projectName">Project name</label>
            <input id="projectName" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            <label htmlFor="projectDescription">Description</label>
            <input id="projectDescription" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} />
            <button className="fullButton" onClick={createProject} disabled={isCreating || !projectName.trim()}>
              {isCreating ? "Creating..." : "Create Project"}
            </button>
            <label htmlFor="projectSelect">Select project</label>
            <select id="projectSelect" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              <option value="">Choose a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </section>

          <section className="panelBlock">
            <div className="panelHeader compact">
              <h2>Step 2. Source</h2>
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
            <button className="fullButton" onClick={previewRepositorySource} disabled={isPreviewingRepo}>
              {isPreviewingRepo ? "Previewing..." : "Preview Discovery"}
            </button>
            <p className="hint">
              Preview shows likely services with confidence and reasons. Leave this empty to keep using manual service paths only.
            </p>
            {!repoPreview && sourceLocation.trim() ? (
              <div className="stepHintCard">
                Preview discovery to unlock the service review step and confirm what MESA will analyze.
              </div>
            ) : null}
          </section>

          <section className="panelBlock">
            <div className="panelHeader compact">
              <h2>Step 3. Review Services</h2>
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
            {error ? <div className="error">{error}</div> : null}
          </section>

          <section className="panelBlock policyEditor">
            <div className="panelHeader compact">
              <h2>Step 4. Governance Policies</h2>
              <span>{policyCount} active optional rules</span>
            </div>
            <label htmlFor="policyText">Policy YAML</label>
            <textarea id="policyText" value={policyText} onChange={(event) => setPolicyText(event.target.value)} />
            <p className="hint">Policies run during project scans and violations appear as findings.</p>
            <button className="fullButton" onClick={savePolicies} disabled={isSavingPolicies || !selectedProjectId}>
              {isSavingPolicies ? "Saving..." : "Save Policies"}
            </button>
          </section>

          <section className="panelBlock runStepCard">
            <div className="panelHeader compact">
              <h2>Step 5. Run Scan</h2>
              <span>{repoPreview ? "Repository-backed" : "Manual paths"}</span>
            </div>
            <p className="hint">Run the current selection to generate findings, scores, history, and graph evidence.</p>
            <button onClick={runScan} disabled={isScanning || !selectedProjectId}>
              {isScanning ? "Scanning..." : repoPreview ? "Run Repo Scan" : "Run Scan"}
            </button>
          </section>
        </aside>

        <section className="mainDeck">
          <section className="interpretationPanel">
            <div className="interpretationIntro">
              <div className="eyebrow">Result Interpretation</div>
              <h2>Choose how to read this scan</h2>
              <p>
                Switch between a guided plain-language view and a deeper research-oriented explanation without changing
                the underlying detector results.
              </p>
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

          <section className="historyPanel">
            <div className="panelHeader compact">
              <h2>Scan History</h2>
              <span>{history.length} scans</span>
            </div>
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

          <EvolutionPanel reports={evolution} />

          <section className="contentGrid">
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
          </section>

          <HealthScoreView systemScore={systemScore ?? null} serviceScores={serviceScores} />
        </section>

        <FindingsDashboard
          findings={result?.findings ?? []}
          filteredFindings={filteredFindings}
          filters={filters}
          filterOptions={filterOptions}
          interpretationMode={interpretationMode}
          onFilterChange={setFilters}
          onSelectFinding={setSelectedFinding}
        />
      </section>

      {selectedFinding ? (
        <FindingDrawer
          finding={selectedFinding}
          interpretationMode={interpretationMode}
          onClose={() => setSelectedFinding(null)}
        />
      ) : null}
    </main>
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

function FindingsDashboard({
  findings,
  filteredFindings,
  filters,
  filterOptions,
  interpretationMode,
  onFilterChange,
  onSelectFinding
}: {
  findings: Finding[];
  filteredFindings: Finding[];
  filters: Filters;
  filterOptions: { types: string[]; severities: string[]; services: string[] };
  interpretationMode: InterpretationMode;
  onFilterChange: (filters: Filters) => void;
  onSelectFinding: (finding: Finding) => void;
}) {
  return (
    <aside className="findings dashboardFindings">
      <div className="panelHeader">
        <div>
          <h2>Findings Dashboard</h2>
          <p>{filteredFindings.length} of {findings.length} findings</p>
        </div>
        <span>{interpretationMode === "beginner" ? "Plain-language view" : "Research detail view"}</span>
      </div>

      <div className="filters">
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
        </article>
      ))}
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
      ) : null}
      {latest ? <p className="evolutionSentence">{String(latest.architecture_change_summary.summary ?? "No summary available.")}</p> : null}
      {latest?.recommendations.length ? (
        <div className="evolutionRecommendations">
          <strong>Recommendation</strong>
          <span>{latest.recommendations[0]}</span>
        </div>
      ) : null}
      {reports.length > 0 ? (
        <div className="evolutionTimeline">
          {reports.slice().reverse().map((report) => (
            <article key={`${report.base_scan_id}-${report.target_scan_id}`}>
              <strong>{`${shortId(report.base_scan_id)} -> ${shortId(report.target_scan_id)}`}</strong>
              <span>{report.risk_trend.new_risk_count ?? 0} new risks, {report.risk_trend.resolved_risk_count ?? 0} resolved</span>
              <small>{formatSigned(report.score_trend.system_delta)} health</small>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function HealthScoreView({ systemScore, serviceScores }: { systemScore: HealthScore | null; serviceScores: HealthScore[] }) {
  const sortedServices = [...serviceScores].sort((a, b) => a.score - b.score).slice(0, 6);
  return (
    <section className="healthPanel">
      <div className="panelHeader compact">
        <div>
          <h2>Health Scores</h2>
          <p>Service, domain, and system-level architecture quality</p>
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
  onClose
}: {
  finding: Finding;
  interpretationMode: InterpretationMode;
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
        <section className="drawerSection">
          <h3>What MESA found</h3>
          <p>{finding.description}</p>
        </section>
        <section className="drawerSection">
          <h3>Why it matters</h3>
          <p>{findingWhyItMatters(finding)}</p>
        </section>
        <section className="drawerSection">
          <h3>Why MESA thinks this</h3>
          <ul className="evidenceBulletList">
            {summarizeEvidence(finding.evidence).map((item) => <li key={item}>{item}</li>)}
          </ul>
          <small className="supportText">
            {confidenceLabel(finding.confidence)} confidence ({Math.round(finding.confidence * 100)}%). {confidenceGuidance(finding.confidence)}
          </small>
        </section>
        <RecommendationDetails finding={finding} interpretationMode={interpretationMode} />
        <section className="drawerSection">
          <h3>Expected impact</h3>
          <p>{recommendationImpact(finding)}</p>
        </section>
        <section className="drawerSection">
          <h3>What this does not prove</h3>
          <p>{findingLimitation(finding)}</p>
        </section>
        {interpretationMode === "research" ? (
          <section className="drawerSection">
            <h3>Raw evidence</h3>
            <pre>{JSON.stringify(finding.evidence, null, 2)}</pre>
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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return (await response.json()) as T;
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

function loadStoredProjects(): ProjectRecord[] {
  try {
    const stored = localStorage.getItem(projectStorageKey);
    return stored ? (JSON.parse(stored) as ProjectRecord[]) : [];
  } catch {
    return [];
  }
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
