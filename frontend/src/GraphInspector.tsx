import React from "react";
import { formatType } from "./viewHelpers";
import type { ApiAvailability, GraphSelection } from "./types";

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
        <span>MESA is checking whether the live API is reachable before choosing the best experience for this session.</span>
      </section>
    );
  }

  if (usingEmbeddedDemo) {
    return (
      <section className="publicDemoBanner demo">
        <div>
          <strong>Public demo mode is active</strong>
          <span>
            The live backend is not connected, so MESA loaded embedded example scans, roadmap data, docs, and a guided evaluator-friendly walkthrough.
          </span>
        </div>
        <div className="publicDemoActions">
          <button type="button" className="workflowToggle" onClick={() => onOpenDoc("public-demo-guide")}>
            Demo guide
          </button>
          <button type="button" className="workflowToggle" onClick={() => onOpenDoc("evaluator-quick-start")}>
            Evaluator walkthrough
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="publicDemoBanner live">
      <div>
        <strong>Live workspace is available</strong>
        <span>{isPublicDemoMode ? "The embedded demo workspace is loaded even though the live backend is available." : "You can analyze your own repositories normally, or switch to the embedded public demo examples at any time."}</span>
      </div>
    </section>
  );
}

export function GraphInspector({ selection }: { selection: GraphSelection | null }) {
  if (!selection) {
    return (
      <div className="graphInspector emptyInspector">
        Click a service, API, database, or dependency edge to inspect digital-twin evidence.
      </div>
    );
  }
  return (
    <div className="graphInspector">
      <div className="findingMeta">
        <span>{selection.kind.toUpperCase()}</span>
        <strong>{selection.findings.length} linked findings</strong>
      </div>
      <h3>{selection.title}</h3>
      <p>{selection.subtitle}</p>
      {selection.healthScore ? (
        <div className="miniHealth">
          <strong>{selection.healthScore.score.toFixed(1)}</strong>
          <span>{selection.healthScore.grade} health</span>
        </div>
      ) : null}
      {selection.findings.length > 0 ? (
        <div className="linkedFindings">
          {selection.findings.slice(0, 4).map((finding) => (
            <span key={finding.id} className={`severity ${finding.severity.toLowerCase()}`}>{formatType(finding.type)}</span>
          ))}
        </div>
      ) : null}
      <details>
        <summary>Evidence properties</summary>
        <pre>{JSON.stringify(selection.properties, null, 2)}</pre>
      </details>
    </div>
  );
}
