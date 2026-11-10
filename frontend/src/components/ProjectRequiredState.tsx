import { StatePanel } from "./StatePanel";

export function ProjectRequiredState({
  onOpenScan,
  onCreateProject
}: {
  onOpenScan: () => void;
  onCreateProject: () => void;
}) {
  return (
    <StatePanel
      kind="empty"
      title="No project selected"
      actions={
        <>
          <button type="button" onClick={onCreateProject}>
            Create project
          </button>
          <button type="button" className="secondaryButton" onClick={onOpenScan}>
            Go to Scan
          </button>
        </>
      }
    >
      Choose a project in the header, or create one to start scanning.
    </StatePanel>
  );
}
