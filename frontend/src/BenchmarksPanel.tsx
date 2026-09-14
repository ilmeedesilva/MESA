import React from "react";
import { api, messageFor } from "./api";
import type { BenchmarkEvaluationReport, BenchmarkListing } from "./types";

export function BenchmarksPanel() {
  const [benchmarks, setBenchmarks] = React.useState<BenchmarkListing[]>([]);
  const [isLoadingList, setIsLoadingList] = React.useState(true);
  const [selectedBenchmarkId, setSelectedBenchmarkId] = React.useState("");
  const [isRunning, setIsRunning] = React.useState(false);
  const [report, setReport] = React.useState<BenchmarkEvaluationReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoadingList(true);
    api<BenchmarkListing[]>("/api/benchmarks")
      .then((listing) => {
        if (cancelled) return;
        setBenchmarks(listing);
        setSelectedBenchmarkId((current) => current || listing[0]?.id || "");
      })
      .catch((caught) => {
        if (!cancelled) setError(messageFor(caught, "Could not load benchmarks"));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runEvaluation() {
    if (!selectedBenchmarkId) return;
    setError(null);
    setIsRunning(true);
    setReport(null);
    try {
      const result = await api<BenchmarkEvaluationReport>(
        `/api/benchmarks/${selectedBenchmarkId}/evaluate`,
        { method: "POST" }
      );
      setReport(result);
    } catch (caught) {
      setError(messageFor(caught, "Benchmark evaluation failed"));
    } finally {
      setIsRunning(false);
    }
  }

  function formatMetric(value: number | null | undefined) {
    return typeof value === "number" ? value.toFixed(4) : "—";
  }

  return (
    <section className="panelBlock">
      <div className="panelHeader compact">
        <div>
          <h2>Benchmarks</h2>
          <p>Ground-truth precision/recall/F1 against seeded synthetic fixtures and manually reviewed real repositories</p>
        </div>
        <span>{benchmarks.length} available</span>
      </div>

      {isLoadingList ? <div className="emptyInline">Loading benchmarks...</div> : null}
      {!isLoadingList && benchmarks.length === 0 ? (
        <div className="emptyInline">No benchmarks found under benchmarks/.</div>
      ) : null}

      {benchmarks.length > 0 ? (
        <div className="benchmarksControls">
          <select value={selectedBenchmarkId} onChange={(event) => setSelectedBenchmarkId(event.target.value)}>
            {benchmarks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.benchmark} ({item.system_count} system{item.system_count === 1 ? "" : "s"})
              </option>
            ))}
          </select>
          <button type="button" className="secondaryButton" onClick={() => void runEvaluation()} disabled={isRunning}>
            {isRunning ? "Running..." : "Run Evaluation"}
          </button>
        </div>
      ) : null}

      {error ? <div className="error">{error}</div> : null}

      {report ? (
        <div className="benchmarksResults">
          <div className="benchmarksMetrics">
            <div>
              <strong>{formatMetric(report.overall.precision)}</strong>
              <span>Detector precision</span>
            </div>
            <div>
              <strong>{formatMetric(report.overall.recall)}</strong>
              <span>Detector recall</span>
            </div>
            <div>
              <strong>{formatMetric(report.overall.f1_score)}</strong>
              <span>Detector F1</span>
            </div>
            <div>
              <strong>{formatMetric(report.discovery.overall.precision)}</strong>
              <span>Discovery precision</span>
            </div>
            <div>
              <strong>{formatMetric(report.discovery.overall.recall)}</strong>
              <span>Discovery recall</span>
            </div>
            <div>
              <strong>{formatMetric(report.discovery.overall.f1_score)}</strong>
              <span>Discovery F1</span>
            </div>
          </div>

          {report.evaluation_notes.systems_with_notes.length > 0 ? (
            <div className="benchmarksNotes">
              <strong>Evaluator notes and known limitations</strong>
              {report.evaluation_notes.systems_with_notes.map((system) => (
                <div key={system.id} className="benchmarksNoteCard">
                  <strong>{system.id}</strong>
                  {system.notes.map((note, index) => (
                    <p key={`note-${index}`}>{note}</p>
                  ))}
                  {system.limitations.map((limitation, index) => (
                    <p key={`limitation-${index}`}>
                      <em>Limitation:</em> {limitation}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
