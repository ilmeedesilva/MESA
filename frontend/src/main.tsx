import React from "react";
import ReactDOM from "react-dom/client";
import cytoscape from "cytoscape";
import "./styles.css";

type Finding = {
  id: string;
  type: string;
  severity: string;
  confidence: number;
  services: string[];
  description: string;
  evidence: Array<Record<string, unknown>>;
  recommendation: string;
};

type GraphNode = {
  id: string;
  type?: string;
  language?: string;
};

type GraphEdge = {
  source: string;
  target: string;
  type?: string;
  source_location?: unknown;
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
  const [activeScan, setActiveScan] = React.useState<ScanRecord | null>(null);
  const [result, setResult] = React.useState<AnalysisResult | null>(null);
  const [scores, setScores] = React.useState<HealthScore[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const [isLoadingScan, setIsLoadingScan] = React.useState(false);
  const [selectedFinding, setSelectedFinding] = React.useState<Finding | null>(null);
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
      setActiveScan(null);
      setResult(null);
      setScores([]);
      return;
    }
    void loadHistory(selectedProjectId);
  }, [selectedProjectId]);

  const aggregatedEdges = React.useMemo(
    () => (result ? aggregateEdges(result.graph.edges) : []),
    [result]
  );

  const filteredFindings = React.useMemo(
    () => filterFindings(result?.findings ?? [], filters),
    [filters, result]
  );

  const filterOptions = React.useMemo(() => buildFilterOptions(result?.findings ?? []), [result]);

  React.useEffect(() => {
    if (!result || !graphRef.current) return;

    const elements = buildGraphElements(result.graph.nodes, aggregatedEdges);
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
    return () => cy.destroy();
  }, [aggregatedEdges, result]);

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
      setScores(flattenScores(payload.result.summary.health_scores));
      setSelectedFinding(null);
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
      if (preferredScanId) return;
      if (!activeScan && scans.length > 0) {
        await loadScan(scans[0].id);
      }
    } catch (caught) {
      setHistory([]);
      setError(messageFor(caught, "Could not load scan history"));
    }
  }

  async function loadScan(scanId: string) {
    setError(null);
    setIsLoadingScan(true);
    try {
      const payload = await api<PersistedScanResult>(`/api/scans/${scanId}`);
      setActiveScan(payload.scan);
      setResult(payload.result);
      setScores(flattenScores(payload.result.summary.health_scores));
      setSelectedFinding(null);
      try {
        setScores(await api<HealthScore[]>(`/api/scans/${scanId}/scores`));
      } catch {
        setScores(flattenScores(payload.result.summary.health_scores));
      }
    } catch (caught) {
      setError(messageFor(caught, "Could not load scan"));
    } finally {
      setIsLoadingScan(false);
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

          <section className="contentGrid">
            <section className="graphPanel dashboardGraph">
              <div className="graphHeader">
                <div>
                  <h2>Architecture Graph</h2>
                  <p>{activeScan ? `Scan ${shortId(activeScan.id)}` : "Run or select a scan to build the graph"}</p>
                </div>
                <div className="legend">
                  <span><i className="serviceDot" /> Service</span>
                  <span><i className="databaseDot" /> Database</span>
                  <span><i className="edgeLine" /> Dependency</span>
                </div>
              </div>
              {result ? <div ref={graphRef} className="graph" /> : <div className="emptyState">No scan selected.</div>}
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
        <div className="recommendation">
          <strong>Recommendation</strong>
          <small>{finding.recommendation}</small>
        </div>
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
          label: formatNodeLabel(node.id, node.type),
          type: node.type ?? "service",
          role: degree === maxDegree && degree > 0 && node.type !== "database" ? "hub" : "node",
          weight: degree
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
        count: edge.count
      }
    }))
  ];
}

function calculateArchitecturePositions(nodes: GraphNode[], edges: AggregatedEdge[]) {
  const positions = new Map<string, { x: number; y: number }>();
  const serviceNodes = nodes.filter((node) => node.type !== "database").map((node) => node.id).sort();
  const databaseNodes = nodes.filter((node) => node.type === "database").map((node) => node.id).sort();
  const degreeByNode = calculateDegrees(edges);
  const canvas = { width: 1040, height: 680 };
  const hub = [...serviceNodes].sort((a, b) => {
    const degreeDelta = (degreeByNode.get(b) ?? 0) - (degreeByNode.get(a) ?? 0);
    return degreeDelta || a.localeCompare(b);
  })[0];

  if (!hub) return positions;

  const hubPosition = { x: canvas.width * 0.43, y: canvas.height * 0.43 };
  positions.set(hub, hubPosition);

  const inbound: string[] = [];
  const outbound: string[] = [];
  const satellites: string[] = [];

  for (const service of serviceNodes.filter((item) => item !== hub)) {
    const callsHub = edges.some((edge) => edge.source === service && edge.target === hub);
    const calledByHub = edges.some((edge) => edge.source === hub && edge.target === service);
    if (callsHub) {
      inbound.push(service);
    } else if (calledByHub) {
      outbound.push(service);
    } else {
      satellites.push(service);
    }
  }

  placeColumn(inbound.sort(), canvas.width * 0.16, 150, 520, positions);
  placeColumn(outbound.sort(), canvas.width * 0.72, 150, 520, positions);
  placeColumn(satellites.sort(), canvas.width * 0.43, 80, 150, positions);

  const databaseOwners = new Map<string, string>();
  databaseNodes.forEach((database) => {
    const owner = ownerForDatabase(database, edges);
    if (owner) databaseOwners.set(database, owner);
  });

  databaseNodes.forEach((database, index) => {
    const owner = databaseOwners.get(database);
    const ownerPosition = owner ? positions.get(owner) : null;
    const fallbackX = distribute(index, databaseNodes.length, canvas.width * 0.22, canvas.width * 0.82);
    positions.set(database, {
      x: ownerPosition ? clamp(ownerPosition.x + 110, canvas.width * 0.18, canvas.width * 0.86) : fallbackX,
      y: canvas.height * 0.78 + (index % 2) * 48
    });
  });

  return positions;
}

function placeColumn(items: string[], x: number, yStart: number, yEnd: number, positions: Map<string, { x: number; y: number }>) {
  items.forEach((item, index) => {
    positions.set(item, { x, y: distribute(index, items.length, yStart, yEnd) });
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

function ownerForDatabase(database: string, edges: AggregatedEdge[]) {
  const owners = edges
    .filter((edge) => edge.target === database || edge.source === database)
    .map((edge) => (edge.target === database ? edge.source : edge.target))
    .filter((node) => !node.startsWith("db:"));
  return owners.sort()[0];
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
      existing.label = formatEdgeLabel(type, existing.count);
      continue;
    }
    grouped.set(key, { ...edge, id: key, count: 1, label: formatEdgeLabel(type, 1) });
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

function formatEdgeLabel(type: string, count: number) {
  if (type === "api_call") return count > 1 ? `api x${count}` : "";
  const compactLabels: Record<string, string> = {
    uses_database: "db",
    shared_database: "shared db"
  };
  const label = compactLabels[type] ?? type.replace(/_/g, " ");
  return count > 1 ? `${label} x${count}` : label;
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
      "border-width": 3,
      color: "#0f172a",
      "font-size": "11px",
      "font-weight": 800,
      "text-valign": "bottom",
      "text-halign": "center",
      "text-wrap": "wrap",
      "text-max-width": "96px",
      "text-margin-y": 9,
      width: "mapData(weight, 0, 14, 34, 52)",
      height: "mapData(weight, 0, 14, 34, 52)",
      "overlay-opacity": 0
    }
  },
  {
    selector: "node[role = 'hub']",
    style: {
      "background-color": "#1d4ed8",
      "border-color": "#93c5fd",
      "border-width": 5,
      "font-size": "11px"
    }
  },
  {
    selector: "node[type = 'database']",
    style: {
      "background-color": "#7c3aed",
      "border-color": "#ddd6fe",
      shape: "round-rectangle",
      width: 42,
      height: 26,
      "font-size": "8px",
      "text-max-width": "70px"
    }
  },
  {
    selector: "edge",
    style: {
      label: "data(label)",
      width: "mapData(count, 1, 8, 1.2, 3.2)",
      "line-color": "#94a3b8",
      "target-arrow-color": "#94a3b8",
      "target-arrow-shape": "triangle",
      "target-arrow-scale": 0.75,
      "curve-style": "unbundled-bezier",
      "control-point-distances": "30 -30 54",
      "control-point-weights": "0.35 0.65 0.5",
      "font-size": "7px",
      "font-weight": 800,
      color: "#475569",
      "text-background-color": "#ffffff",
      "text-background-opacity": 0.95,
      "text-background-padding": "2px",
      "text-border-color": "#e2e8f0",
      "text-border-opacity": 1,
      "text-border-width": 1,
      "text-rotation": "autorotate",
      "opacity": 0.82
    }
  },
  {
    selector: "edge[type = 'shared_database']",
    style: {
      "line-color": "#7c3aed",
      "target-arrow-color": "#7c3aed",
      "line-style": "dashed"
    }
  }
];

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
