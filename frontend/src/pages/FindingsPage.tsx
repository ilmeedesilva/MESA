import type { MesaWorkspace } from "../app/useMesaWorkspace";
import { FindingsDashboard } from "../components/FindingsDashboard";
import { plainLanguageFindingTitle } from "../viewHelpers";

export function FindingsPage({ ws }: { ws: MesaWorkspace }) {
  const {
    result,
    filteredFindings,
    filters,
    filterOptions,
    interpretationMode,
    setFilters,
    openDoc,
    openFinding,
    askAIAboutFinding
  } = ws;
  return (
    <FindingsDashboard
      findings={result?.findings ?? []}
      filteredFindings={filteredFindings}
      filters={filters}
      filterOptions={filterOptions}
      interpretationMode={interpretationMode}
      onFilterChange={setFilters}
      onOpenDoc={openDoc}
      onSelectFinding={(finding) => openFinding(finding.id)}
      onAskAI={(finding) => {
        askAIAboutFinding(
          finding,
          `Explain simply why ${plainLanguageFindingTitle(finding).toLowerCase()} should be reviewed.`
        );
      }}
    />
  );
}
