import type { MesaWorkspace } from "../../app/useMesaWorkspace";

export function PoliciesPanel({ ws }: { ws: MesaWorkspace }) {
  const {
    policyCount,
    policyText,
    setPolicyText,
    requestAIExplanation,
    isExplaining,
    selectedProject,
    activeScan,
    focusWorkflowStep,
    savePolicies,
    isSavingPolicies
  } = ws;
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
          onClick={() =>
            void requestAIExplanation("POLICY_WRITING_ASSISTANCE", {
              question: "Draft governance policy YAML for this project."
            })
          }
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
