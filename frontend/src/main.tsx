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

type ProjectRecord = {
  id: string;
  name: string;
  description?: string | null;
  root_path?: string | null;
  created_at?: string | null;
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
  const [history, setHistory] = React.useState<ScanRecord[]>([]);
  const [evolution, setEvolution] = React.useState<EvolutionReport[]>([]);
  const [activeScan, setActiveScan] = React.useState<ScanRecord | null>(null);
  const [result, setResult] = React.useState<AnalysisResult | null>(null);
  const [displayGraph, setDisplayGraph] = React.useState<DisplayGraph | null>(null);
  const [scores, setScores] = React.useState<HealthScore[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const [isLoadingScan, setIsLoadingScan] = React.useState(false);
  const [selectedFinding, setSelectedFinding] = React.useState<Finding | null>(null);
  const [selectedGraphElement, setSelectedGraphElement] = React.useState<GraphSelection | null>(null);
  const [filters, setFilters] = React.useState<Filters>({
    type: "ALL",
    severity: "ALL",
    service: "ALL",
    minConfidence: 0
  });
  const graphRef = React.useRef<HTMLDivElement | null>(null);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  React.useEffect(() => {
    localStorage.setItem(projectStorageKey, JSON.stringify(projects));
  }, [projects]);

  React.useEffect(() => {
    if (!selectedProjectId) {
      setHistory([]);
      setEvolution([]);
      setActiveScan(null);
      setResult(null);
      setDisplayGraph(null);
      setScores([]);
      return;
    }
    void loadHistory(selectedProjectId);
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
    setError(null);
    setIsScanning(true);
    const service_paths = servicePathsFromText(paths);
    try {
      const payload = await api<PersistedScanResult>(`/api/projects/${selectedProjectId}/scans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_paths })
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

  return (
    <main>
      <section className="toolbar">
        <div>
          <div className="eyebrow">Architecture Governance Dashboard</div>
          <h1>MESA</h1>
          <p>Cross-service scan history, findings triage, and architectural health scoring</p>
        </div>
        <div className="toolbarActions">
          <span>{selectedProject ? selectedProject.name : "No project selected"}</span>
          <button onClick={runScan} disabled={isScanning || !selectedProjectId}>
            {isScanning ? "Scanning..." : "Run Scan"}
          </button>
        </div>
      </section>

      <section className="dashboardShell">
        <aside className="sideRail">
          <section className="panelBlock">
            <div className="panelHeader compact">
              <h2>Project</h2>
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
              <h2>Scan Input</h2>
              <span>{servicePathsFromText(paths).length} services</span>
            </div>
            <label htmlFor="paths">Service paths</label>
            <textarea id="paths" value={paths} onChange={(event) => setPaths(event.target.value)} />
            <p className="hint">Use Docker paths. Add one service directory per line.</p>
            {error ? <div className="error">{error}</div> : null}
          </section>
        </aside>

        <section className="mainDeck">
          <section className="summaryStrip">
            <Metric label="Findings" value={result?.summary.finding_count ?? 0} />
            <Metric label="Services" value={result?.summary.service_count ?? 0} />
            <Metric label="System Health" value={systemScore ? Math.round(systemScore.score) : "--"} tone={systemScore ? gradeTone(systemScore.grade) : ""} />
            <Metric label="Risk" value={highestSeverity} tone={highestSeverity.toLowerCase()} />
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

            <HealthScoreView systemScore={systemScore ?? null} serviceScores={serviceScores} />
          </section>
        </section>

        <FindingsDashboard
          findings={result?.findings ?? []}
          filteredFindings={filteredFindings}
          filters={filters}
          filterOptions={filterOptions}
          onFilterChange={setFilters}
          onSelectFinding={setSelectedFinding}
        />
      </section>

      {selectedFinding ? (
        <FindingDrawer finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
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
  onFilterChange,
  onSelectFinding
}: {
  findings: Finding[];
  filteredFindings: Finding[];
  filters: Filters;
  filterOptions: { types: string[]; severities: string[]; services: string[] };
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
            <span>{finding.id}</span>
            <strong className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</strong>
          </div>
          <h3>{formatType(finding.type)}</h3>
          <div className="serviceChips">
            {finding.services.map((service) => <span key={service}>{service}</span>)}
          </div>
          <p>{finding.description}</p>
          <small className="confidenceText">Confidence {Math.round(finding.confidence * 100)}%</small>
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

function RecommendationDetails({ finding }: { finding: Finding }) {
  const recommendation = finding.recommendations?.[0];
  if (!recommendation) {
    return (
      <div className="recommendation">
        <strong>Recommendation</strong>
        <small>{finding.recommendation}</small>
      </div>
    );
  }
  return (
    <section className="recommendation structuredRecommendation">
      <div className="recommendationHeader">
        <strong>Architectural Recommendation</strong>
        <span>{recommendation.priority} priority - {recommendation.estimated_difficulty} difficulty</span>
      </div>
      <dl>
        <dt>Root cause</dt>
        <dd>{recommendation.root_cause}</dd>
        <dt>Consequence</dt>
        <dd>{recommendation.architectural_consequence}</dd>
        <dt>Expected impact</dt>
        <dd>{recommendation.expected_impact}</dd>
      </dl>
      {recommendation.affected_files.length > 0 ? (
        <div className="affectedFiles">
          <strong>Affected files</strong>
          {recommendation.affected_files.slice(0, 5).map((file) => <code key={file}>{file}</code>)}
        </div>
      ) : null}
      <strong>Refactoring steps</strong>
      <ol>
        {recommendation.refactoring_steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <small>Source: {recommendation.source}</small>
    </section>
  );
}

function FindingDrawer({ finding, onClose }: { finding: Finding; onClose: () => void }) {
  return (
    <div className="drawerOverlay" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <button className="drawerClose" onClick={onClose}>Close</button>
        <div className="findingMeta">
          <span>{finding.id}</span>
          <strong className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</strong>
        </div>
        <h2>{formatType(finding.type)}</h2>
        <div className="serviceChips">
          {finding.services.map((service) => <span key={service}>{service}</span>)}
        </div>
        <p>{finding.description}</p>
        <RecommendationDetails finding={finding} />
        <h3>Evidence</h3>
        <pre>{JSON.stringify(finding.evidence, null, 2)}</pre>
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

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
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
