import { formatDate, shortId } from "../viewHelpers";
import type { ScanRecord } from "../types";

export function ScanHistoryRail({
  history,
  activeScanId,
  isLoadingScan,
  onSelectScan,
  onOpenHistory
}: {
  history: ScanRecord[];
  activeScanId: string | undefined;
  isLoadingScan: boolean;
  onSelectScan: (scanId: string) => void;
  onOpenHistory: () => void;
}) {
  return (
    <aside className="globalScanRail">
      <section className="globalScanRailCard">
        <div className="panelHeader compact">
          <h3>Recent Scans</h3>
          <button type="button" className="railLinkButton" onClick={onOpenHistory}>
            Full history
          </button>
        </div>
        <div className="globalScanRailList">
          {history.slice(0, 6).map((scan) => (
            <button
              key={scan.id}
              type="button"
              className={activeScanId === scan.id ? "globalScanItem active" : "globalScanItem"}
              onClick={() => onSelectScan(scan.id)}
              disabled={isLoadingScan}
            >
              <strong>{shortId(scan.id)}</strong>
              <span>{scan.finding_count} findings</span>
              <small>{formatDate(scan.completed_at ?? scan.created_at)}</small>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
