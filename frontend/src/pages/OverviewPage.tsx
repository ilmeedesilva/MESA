import type { ReactNode } from "react";
import type { MesaWorkspace } from "../app/useMesaWorkspace";
import { DocLinkButton } from "../components/DocLinkButton";
import { StatePanel } from "../components/StatePanel";
import { ProjectSelectionPanel } from "./scan/ProjectSelectionPanel";
import { Metric, compactMetricDetail, gradeTone, recommendationPreview, summaryFindingTitle } from "../viewHelpers";

export function OverviewPage({ ws, historyPanel }: { ws: MesaWorkspace; historyPanel: ReactNode }) {
  const {
    selectedProject,
    sourceLabel,
    result,
    manualServicePaths,
    activeScan,
    activeScanDateLabel,
    nextAction,
    navigateToSection,
    filteredFindings,
    systemScore,
    highestSeverity,
    hotspot,
    urgentFinding,
    openDoc,
    isLoadingScan,
    isLoadingProjectState,
    history
  } = ws;

  if (!selectedProject) {
    return (
      <div className="workspaceStack">
        <section className="workspaceIntroCard">
          <div>
            <div className="eyebrow">Start here</div>
            <h2>Create or select a project</h2>
            <p>
              Choose an existing project to restore its saved scan state, or create a new one to start a clean analysis
              workflow.
            </p>
          </div>
          <div className="docLinks">
            <DocLinkButton label="Quick start" onClick={() => openDoc("quick-start")} />
            <DocLinkButton label="Public repo guide" onClick={() => openDoc("public-repo-scan-guide")} />
          </div>
        </section>
        <ProjectSelectionPanel ws={ws} />
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
            <span>
              <strong>Source</strong>
              <code>{sourceLabel}</code>
            </span>
            <span>
              <strong>Services</strong>
              <code>{String(result?.summary.service_count ?? manualServicePaths.length ?? 0)}</code>
            </span>
            <span>
              <strong>Last scan</strong>
              <code>{activeScanDateLabel}</code>
            </span>
          </div>
        </article>
        <article className="workspaceInfoCard emphasis">
          <div className="eyebrow">Next action</div>
          <h2>{nextAction}</h2>
          <p>
            Use the dedicated workspaces to move straight into scan setup, findings review, graph analysis, or AI
            assistance.
          </p>
          <div className="workspaceActionGrid">
            <button type="button" className="secondaryButton" onClick={() => navigateToSection("scan")}>
              Go to Scan
            </button>
            <button type="button" onClick={() => navigateToSection("findings")} disabled={!result}>
              View findings
            </button>
            <button type="button" onClick={() => navigateToSection("graph")} disabled={!result}>
              Open graph
            </button>
            <button type="button" onClick={() => navigateToSection("ai")} disabled={!activeScan}>
              Ask AI
            </button>
          </div>
        </article>
      </section>

      {!result && (isLoadingScan || isLoadingProjectState) ? (
        <StatePanel kind="loading" title="Loading the latest scan..." />
      ) : null}
      {!result && !isLoadingScan && !isLoadingProjectState && history.length === 0 ? (
        <StatePanel
          kind="empty"
          title="No scan yet"
          actions={
            <button type="button" onClick={() => navigateToSection("scan")}>
              Go to Scan
            </button>
          }
        >
          {`Run a scan of ${selectedProject.name} to see its findings, health score and graph.`}
        </StatePanel>
      ) : null}

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
          label="System health"
          value={systemScore ? Math.round(systemScore.score) : "--"}
          tone={systemScore ? gradeTone(systemScore.grade) : ""}
          detail={
            systemScore ? `${systemScore.grade} overall architecture quality` : "Available after a completed scan"
          }
          kind="number"
        />
        <Metric
          label="Highest risk"
          value={highestSeverity}
          tone={highestSeverity.toLowerCase()}
          detail={highestSeverity === "None" ? "No active findings yet" : "Strongest severity currently detected"}
          kind="status"
        />
        <Metric
          label="Hotspot service"
          value={hotspot?.service ?? "--"}
          tone={hotspot ? hotspot.tone : ""}
          detail={hotspot?.detail ?? "Most concentrated risk area in the scan"}
          kind="service"
          featured
        />
        <Metric
          label="Focus first"
          value={urgentFinding ? summaryFindingTitle(urgentFinding) : "No urgent issue"}
          tone={urgentFinding ? urgentFinding.severity.toLowerCase() : ""}
          detail={
            urgentFinding
              ? compactMetricDetail(recommendationPreview(urgentFinding), 28)
              : "Run a scan to generate prioritized guidance"
          }
          kind="summary"
          featured
          wide
          detailLines={5}
          expandableDetail={Boolean(urgentFinding)}
          fullDetail={urgentFinding ? recommendationPreview(urgentFinding) : undefined}
        />
      </section>

      <section className="workspaceSingleColumn">{historyPanel}</section>
    </div>
  );
}
