import type { ReactNode } from "react";

/** The page grid: sidebar on the left, the main frame on the right, and an optional overlay (the finding drawer). */
export function AppShell({
  sidebarCollapsed,
  sidebar,
  topBar,
  children,
  overlay
}: {
  sidebarCollapsed: boolean;
  sidebar: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  return (
    <main className={sidebarCollapsed ? "appShell sidebarCollapsed" : "appShell"}>
      {sidebar}
      <div className="appFrame">
        {topBar}
        {children}
      </div>
      {overlay}
    </main>
  );
}

/** The framed workspace below the global banners: a header for the current section, the page, and an optional rail. */
export function WorkspaceFrame({
  header,
  rail,
  children
}: {
  header: ReactNode;
  rail: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="workspaceFrame">
      {header}
      <div className={rail ? "workspaceBody workspaceBodyWithRail" : "workspaceBody"}>
        <div className="workspacePrimaryContent">{children}</div>
        {rail}
      </div>
    </section>
  );
}
