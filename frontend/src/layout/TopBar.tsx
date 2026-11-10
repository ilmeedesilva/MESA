import type { NavigationItem } from "../app/navigation";
import { ExplanationSwitch } from "../components/ExplanationSwitch";
import type { InterpretationMode, ProjectListStatus, ProjectRecord } from "../types";

/**
 * The page header on tablets and desktops: the page title on the left; the explanation level,
 * the project dropdown and New project on the right. Every control on the right has a fixed size,
 * so nothing moves when the level or the project changes; long project names are cut off with an
 * ellipsis inside the dropdown (the option list shows them in full).
 */
export function TopBar({
  section,
  projects,
  selectedProject,
  selectedProjectId,
  projectListStatus,
  isPublicDemoMode,
  onSelectProject,
  onCreateProject,
  interpretationMode,
  onChangeInterpretationMode
}: {
  section: NavigationItem;
  projects: ProjectRecord[];
  selectedProject: ProjectRecord | null;
  selectedProjectId: string;
  projectListStatus: ProjectListStatus;
  isPublicDemoMode: boolean;
  onSelectProject: (value: string) => void;
  onCreateProject: () => void;
  interpretationMode: InterpretationMode;
  onChangeInterpretationMode: (mode: InterpretationMode) => void;
}) {
  return (
    <header className="appHeader">
      <div className="appHeaderIntro">
        <div className="eyebrow">{section.group}</div>
        <h2>{section.label}</h2>
        <p>{section.description}</p>
      </div>

      <div className="appHeaderActions">
        <ExplanationSwitch mode={interpretationMode} onChangeMode={onChangeInterpretationMode} />
        <label className="headerProjectPicker">
          <span>Project</span>
          <select
            value={selectedProjectId}
            title={selectedProject?.name}
            onChange={(event) => onSelectProject(event.target.value)}
            disabled={projectListStatus === "loading" && !isPublicDemoMode}
          >
            <option value="">{projectListStatus === "loading" ? "Loading projects..." : "Select project"}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
            {!isPublicDemoMode ? <option value="__create_new__">+ Create new project</option> : null}
          </select>
        </label>
        {!isPublicDemoMode ? (
          <button type="button" className="secondaryButton headerNewProject" onClick={onCreateProject}>
            New project
          </button>
        ) : null}
      </div>
    </header>
  );
}
