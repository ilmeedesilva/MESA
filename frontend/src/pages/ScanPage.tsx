import type { MesaWorkspace } from "../app/useMesaWorkspace";
import { DocLinkButton } from "../components/DocLinkButton";
import { PoliciesPanel } from "./scan/PoliciesPanel";
import { ProjectSelectionPanel } from "./scan/ProjectSelectionPanel";
import { RunScanPanel } from "./scan/RunScanPanel";
import { ServiceReviewPanel } from "./scan/ServiceReviewPanel";
import { SourceConfigurationPanel } from "./scan/SourceConfigurationPanel";

export function ScanPage({ ws }: { ws: MesaWorkspace }) {
  const {
    nextAction,
    workflowSteps,
    activeSetupStep,
    activeSetupStepId,
    activeSetupStepIndex,
    showSetupWorkspace,
    setShowSetupWorkspace,
    focusWorkflowStep,
    openDoc
  } = ws;

  const stepContent = (() => {
    if (activeSetupStepId === "project") return <ProjectSelectionPanel ws={ws} />;
    if (activeSetupStepId === "source") return <SourceConfigurationPanel ws={ws} />;
    if (activeSetupStepId === "review") return <ServiceReviewPanel ws={ws} />;
    if (activeSetupStepId === "policies") return <PoliciesPanel ws={ws} />;
    return <RunScanPanel ws={ws} />;
  })();

  return (
    <div className="workspaceStack">
      <section className="workflowTrackPanel workspaceIntroCard">
        <div className="workflowSummary">
          <div>
            <div className="eyebrow">Guided scan</div>
            <h2>{nextAction}</h2>
            <p>
              Keep project selection, source configuration, and scan execution in one focused workspace instead of a
              long scrolling page.
            </p>
            <div className="docLinks">
              <DocLinkButton label="Quick start" onClick={() => openDoc("quick-start")} />
              <DocLinkButton label="Public repo guide" onClick={() => openDoc("public-repo-scan-guide")} />
            </div>
          </div>
          <div className="workflowActions">
            <div className="workflowStatus">
              <strong>
                {workflowSteps.filter((step) => step.done).length}/{workflowSteps.length}
              </strong>
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
                  <div className="eyebrow">Current step</div>
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
              <div className="eyebrow">Progress</div>
              <h2>Keep everything in one scan workspace</h2>
              <p>
                This flow now stays inside the scan tab. Move step by step here without being redirected into extra
                sections.
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
