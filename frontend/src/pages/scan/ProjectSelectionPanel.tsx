import type { MesaWorkspace } from "../../app/useMesaWorkspace";

export function ProjectSelectionPanel({ ws }: { ws: MesaWorkspace }) {
  const {
    projects,
    projectListStatus,
    projectListError,
    selectedProjectId,
    selectedProject,
    showCreateProjectForm,
    setShowCreateProjectForm,
    isCreating,
    projectName,
    setProjectName,
    projectDescription,
    setProjectDescription,
    createProject,
    updateSelectedProject
  } = ws;
  return (
    <section className="panelBlock">
      <div className="panelHeader compact">
        <h2>Project Selection</h2>
        <span>{projects.length} available</span>
      </div>
      <div className={showCreateProjectForm ? "projectStepLayout withCreatePanel" : "projectStepLayout"}>
        <section className="projectSelectionPanel">
          <div className="projectChoiceHeader">
            <div className="stepHintCard compact">
              Select an existing project to restore its scan flow, or create a new project to start fresh.
            </div>
            <button
              type="button"
              className={showCreateProjectForm ? "secondaryButton activeInlineButton" : "secondaryButton"}
              onClick={() => setShowCreateProjectForm((current) => !current)}
            >
              {showCreateProjectForm ? "Hide Create Project" : "Create New Project"}
            </button>
          </div>
          <div className="projectSelectionControls">
            <div className="projectSelectionField">
              <label htmlFor="scanProjectSelect">Select existing project</label>
              <select
                id="scanProjectSelect"
                value={selectedProjectId}
                onChange={(event) => updateSelectedProject(event.target.value, "push")}
                disabled={isCreating || projectListStatus === "loading"}
              >
                <option value="">Choose a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedProject ? (
              <div className="selectedProjectSummary">
                <strong>Selected</strong>
                <span>{selectedProject.name}</span>
                <small>{selectedProject.description || "Saved project ready to restore and rescan."}</small>
              </div>
            ) : null}
          </div>
          {projectListStatus === "loading" ? <p className="hint">Loading existing projects...</p> : null}
          {projectListStatus === "error" && projectListError ? <div className="error">{projectListError}</div> : null}
          {projectListStatus === "ready" && projects.length === 0 ? (
            <div className="stepHintCard">No projects exist yet. Create a project to start a fresh scan workflow.</div>
          ) : null}
          {projects.length > 0 ? (
            <div className="projectQuickList">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={selectedProjectId === project.id ? "projectQuickButton active" : "projectQuickButton"}
                  onClick={() => updateSelectedProject(project.id, "push")}
                >
                  <strong>{project.name}</strong>
                  <small>{project.description || "Open saved setup and scan history"}</small>
                </button>
              ))}
            </div>
          ) : null}
        </section>
        {showCreateProjectForm ? (
          <section className="projectCreatePanel">
            <div className="panelHeader compact">
              <h3>Create New Project</h3>
              <span>Fresh setup</span>
            </div>
            <label htmlFor="projectName">Project name</label>
            <input id="projectName" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            <label htmlFor="projectDescription">Description</label>
            <input
              id="projectDescription"
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
            />
            <button className="fullButton" onClick={createProject} disabled={isCreating || !projectName.trim()}>
              {isCreating ? "Creating..." : "Create Project"}
            </button>
          </section>
        ) : null}
      </div>
    </section>
  );
}
