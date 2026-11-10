import type { ApiAvailability } from "../types";

export function PublicDemoBanner({
  apiAvailability,
  isPublicDemoMode,
  usingEmbeddedDemo,
  onOpenDoc
}: {
  apiAvailability: ApiAvailability;
  isPublicDemoMode: boolean;
  usingEmbeddedDemo: boolean;
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
          <span>Your MESA server is not connected, so MESA shows example scans, a roadmap and the docs.</span>
        </div>
        <div className="publicDemoActions">
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
