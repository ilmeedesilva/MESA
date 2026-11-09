import { Icon } from "./icons";
import { formatType } from "../viewHelpers";
import type { GraphSelection } from "../types";

/** Details of the clicked graph element. On phones it opens as a bottom sheet with a close button. */
export function GraphInspector({ selection, onClose }: { selection: GraphSelection | null; onClose?: () => void }) {
  if (!selection) {
    return (
      <div className="graphInspector emptyInspector">
        Click a service, API, database, or dependency edge to inspect digital-twin evidence.
      </div>
    );
  }
  return (
    <div className="graphInspector hasSelection">
      {onClose ? (
        <button type="button" className="graphInspectorClose" onClick={onClose} aria-label="Close details">
          <Icon name="close" />
        </button>
      ) : null}
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
            <span key={finding.id} className={`severity ${finding.severity.toLowerCase()}`}>
              {formatType(finding.type)}
            </span>
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
