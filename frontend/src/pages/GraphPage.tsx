import type { MesaWorkspace } from "../app/useMesaWorkspace";
import { ArchitectureGraph } from "../components/ArchitectureGraph";
import { GraphInspector } from "../components/GraphInspector";
import { HealthScoreView } from "./RemediationRoadmapPanel";
import { shortId } from "../viewHelpers";

export function GraphPage({ ws }: { ws: MesaWorkspace }) {
  const {
    activeScan,
    displayGraph,
    result,
    scores,
    selectedGraphElement,
    setSelectedGraphElement,
    systemScore,
    serviceScores,
    openDoc
  } = ws;
  return (
    <section className="contentGrid workspaceGraphGrid">
      <section className="graphPanel dashboardGraph">
        <div className="graphHeader">
          <div>
            <h2>Architecture Graph</h2>
            <p>
              {activeScan
                ? `Scan ${shortId(activeScan.id)} - ${displayGraph?.source === "digital-twin" ? "Digital Twin" : "Report Graph"}`
                : "Run or select a scan to build the graph"}
            </p>
          </div>
          <div className="legend">
            <span>
              <i className="serviceDot" /> Service
            </span>
            <span>
              <i className="apiDot" /> API
            </span>
            <span>
              <i className="databaseDot" /> Database
            </span>
            <span>
              <i className="riskLine" /> Risk
            </span>
          </div>
        </div>
        {result ? (
          <ArchitectureGraph
            graph={displayGraph}
            findings={result.findings}
            scores={scores}
            onSelect={setSelectedGraphElement}
          />
        ) : (
          <div className="emptyState">No scan selected.</div>
        )}
        <GraphInspector selection={selectedGraphElement} />
      </section>
      <HealthScoreView systemScore={systemScore ?? null} serviceScores={serviceScores} onOpenDoc={openDoc} />
    </section>
  );
}
