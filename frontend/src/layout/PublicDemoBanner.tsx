import { isDemoSite } from "../demoSite";
import type { ApiAvailability } from "../types";

/**
 * One slim line, only when there is something to act on: demo data is loaded, or the MESA
 * server cannot be reached. Nothing is shown while connected (the footer says "Connected").
 */
export function PublicDemoBanner({
  apiAvailability,
  isPublicDemoMode,
  usingEmbeddedDemo,
  serverRetryStatus,
  onRetryServer,
  onConnectToServer
}: {
  apiAvailability: ApiAvailability;
  isPublicDemoMode: boolean;
  usingEmbeddedDemo: boolean;
  serverRetryStatus: "idle" | "checking" | "failed";
  onRetryServer: () => void;
  onConnectToServer: () => void;
}) {
  // The public demo site never has a server, so it does not offer to connect to one.
  if (isDemoSite) {
    return (
      <div className="statusLine demo" role="status">
        <span>You're viewing a demo with example data. Install MESA to scan your own code.</span>
        <a className="statusLineLink" href="#/docs/quick-start">
          Quick start
        </a>
      </div>
    );
  }

  if (usingEmbeddedDemo) {
    return (
      <div className="statusLine warn" role="status">
        <span>
          {serverRetryStatus === "failed"
            ? "Still can't reach your MESA server. Showing demo data."
            : "Can't reach your MESA server. Showing demo data."}
        </span>
        <button type="button" onClick={onRetryServer} disabled={serverRetryStatus === "checking"}>
          {serverRetryStatus === "checking" ? "Checking..." : "Try again"}
        </button>
      </div>
    );
  }

  if (apiAvailability === "online" && isPublicDemoMode) {
    return (
      <div className="statusLine demo" role="status">
        <span>Viewing demo data</span>
        <button type="button" onClick={onConnectToServer}>
          Connect to your MESA server
        </button>
      </div>
    );
  }

  return null;
}
