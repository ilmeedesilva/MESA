import type { ReactNode } from "react";

/**
 * One consistent block for empty, loading, good-news and error states: a title, a plain
 * sentence and, where it helps, what to do next.
 */
export function StatePanel({
  kind,
  title,
  children,
  actions
}: {
  kind: "empty" | "loading" | "success" | "error";
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`statePanel ${kind}`}
      role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}
      aria-busy={kind === "loading" ? true : undefined}
    >
      {kind === "loading" ? <span className="stateSpinner" aria-hidden="true" /> : null}
      <div className="statePanelBody">
        <h2>{title}</h2>
        {children ? <p>{children}</p> : null}
        {actions ? <div className="statePanelActions">{actions}</div> : null}
      </div>
    </section>
  );
}
