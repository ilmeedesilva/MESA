import mesaIconUrl from "../assets/brand/mesa-icon.svg";
import mesaLogoUrl from "../assets/brand/mesa-logo.svg";
import { isDemoSite } from "../demoSite";
import { appNavigation } from "../app/navigation";
import { ExplanationSwitch } from "../components/ExplanationSwitch";
import { Icon } from "../components/icons";
import type { AppSection, InterpretationMode, ProjectListStatus, ProjectRecord } from "../types";

export function Sidebar({
  layoutMode,
  collapsed,
  navOpen,
  currentSection,
  isPublicDemoMode,
  projects,
  selectedProjectId,
  projectListStatus,
  onToggleCollapsed,
  onNavigate,
  onToggleDemo,
  onSelectProject,
  onCreateProject,
  interpretationMode,
  onChangeInterpretationMode
}: {
  layoutMode: "phone" | "tablet" | "desktop";
  /** The narrow icon rail (desktop below 1360px wide, or tablet). */
  collapsed: boolean;
  /** The phone menu, or the full sidebar opened over the page on a tablet. */
  navOpen: boolean;
  currentSection: AppSection;
  isPublicDemoMode: boolean;
  projects: ProjectRecord[];
  selectedProjectId: string;
  projectListStatus: ProjectListStatus;
  onToggleCollapsed: () => void;
  onNavigate: (section: AppSection) => void;
  onToggleDemo: () => void;
  onSelectProject: (value: string) => void;
  onCreateProject: () => void;
  interpretationMode: InterpretationMode;
  onChangeInterpretationMode: (mode: InterpretationMode) => void;
}) {
  // On a tablet the rail opens as a full sidebar over the page.
  const showRail = collapsed && !navOpen;
  const isPhone = layoutMode === "phone";
  // On a phone this button sits inside the menu, so it only ever closes it.
  const toggleLabel =
    layoutMode === "desktop"
      ? collapsed
        ? "Expand sidebar"
        : "Collapse sidebar"
      : navOpen || isPhone
        ? "Close menu"
        : "Open menu";
  const className = [
    "appSidebar",
    showRail ? "collapsed" : "",
    navOpen && layoutMode !== "desktop" ? "overlayOpen" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside id="app-sidebar" className={className} aria-label="Main menu">
      <div className="appSidebarTop">
        <div className="appIdentity">
          {showRail ? (
            // The app icon: the mark on a dark tile, so it uses the colours for dark backgrounds.
            <img className="appIdentityMark" src={mesaIconUrl} alt="MESA" width={38} height={38} />
          ) : (
            <>
              <h1 className="appLogo">
                <img src={mesaLogoUrl} alt="MESA" width={132} height={32} />
              </h1>
              <p>Find architecture problems in your microservices before they reach main.</p>
            </>
          )}
        </div>
        <button
          type="button"
          className="sidebarToggle"
          onClick={onToggleCollapsed}
          aria-label={toggleLabel}
          aria-expanded={layoutMode === "desktop" ? !collapsed : navOpen}
          aria-controls="app-sidebar"
        >
          {isPhone ? <Icon name="close" /> : <span>{showRail ? ">" : "<"}</span>}
        </button>
      </div>

      {isPhone ? (
        <div className="sidebarProjectPicker">
          <label>
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
          {!isPublicDemoMode ? (
            <button type="button" className="secondaryButton" onClick={onCreateProject}>
              New project
            </button>
          ) : null}
          <ExplanationSwitch mode={interpretationMode} onChangeMode={onChangeInterpretationMode} showHelp />
        </div>
      ) : null}

      <nav className="sidebarNav" aria-label="Workspace sections">
        {appNavigation.map((group) => (
          <section key={group.group} className="sidebarGroup">
            {!showRail ? <h2>{group.group}</h2> : null}
            <div className="sidebarGroupItems">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === currentSection ? "sidebarItem active" : "sidebarItem"}
                  aria-current={item.id === currentSection ? "page" : undefined}
                  onClick={() => onNavigate(item.id)}
                  title={showRail ? item.label : undefined}
                >
                  {showRail ? <Icon name={item.id} className="sidebarItemIcon" /> : null}
                  <strong>{item.label}</strong>
                  {!showRail ? <span>{item.description}</span> : null}
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>

      {/* The public demo site only has demo data: there is no server to switch to. */}
      {!isDemoSite ? (
        <section className={showRail ? "sidebarFooterAction collapsed" : "sidebarFooterAction"}>
          {!showRail ? (
            <>
              <div>
                <div className="eyebrow">Try it with demo data</div>
                <p>
                  {isPublicDemoMode
                    ? "You are browsing the demo data."
                    : "Load the demo data when you want a safe example project."}
                </p>
              </div>
              <button
                type="button"
                className={isPublicDemoMode ? "secondaryButton sidebarDemoButton" : "sidebarDemoButton"}
                onClick={onToggleDemo}
              >
                {isPublicDemoMode ? "Connect to your MESA server" : "Load demo data"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={isPublicDemoMode ? "secondaryButton sidebarDemoButton compact" : "sidebarDemoButton compact"}
              onClick={onToggleDemo}
              title={isPublicDemoMode ? "Connect to your MESA server" : "Load demo data"}
            >
              Demo
            </button>
          )}
        </section>
      ) : null}
    </aside>
  );
}
