import type { MesaWorkspace } from "../../app/useMesaWorkspace";

export function ServiceReviewPanel({ ws }: { ws: MesaWorkspace }) {
  const {
    repoPreview,
    selectedDiscoveryPaths,
    manualServicePaths,
    toggleDiscoveredService,
    applyDiscoveredServices,
    focusWorkflowStep,
    paths,
    setPaths
  } = ws;
  return (
    <section className="panelBlock">
      <div className="panelHeader compact">
        <h2>Service Review</h2>
        <span>
          {repoPreview ? `${selectedDiscoveryPaths.length} selected` : `${manualServicePaths.length} manual paths`}
        </span>
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
              {repoPreview.warnings.map((warning) => (
                <small key={warning}>{warning}</small>
              ))}
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
                      {candidate.manifests.map((manifest) => (
                        <code key={manifest}>{manifest}</code>
                      ))}
                      {candidate.entrypoints.map((entrypoint) => (
                        <code key={entrypoint}>{entrypoint}</code>
                      ))}
                    </div>
                    <ul className="reasonList">
                      {candidate.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          )}
          <button
            className="fullButton secondaryButton"
            onClick={applyDiscoveredServices}
            disabled={selectedDiscoveryPaths.length === 0}
          >
            Apply Selected Services
          </button>
          <button
            type="button"
            className="fullButton"
            onClick={() => focusWorkflowStep("policies")}
            disabled={selectedDiscoveryPaths.length === 0}
          >
            Continue to Policies
          </button>
        </div>
      ) : (
        <div className="stepHintCard">
          No repository preview is active. You can still continue with manual service paths below.
        </div>
      )}
      <label htmlFor="paths">Service paths</label>
      <textarea id="paths" value={paths} onChange={(event) => setPaths(event.target.value)} />
      <p className="hint">
        Manual fallback: use one service directory per line. Repository discovery can fill this automatically.
      </p>
      <div className="panelButtonRow">
        <button type="button" onClick={() => focusWorkflowStep("source")}>
          Back to Source
        </button>
        <button
          type="button"
          className="secondaryButton"
          onClick={() => focusWorkflowStep("policies")}
          disabled={manualServicePaths.length === 0 && selectedDiscoveryPaths.length === 0}
        >
          Continue
        </button>
      </div>
    </section>
  );
}
