import type { ReactNode } from "react";
import { EvolutionPanel } from "./EvolutionPanel";
import type { EvolutionReport } from "../types";

/** One History page: the list of scans first, then what changed between them. */
export function HistoryPage({ scanList, evolution }: { scanList: ReactNode; evolution: EvolutionReport[] }) {
  return (
    <div className="historyPage">
      {scanList}
      <EvolutionPanel reports={evolution} />
    </div>
  );
}
