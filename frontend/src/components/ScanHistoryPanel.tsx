import { formatDate } from "../viewHelpers";
import type { ScanRecord } from "../types";

export function ScanHistoryPanel({
  history,
  activeScan,
  isLoadingScan,
  onSelectScan
}: {
  history: ScanRecord[];
  activeScan: ScanRecord | null;
  isLoadingScan: boolean;
  onSelectScan: (scanId: string) => void;
}) {
  return (
    <section className="historyPanel">
      <div className="panelHeader compact">
        <h2>Scans</h2>
        <span>{history.length} scans</span>
      </div>
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
