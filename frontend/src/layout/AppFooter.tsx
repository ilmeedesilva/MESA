import { isDemoSite } from "../demoSite";

export const repositoryUrl = "https://github.com/ilmeedesilva/MESA";

export type ConnectionState = "checking" | "connected" | "demo" | "offline";

const connectionLabels: Record<ConnectionState, string> = {
  checking: "Connecting...",
  connected: "Connected",
  demo: "Demo data",
  offline: "Not connected"
};

export function AppFooter({
  connection,
  serverVersion,
  onOpenDocs
}: {
  connection: ConnectionState;
  serverVersion: string | null;
  onOpenDocs: () => void;
}) {
  return (
    <footer className="appFooter">
      <span className="footerStatus">
        <span className={`connectionStatus ${connection}`}>
          <i className="statusDot" aria-hidden="true" />
          {isDemoSite ? "Demo" : connectionLabels[connection]}
        </span>
        <span>{serverVersion && connection === "connected" ? `MESA version ${serverVersion}` : "MESA"}</span>
      </span>
      <nav aria-label="About MESA">
        <button type="button" className="footerLink" onClick={onOpenDocs}>
          Documentation
        </button>
        <a className="footerLink" href={repositoryUrl} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </nav>
    </footer>
  );
}
