export function ProjectRequiredState({
  onOpenScan,
  onCreateProject
}: {
  onOpenScan: () => void;
  onCreateProject: () => void;
}) {
  return (
    <section className="workspaceEmptyState">
      <div className="eyebrow">Project Required</div>
      <h2>Select a project to continue</h2>
      <p>
        This workspace depends on the globally selected project. Choose one from the header or open the scan workspace
        to create a new project.
      </p>
      <div className="workspaceActionGrid">
        <button type="button" onClick={onOpenScan}>
          Open Scan Workspace
        </button>
        <button type="button" className="secondaryButton" onClick={onCreateProject}>
          Create Project
        </button>
      </div>
    </section>
  );
}
