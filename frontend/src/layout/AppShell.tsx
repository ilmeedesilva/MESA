import type { ReactNode } from "react";
import { useModalFocus } from "../hooks/useModalFocus";

/**
 * The page grid: sidebar on the left, the main frame on the right, and an optional overlay (the
 * finding drawer). On phones a top bar replaces the header, and the sidebar slides in as a menu;
 * on tablets the icon rail can open the full sidebar over the page. While the menu is open the
 * page behind it is inert, Esc or a tap on the backdrop closes it, and focus returns to the
 * button that opened it.
 */
export function AppShell({
  sidebarCollapsed,
  navOpen,
  onCloseNav,
  mobileBar,
  sidebar,
  topBar,
  children,
  footer,
  overlay
}: {
  sidebarCollapsed: boolean;
  navOpen: boolean;
  onCloseNav: () => void;
  mobileBar: ReactNode;
  sidebar: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
}) {
  // While the phone menu or tablet overlay is open, the rest of the page is inert, Esc closes it
  // and focus returns to the button that opened it.
  useModalFocus({
    open: navOpen,
    getContainer: () => document.getElementById("app-sidebar"),
    inertSelectors: [".appFrame", ".mobileBar"],
    onClose: onCloseNav,
    initialFocusSelector: ".sidebarItem.active"
  });

  const className = ["appShell", sidebarCollapsed ? "sidebarCollapsed" : "", navOpen ? "navOpen" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {/* First stop for keyboard users: jump past the menu to the page. A button, not a link,
          because the URL hash is used for routing. */}
      <button type="button" className="skipLink" onClick={() => document.getElementById("main-content")?.focus()}>
        Skip to content
      </button>
      {mobileBar}
      {sidebar}
      {navOpen ? <div className="navBackdrop" onClick={onCloseNav} aria-hidden="true" /> : null}
      <div className="appFrame">
        {topBar}
        <main id="main-content" className="appMain" tabIndex={-1}>
          {children}
        </main>
        {footer}
      </div>
      {overlay}
    </div>
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
