import type { ReactNode } from "react";
import type { MesaWorkspace } from "../app/useMesaWorkspace";
import { DocLinkButton } from "../components/DocLinkButton";
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
    openDoc
  } = ws;

  if (!selectedProject) {
    return (
      <div className="workspaceStack">
        <section className="workspaceIntroCard">
          <div>
            <div className="eyebrow">Start Here</div>
            <h2>Create or select a project</h2>
            <p>
              Choose an existing project to restore its saved scan state, or create a new one to start a clean analysis
              workflow.
            </p>
          </div>
          <div className="docLinks">
            <DocLinkButton label="Evaluator quick start" onClick={() => openDoc("evaluator-quick-start")} />
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
          <div className="eyebrow">Next Action</div>
          <h2>{nextAction}</h2>
          <p>
            Use the dedicated workspaces to move straight into scan setup, findings review, graph analysis, or AI
            assistance.
          </p>
          <div className="workspaceActionGrid">
            <button type="button" className="secondaryButton" onClick={() => navigateToSection("scan")}>
              Open Scan
            </button>
            <button type="button" onClick={() => navigateToSection("findings")} disabled={!result}>
              View Findings
            </button>
            <button type="button" onClick={() => navigateToSection("graph")} disabled={!result}>
              Open Graph
            </button>
            <button type="button" onClick={() => navigateToSection("ai")} disabled={!activeScan}>
              Ask AI
            </button>
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
          detail={
            systemScore ? `${systemScore.grade} overall architecture quality` : "Available after a completed scan"
          }
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
