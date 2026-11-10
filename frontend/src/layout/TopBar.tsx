import type { NavigationItem } from "../app/navigation";
import type { ProjectListStatus, ProjectRecord } from "../types";

export function TopBar({
  section,
  projects,
  selectedProject,
  selectedProjectId,
  projectListStatus,
  isLoadingProjectState,
  isPublicDemoMode,
  onSelectProject,
  onCreateProject
}: {
  section: NavigationItem;
  projects: ProjectRecord[];
  selectedProject: ProjectRecord | null;
  selectedProjectId: string;
  projectListStatus: ProjectListStatus;
  isLoadingProjectState: boolean;
  isPublicDemoMode: boolean;
  onSelectProject: (value: string) => void;
  onCreateProject: () => void;
}) {
  return (
    <header className="appHeader">
      <div className="appHeaderIntro">
        <div className="eyebrow">{section.group}</div>
        <h2>{section.label}</h2>
        <p>{section.description}</p>
      </div>

      <div className="appHeaderActions">
        <div className="toolbarProjectShell headerProjectShell">
          <div className="toolbarProjectMeta">
            <strong>
              {isLoadingProjectState
                ? "Loading project..."
                : selectedProject
                  ? selectedProject.name
                  : "No project selected"}
            </strong>
            <small>
              {projectListStatus === "loading"
                ? "Refreshing project list"
                : `${projects.length} available project${projects.length === 1 ? "" : "s"}`}
            </small>
          </div>
          <label className="toolbarProjectPicker">
            <span>Project</span>
            <select
              value={selectedProjectId}
              onChange={(event) => onSelectProject(event.target.value)}
              disabled={projectListStatus === "loading" && !isPublicDemoMode}
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
              {!isPublicDemoMode ? <option value="__create_new__">+ Create new project</option> : null}
            </select>
          </label>
        </div>

        {!isPublicDemoMode ? (
          <button type="button" className="secondaryButton" onClick={onCreateProject}>
            New project
          </button>
        ) : null}
      </div>
    </header>
  );
}
