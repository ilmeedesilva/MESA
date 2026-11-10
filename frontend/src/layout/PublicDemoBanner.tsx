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
        <strong>Checking backend availability</strong>
        <span>
          MESA is checking whether the live API is reachable before choosing the best experience for this session.
        </span>
      </section>
    );
  }

  if (usingEmbeddedDemo) {
    return (
      <section className="publicDemoBanner demo">
        <div>
          <strong>Public demo mode is active</strong>
          <span>
            The live backend is not connected, so MESA loaded demo data: example scans, roadmap data, docs, and a guided
            tour.
          </span>
        </div>
        <div className="publicDemoActions">
          <button type="button" className="workflowToggle" onClick={() => onOpenDoc("public-demo-guide")}>
            Demo guide
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
        <strong>Live workspace is available</strong>
        <span>
          {isPublicDemoMode
            ? "The demo data is loaded even though your MESA server is available."
            : "You can analyze your own repositories normally, or switch to the demo data at any time."}
        </span>
      </div>
    </section>
  );
}
