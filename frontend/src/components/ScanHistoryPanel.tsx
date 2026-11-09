import { formatDate } from "../viewHelpers";
import type { ScanRecord } from "../types";

export function ScanHistoryPanel({
  history,
  activeScan,
  isLoadingScan,
  isSavingResearchRecord,
  usingEmbeddedDemo,
  onSelectScan,
  onCreateResearchRecord
}: {
  history: ScanRecord[];
  activeScan: ScanRecord | null;
  isLoadingScan: boolean;
  isSavingResearchRecord: boolean;
  usingEmbeddedDemo: boolean;
  onSelectScan: (scanId: string) => void;
  onCreateResearchRecord: (scanId?: string) => void;
}) {
  return (
    <section className="historyPanel">
      <div className="panelHeader compact">
        <h2>Scan History</h2>
        <span>{history.length} scans</span>
      </div>
      <button
        type="button"
        className="fullButton secondaryButton"
        onClick={() => onCreateResearchRecord(activeScan?.id)}
        disabled={!activeScan || isSavingResearchRecord || usingEmbeddedDemo}
      >
        {isSavingResearchRecord ? "Saving Record..." : "Create Research Record"}
      </button>
      <div className="scanList">
        {history.length === 0 ? <div className="emptyInline">No persistent scans yet.</div> : null}
        {history.map((scan) => (
          <button
            key={scan.id}
            className={`scanItem ${activeScan?.id === scan.id ? "active" : ""}`}
            onClick={() => onSelectScan(scan.id)}
            disabled={isLoadingScan}
          >
            <strong>{scan.finding_count} findings</strong>
            <span>{scan.service_count} services</span>
            <small>{formatDate(scan.completed_at ?? scan.created_at)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
