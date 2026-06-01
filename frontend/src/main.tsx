import React from "react";
import ReactDOM from "react-dom/client";
import cytoscape from "cytoscape";
import "./styles.css";

type Finding = {
  id: string;
  type: string;
  severity: string;
  services: string[];
  description: string;
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
  };
};

type AggregatedEdge = GraphEdge & {
  id: string;
  count: number;
  label: string;
};

const defaultPaths = [
  "/workspace/tests/fixtures/chatty/order-service",
  "/workspace/tests/fixtures/chatty/user-service"
].join("\n");

const severityRank: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

function App() {
  const [paths, setPaths] = React.useState(defaultPaths);
  const [result, setResult] = React.useState<AnalysisResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const graphRef = React.useRef<HTMLDivElement | null>(null);

  const aggregatedEdges = React.useMemo(
    () => (result ? aggregateEdges(result.graph.edges) : []),
    [result]
  );

  React.useEffect(() => {
    if (!result || !graphRef.current) return;

    const cy = cytoscape({
      container: graphRef.current,
      elements: [
        ...result.graph.nodes.map((node) => ({
          data: { id: node.id, label: node.id, type: node.type ?? "service" }
        })),
        ...aggregatedEdges.map((edge) => ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label,
            type: edge.type ?? "depends",
            count: edge.count
          }
        }))
      ],
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "#2563eb",
            "border-color": "#bfdbfe",
            "border-width": 3,
            color: "#0f172a",
            "font-size": "10px",
            "font-weight": 700,
            "text-valign": "bottom",
            "text-margin-y": 7,
            width: 28,
            height: 28
          }
        },
        {
          selector: "node[type = 'database']",
          style: {
            "background-color": "#7c3aed",
            "border-color": "#ddd6fe",
            shape: "round-rectangle",
            width: 34,
            height: 24
          }
        },
        {
          selector: "edge",
          style: {
            label: "data(label)",
            width: "mapData(count, 1, 8, 1.5, 4)",
            "line-color": "#64748b",
            "target-arrow-color": "#64748b",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "control-point-step-size": 34,
            "font-size": "8px",
            "font-weight": 700,
            color: "#334155",
            "text-background-color": "#ffffff",
            "text-background-opacity": 1,
            "text-background-padding": "3px",
            "text-rotation": "autorotate"
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
      ],
      layout: selectLayout(result.graph.nodes.length),
      minZoom: 0.55,
      maxZoom: 1.15,
      wheelSensitivity: 0.25
    });

    cy.ready(() => {
      cy.center();
      cy.zoom(result.graph.nodes.length <= 3 ? 0.82 : 0.72);
    });
    return () => cy.destroy();
  }, [aggregatedEdges, result]);

  async function runAnalysis() {
    setError(null);
    setIsAnalyzing(true);
    const service_paths = paths
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_paths })
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      setResult((await response.json()) as AnalysisResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const highestSeverity = getHighestSeverity(result?.findings ?? []);

  return (
    <main>
      <section className="toolbar">
        <div>
          <div className="eyebrow">Architecture Static Analysis</div>
          <h1>MESA</h1>
          <p>Cross-service anti-pattern detection for microservice systems</p>
        </div>
        <button onClick={runAnalysis} disabled={isAnalyzing}>
          {isAnalyzing ? "Analyzing..." : "Analyze"}
        </button>
      </section>

      <section className="workspace">
        <aside className="inputPanel">
          <div className="panelHeader">
            <h2>Analysis Input</h2>
            <span>{paths.split("\n").filter(Boolean).length} services</span>
          </div>
          <label htmlFor="paths">Service paths</label>
          <textarea id="paths" value={paths} onChange={(event) => setPaths(event.target.value)} />
          <p className="hint">Docker paths should start with /workspace. Add one service directory per line.</p>

          {error ? <div className="error">{error}</div> : null}

          <div className="metricGrid">
            <Metric label="Findings" value={result?.summary.finding_count ?? 0} />
            <Metric label="Services" value={result?.summary.service_count ?? 0} />
            <Metric label="Edges" value={aggregatedEdges.length} />
            <Metric label="Risk" value={highestSeverity} tone={highestSeverity.toLowerCase()} />
          </div>
        </aside>

        <section className="graphPanel">
          <div className="graphHeader">
            <div>
              <h2>Architecture Graph</h2>
              <p>Services, dependencies, and inferred cross-service relationships</p>
            </div>
            <div className="legend">
              <span><i className="serviceDot" /> Service</span>
              <span><i className="databaseDot" /> Database</span>
              <span><i className="edgeLine" /> Dependency</span>
            </div>
          </div>
          {result ? (
            <div ref={graphRef} className="graph" />
          ) : (
            <div className="emptyState">Run an analysis to build the architecture graph.</div>
          )}
        </section>

        <aside className="findings">
          <div className="panelHeader">
            <h2>Findings</h2>
            {result ? <span>{result.summary.finding_count} total</span> : null}
          </div>

          {!result ? <div className="emptyList">No scan has been run yet.</div> : null}
          {result && result.findings.length === 0 ? (
            <div className="emptyList success">No anti-patterns detected for this scan.</div>
          ) : null}

          {result?.findings.map((finding) => (
            <article key={finding.id} className="findingCard">
              <div className="findingMeta">
                <span>{finding.id}</span>
                <strong className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</strong>
              </div>
              <h3>{formatType(finding.type)}</h3>
              <div className="serviceChips">
                {finding.services.map((service) => (
                  <span key={service}>{service}</span>
                ))}
              </div>
              <p>{finding.description}</p>
              <div className="recommendation">
                <strong>Recommendation</strong>
                <small>{finding.recommendation}</small>
              </div>
            </article>
          ))}
        </aside>
      </section>
    </main>
  );
}

function selectLayout(nodeCount: number) {
  if (nodeCount <= 3) {
    return {
      name: "circle",
      animate: false,
      padding: 120,
      radius: 120
    };
  }

  return {
    name: "cose",
    animate: false,
    padding: 90,
    nodeRepulsion: 10000,
    idealEdgeLength: 140,
    componentSpacing: 120
  };
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
    grouped.set(key, {
      ...edge,
      id: key,
      count: 1,
      label: formatEdgeLabel(type, 1)
    });
  }
  return [...grouped.values()];
}

function formatEdgeLabel(type: string, count: number) {
  const label = type.replace(/_/g, " ");
  return count > 1 ? `${label} x${count}` : label;
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
