import type { MesaWorkspace } from "../../app/useMesaWorkspace";

export function RunScanPanel({ ws }: { ws: MesaWorkspace }) {
  const {
    repoPreview,
    selectedProject,
    sourceLocation,
    sourceType,
    selectedDiscoveryPaths,
    manualServicePaths,
    policyCount,
    focusWorkflowStep,
    runScan,
    isScanning,
    usingEmbeddedDemo
  } = ws;
  return (
    <section className="panelBlock runStepCard">
      <div className="panelHeader compact">
        <h2>Run Scan</h2>
        <span>{repoPreview ? "Repository-backed" : "Manual paths"}</span>
      </div>
      <div className="scanReadinessGrid">
        <div className="scanReadinessItem">
          <span>Project</span>
          <strong>{selectedProject?.name ?? "Not selected"}</strong>
        </div>
        <div className="scanReadinessItem">
          <span>Source</span>
          <strong>{sourceLocation.trim() ? sourceType : "Manual service list"}</strong>
        </div>
        <div className="scanReadinessItem">
          <span>Services</span>
          <strong>{String(selectedDiscoveryPaths.length || manualServicePaths.length || 0)}</strong>
        </div>
        <div className="scanReadinessItem">
          <span>Policies</span>
          <strong>{policyCount > 0 ? `${policyCount} saved` : "Optional"}</strong>
        </div>
      </div>
      <p className="hint">Run the current selection to generate findings, scores, history, and graph evidence.</p>
      <div className="panelButtonRow">
        <button
          type="button"
          className="secondaryButton"
          onClick={() => focusWorkflowStep("policies")}
          disabled={!selectedProject}
        >
          Back to Policies
        </button>
        <button onClick={runScan} disabled={isScanning || !selectedProject || usingEmbeddedDemo}>
          {isScanning ? "Scanning..." : repoPreview ? "Run Repo Scan" : "Run Scan"}
        </button>
      </div>
    </section>
  );
}
