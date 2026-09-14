import React from "react";
import { formatSigned, shortId } from "./viewHelpers";
import type { EvolutionReport } from "./types";

export function EvolutionPanel({ reports }: { reports: EvolutionReport[] }) {
  const latest = reports[reports.length - 1];
  return (
    <section className="evolutionPanel">
      <div className="panelHeader compact">
        <div>
          <h2>Architecture Evolution</h2>
          <p>Snapshot-to-snapshot architecture change tracking</p>
        </div>
        <span>{reports.length} comparisons</span>
      </div>
      {!latest ? <div className="emptyInline">Run at least two scans to see architecture evolution.</div> : null}
      {latest ? (
        <div className="evolutionGrid">
          <div className="evolutionPrimary">
            <div className="evolutionSummary">
              <div>
                <strong>{formatSigned(latest.score_trend.system_delta)}</strong>
                <span>System score delta</span>
              </div>
              <div>
                <strong>{formatSigned(latest.risk_trend.delta)}</strong>
                <span>Risk delta</span>
              </div>
              <div>
                <strong>{latest.new_dependencies.length}</strong>
                <span>New dependencies</span>
              </div>
              <div>
                <strong>{latest.new_cycles.length}</strong>
                <span>New cycles</span>
              </div>
            </div>
            <p className="evolutionSentence">{String(latest.architecture_change_summary.summary ?? "No summary available.")}</p>
            {latest.recommendations.length ? (
              <div className="evolutionRecommendations">
                <strong>Recommendation</strong>
                <span>{latest.recommendations[0]}</span>
              </div>
            ) : null}
          </div>

          <div className="evolutionSecondary">
            <div className="evolutionSecondaryHeader">
              <strong>Comparison History</strong>
              <span>{reports.length} snapshots</span>
            </div>
            <div className="evolutionTimeline">
              {reports.slice().reverse().map((report) => (
                <article key={`${report.base_scan_id}-${report.target_scan_id}`}>
                  <strong>{`${shortId(report.base_scan_id)} -> ${shortId(report.target_scan_id)}`}</strong>
                  <span>{report.risk_trend.new_risk_count ?? 0} new risks, {report.risk_trend.resolved_risk_count ?? 0} resolved</span>
                  <small>{formatSigned(report.score_trend.system_delta)} health</small>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
