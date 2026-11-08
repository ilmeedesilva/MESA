import { appNavigation } from "../app/navigation";
import type { AppSection } from "../types";

export function Sidebar({
  collapsed,
  currentSection,
  isPublicDemoMode,
  onToggleCollapsed,
  onNavigate,
  onToggleDemo
}: {
  collapsed: boolean;
  currentSection: AppSection;
  isPublicDemoMode: boolean;
  onToggleCollapsed: () => void;
  onNavigate: (section: AppSection) => void;
  onToggleDemo: () => void;
}) {
  return (
    <aside className={collapsed ? "appSidebar collapsed" : "appSidebar"}>
      <div className="appSidebarTop">
        <div className="appIdentity">
          {collapsed ? (
            <div className="appIdentityMark" aria-label="MESA">
              M
            </div>
          ) : (
            <>
              <div className="eyebrow">Architecture Analyzer</div>
              <h1>MESA</h1>
              <p>Structured project selection, scanning, findings analysis, and research evidence in one workspace.</p>
            </>
          )}
        </div>
        <button
          type="button"
          className="sidebarToggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span>{collapsed ? ">" : "<"}</span>
        </button>
      </div>

      <nav className="sidebarNav" aria-label="Workspace sections">
        {appNavigation.map((group) => (
          <section key={group.group} className="sidebarGroup">
            {!collapsed ? <h2>{group.group}</h2> : null}
            <div className="sidebarGroupItems">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === currentSection ? "sidebarItem active" : "sidebarItem"}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                >
                  <strong>{item.label}</strong>
                  {!collapsed ? <span>{item.description}</span> : null}
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <section className={collapsed ? "sidebarFooterAction collapsed" : "sidebarFooterAction"}>
        {!collapsed ? (
          <>
            <div>
              <div className="eyebrow">Demo Workspace</div>
              <p>
                {isPublicDemoMode
                  ? "You are browsing the embedded evaluator demo."
                  : "Load the embedded public demo when you want a safe example project."}
              </p>
            </div>
            <button
              type="button"
              className={isPublicDemoMode ? "secondaryButton sidebarDemoButton" : "sidebarDemoButton"}
              onClick={onToggleDemo}
            >
              {isPublicDemoMode ? "Return to Live Workspace" : "Load Demo Workspace"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={isPublicDemoMode ? "secondaryButton sidebarDemoButton compact" : "sidebarDemoButton compact"}
            onClick={onToggleDemo}
            title={isPublicDemoMode ? "Return to live workspace" : "Load demo workspace"}
          >
            Demo
          </button>
        )}
      </section>
    </aside>
  );
}
