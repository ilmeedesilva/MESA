import React from "react";
import {
  confidenceGuidance,
  confidenceLabel,
  findingLimitation,
  findingWhyItMatters,
  formatType,
  plainLanguageFindingTitle,
  recommendationImpact,
  summarizeEvidence
} from "./viewHelpers";
import type { Finding, InterpretationMode } from "./types";

export function DimensionBars({ breakdown }: { breakdown: Record<string, number> }) {
  return (
    <div className="dimensionBars">
      {Object.entries(breakdown).map(([dimension, score]) => (
        <div key={dimension} className="dimensionRow">
          <span>{formatType(dimension)}</span>
          <div><i style={{ width: `${score}%` }} /></div>
          <strong>{Math.round(score)}</strong>
        </div>
      ))}
    </div>
  );
}

export function RecommendationDetails({
  finding,
  interpretationMode
}: {
  finding: Finding;
  interpretationMode: InterpretationMode;
}) {
  const recommendation = finding.recommendations?.[0];
  if (!recommendation) {
    return (
      <section className="drawerSection recommendation">
        <h3>What to do first</h3>
        <p>{finding.recommendation}</p>
      </section>
    );
  }
  return (
    <section className="drawerSection recommendation structuredRecommendation">
      <div className="recommendationHeader">
        <strong>What to do first</strong>
        <span>{recommendation.priority} priority - {recommendation.estimated_difficulty} difficulty</span>
      </div>
      <dl>
        <dt>Likely root cause</dt>
        <dd>{recommendation.root_cause}</dd>
        <dt>Expected consequence if unchanged</dt>
        <dd>{recommendation.architectural_consequence}</dd>
        <dt>Expected impact after refactor</dt>
        <dd>{recommendation.expected_impact}</dd>
      </dl>
      {recommendation.affected_files.length > 0 ? (
        <div className="affectedFiles">
          <strong>Affected files</strong>
          {recommendation.affected_files.slice(0, 5).map((file) => <code key={file}>{file}</code>)}
        </div>
      ) : null}
      <strong>Suggested refactoring steps</strong>
      <ol>
        {recommendation.refactoring_steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      {interpretationMode === "research" ? <small>Recommendation source: {recommendation.source}</small> : null}
    </section>
  );
}

export function FindingDrawer({
  finding,
  interpretationMode,
  onAskAI,
  onClose
}: {
  finding: Finding;
  interpretationMode: InterpretationMode;
  onAskAI: () => void;
  onClose: () => void;
}) {
  return (
    <div className="drawerOverlay" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <button className="drawerClose" onClick={onClose}>Close</button>
        <div className="findingMeta">
          <span>{finding.id}</span>
          <strong className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</strong>
        </div>
        <h2>{plainLanguageFindingTitle(finding)}</h2>
        <p className="drawerModeNote">
          {interpretationMode === "beginner"
            ? "Beginner mode focuses on the meaning of the result and the first actions to take."
            : "Research mode keeps the same interpretation but also shows raw detector evidence and technical labels."}
        </p>
        {interpretationMode === "research" ? (
          <div className="technicalLabel">Detector: {formatType(finding.type)}</div>
        ) : null}
        <div className="serviceChips">
          {finding.services.map((service) => <span key={service}>{service}</span>)}
        </div>
        <div className="drawerActionRow">
          <button type="button" className="secondaryButton" onClick={onAskAI}>Ask AI About This</button>
        </div>
        <section className="drawerSection">
          <h3>What MESA found</h3>
          <p>{finding.description}</p>
        </section>
        <section className="drawerSection">
          <h3>Why it matters</h3>
          <p>{findingWhyItMatters(finding)}</p>
        </section>
        <section className="drawerSection">
          <h3>Why MESA believes this</h3>
          <p>{finding.why_valid || "MESA attached structured detector evidence to support this finding."}</p>
          <div className="ledgerMetaGrid">
            <div>
              <span>Detector</span>
              <strong>{finding.detector_name || formatType(finding.type)}</strong>
            </div>
            <div>
              <span>Rule</span>
              <strong>{finding.rule_id || "Legacy finding"}</strong>
            </div>
          </div>
          {finding.evidence_chain && finding.evidence_chain.length > 0 ? (
            <ol className="evidenceChainList">
              {finding.evidence_chain.map((item, index) => (
                <li key={`${item.step}-${index}`}>
                  <strong>{formatType(item.step)}</strong>
                  <span>{item.description}</span>
                  {item.source ? (
                    <code>{item.source.file_path}{item.source.line_number ? `:${item.source.line_number}` : ""}</code>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <ul className="evidenceBulletList">
              {summarizeEvidence(finding.evidence).map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
          <small className="supportText">
            {confidenceLabel(finding.confidence)} confidence ({Math.round(finding.confidence * 100)}%). {finding.confidence_reason || confidenceGuidance(finding.confidence)}
          </small>
          {finding.source_files && finding.source_files.length > 0 ? (
            <div className="affectedFiles evidenceFiles">
              <strong>Source files</strong>
              {finding.source_files.slice(0, 6).map((file) => <code key={file}>{file}</code>)}
            </div>
          ) : null}
        </section>
        <RecommendationDetails finding={finding} interpretationMode={interpretationMode} />
        <section className="drawerSection">
          <h3>Expected impact</h3>
          <p>{recommendationImpact(finding)}</p>
        </section>
        <section className="drawerSection">
          <h3>What this does not prove</h3>
          {finding.limitations && finding.limitations.length > 0 ? (
            <ul className="evidenceBulletList">
              {finding.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
            </ul>
          ) : (
            <p>{findingLimitation(finding)}</p>
          )}
        </section>
        {interpretationMode === "research" ? (
          <section className="drawerSection">
            <h3>Raw evidence ledger</h3>
            <pre>{JSON.stringify({
              detector_name: finding.detector_name,
              rule_id: finding.rule_id,
              evidence_chain: finding.evidence_chain,
              source_files: finding.source_files,
              related_services: finding.related_services,
              evidence: finding.evidence
            }, null, 2)}</pre>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
