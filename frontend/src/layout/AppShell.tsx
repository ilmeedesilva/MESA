import React, { type ReactNode } from "react";
import { useEffectEvent } from "../hooks/useEffectEvent";

const focusableSelector =
  'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  overlay
}: {
  sidebarCollapsed: boolean;
  navOpen: boolean;
  onCloseNav: () => void;
  mobileBar: ReactNode;
  sidebar: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const closeNav = useEffectEvent(onCloseNav);

  React.useEffect(() => {
    if (!navOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const menu = document.getElementById("app-sidebar");
    const frame = frameRef.current;
    frame?.setAttribute("inert", "");
    const first =
      menu?.querySelector<HTMLElement>(".sidebarItem.active") ?? menu?.querySelector<HTMLElement>(focusableSelector);
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNav();
        return;
      }
      if (event.key !== "Tab" || !menu) return;
      // Keep keyboard focus inside the menu while it is open.
      const items = [...menu.querySelectorAll<HTMLElement>(focusableSelector)].filter(
        (element) => element.offsetParent !== null
      );
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      frame?.removeAttribute("inert");
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [navOpen, closeNav]);

  const className = ["appShell", sidebarCollapsed ? "sidebarCollapsed" : "", navOpen ? "navOpen" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={className}>
      {mobileBar}
      {sidebar}
      {navOpen ? <div className="navBackdrop" onClick={onCloseNav} aria-hidden="true" /> : null}
      <div className="appFrame" ref={frameRef}>
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
