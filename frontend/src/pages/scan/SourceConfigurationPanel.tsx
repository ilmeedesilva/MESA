import type { MesaWorkspace } from "../../app/useMesaWorkspace";

export function SourceConfigurationPanel({ ws }: { ws: MesaWorkspace }) {
  const {
    sourceType,
    setSourceType,
    sourceLocation,
    setSourceLocation,
    sourceRef,
    setSourceRef,
    repoPreview,
    setRepoPreview,
    setSelectedDiscoveryPaths,
    isPreviewingRepo,
    previewRepositorySource,
    manualServicePaths,
    focusWorkflowStep
  } = ws;
  return (
    <section className="panelBlock">
      <div className="panelHeader compact">
        <h2>Source</h2>
        <span>{sourceLocation.trim() ? sourceType : "Manual mode"}</span>
      </div>
      <label htmlFor="sourceType">Repository source type</label>
      <select
        id="sourceType"
        value={sourceType}
        onChange={(event) => {
          setSourceType(event.target.value);
          setRepoPreview(null);
          setSelectedDiscoveryPaths([]);
        }}
      >
        <option value="LOCAL_PATH">Local path</option>
        <option value="ARCHIVE_PATH">Archive path</option>
        <option value="GITHUB_URL">GitHub URL</option>
      </select>
      <label htmlFor="sourceLocation">Repository source</label>
      <input
        id="sourceLocation"
        placeholder={
          sourceType === "GITHUB_URL"
            ? "https://github.com/example-org/example-repo"
            : "/workspace/tests/fixtures/chatty"
        }
        value={sourceLocation}
        onChange={(event) => {
          setSourceLocation(event.target.value);
          setRepoPreview(null);
          setSelectedDiscoveryPaths([]);
        }}
      />
      {sourceType === "GITHUB_URL" ? (
        <>
          <label htmlFor="sourceRef">Branch or ref</label>
          <input
            id="sourceRef"
            placeholder="main"
            value={sourceRef}
            onChange={(event) => {
              setSourceRef(event.target.value);
              setRepoPreview(null);
              setSelectedDiscoveryPaths([]);
            }}
          />
        </>
      ) : null}
      <div className="panelButtonRow sourceActionRow">
        <button className="secondaryButton" onClick={previewRepositorySource} disabled={isPreviewingRepo}>
          {isPreviewingRepo ? "Previewing..." : "Preview discovery"}
        </button>
        <button
          type="button"
          onClick={() => focusWorkflowStep("review")}
          disabled={!repoPreview && manualServicePaths.length === 0}
        >
          Review services
        </button>
      </div>
      <p className="hint">
        Preview shows likely services with confidence and reasons. Leave this empty to keep using manual service paths
        only.
      </p>
      {!repoPreview && sourceLocation.trim() ? (
        <div className="stepHintCard">
          Preview discovery to unlock the service review step and confirm what MESA will analyze.
        </div>
      ) : null}
    </section>
  );
}
