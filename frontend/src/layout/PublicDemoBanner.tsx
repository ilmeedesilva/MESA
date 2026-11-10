import type { ApiAvailability } from "../types";

export function PublicDemoBanner({
  apiAvailability,
  isPublicDemoMode,
  usingEmbeddedDemo,
  serverRetryStatus,
  onRetryServer,
  onOpenDoc
}: {
  apiAvailability: ApiAvailability;
  isPublicDemoMode: boolean;
  usingEmbeddedDemo: boolean;
  serverRetryStatus: "idle" | "checking" | "failed";
  onRetryServer: () => void;
  onOpenDoc: (slug: string) => void;
}) {
  if (apiAvailability === "checking") {
    return (
      <section className="publicDemoBanner neutral">
        <strong>Connecting to your MESA server</strong>
        <span>Checking whether your MESA server is running.</span>
      </section>
    );
  }

  if (usingEmbeddedDemo) {
    return (
      <section className="publicDemoBanner demo">
        <div>
          <strong>You're viewing demo data</strong>
          <span>
            MESA can't reach your MESA server, so it shows example scans, a roadmap and the docs. To scan your own code,
            start the server (docker compose up) and choose Try again.
          </span>
          {serverRetryStatus === "failed" ? (
            <span role="alert">Still can't reach your MESA server. Check that it is running, then try again.</span>
          ) : null}
        </div>
        <div className="publicDemoActions">
          <button
            type="button"
            className="workflowToggle"
            onClick={onRetryServer}
            disabled={serverRetryStatus === "checking"}
          >
            {serverRetryStatus === "checking" ? "Checking..." : "Try again"}
          </button>
          <button type="button" className="workflowToggle" onClick={() => onOpenDoc("public-demo-guide")}>
            About demo data
          </button>
          <button type="button" className="workflowToggle" onClick={() => onOpenDoc("quick-start")}>
            Take the tour
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="publicDemoBanner live">
      <div>
        <strong>Connected to your MESA server</strong>
        <span>
          {isPublicDemoMode
            ? "The demo data is loaded even though your MESA server is available."
            : "You can analyze your own repositories normally, or switch to the demo data at any time."}
        </span>
      </div>
    </section>
  );
}
