import React from "react";
import { DocLinkButton } from "./DocLinkButton";
import {
  confidenceLabel,
  findingWhyItMatters,
  formatType,
  plainLanguageFindingTitle,
  recommendationPreview,
  renderHighlightedText
} from "./viewHelpers";
import type { Filters, Finding, InterpretationMode } from "./types";

export function FindingsDashboard({
  findings,
  filteredFindings,
  filters,
  filterOptions,
  interpretationMode,
  onFilterChange,
  onOpenDoc,
  onSelectFinding,
  onAskAI
}: {
  findings: Finding[];
  filteredFindings: Finding[];
  filters: Filters;
  filterOptions: { types: string[]; severities: string[]; services: string[] };
  interpretationMode: InterpretationMode;
  onFilterChange: (filters: Filters) => void;
  onOpenDoc: (slug: string) => void;
  onSelectFinding: (finding: Finding) => void;
  onAskAI: (finding: Finding) => void;
}) {
  return (
    <aside className="findings dashboardFindings">
      <div className="findingsHeader">
        <div className="findingsHeaderText">
          <h2>Findings Dashboard</h2>
          <p>{filteredFindings.length} of {findings.length} findings</p>
          <div className="docLinks">
            <DocLinkButton label="How to read findings" onClick={() => onOpenDoc("findings-guide")} />
          </div>
        </div>
        <span className="modePill">{interpretationMode === "beginner" ? "Plain-language view" : "Research detail view"}</span>
      </div>

      <div className="filters findingsFilters">
        <select value={filters.type} onChange={(event) => onFilterChange({ ...filters, type: event.target.value })}>
          <option value="ALL">All anti-patterns</option>
          {filterOptions.types.map((type) => <option key={type} value={type}>{formatType(type)}</option>)}
        </select>
        <select value={filters.severity} onChange={(event) => onFilterChange({ ...filters, severity: event.target.value })}>
          <option value="ALL">All severities</option>
          {filterOptions.severities.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
        </select>
        <select value={filters.service} onChange={(event) => onFilterChange({ ...filters, service: event.target.value })}>
          <option value="ALL">All services</option>
          {filterOptions.services.map((service) => <option key={service} value={service}>{service}</option>)}
        </select>
        <label className="confidenceFilter">
          <span>Min confidence {Math.round(filters.minConfidence * 100)}%</span>
          <input
            type="range"
            min="0"
            max="0.95"
            step="0.05"
            value={filters.minConfidence}
            onChange={(event) => onFilterChange({ ...filters, minConfidence: Number(event.target.value) })}
          />
        </label>
      </div>

      {findings.length === 0 ? <div className="emptyList">No findings for this scan.</div> : null}
      {findings.length > 0 && filteredFindings.length === 0 ? <div className="emptyList">No findings match these filters.</div> : null}

      {filteredFindings.length > 0 ? (
        <div className="findingsGrid">
          {filteredFindings.map((finding) => (
            <article key={finding.id} className="findingCard clickable" onClick={() => onSelectFinding(finding)}>
              <div className="findingMeta">
                <span>{interpretationMode === "research" ? finding.id : confidenceLabel(finding.confidence)}</span>
                <strong className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</strong>
              </div>
              <h3>{plainLanguageFindingTitle(finding)}</h3>
              {interpretationMode === "research" ? (
                <div className="technicalLabel">Detector: {formatType(finding.type)}</div>
              ) : null}
              <div className="serviceChips">
                {finding.services.map((service) => <span key={service}>{service}</span>)}
              </div>
              <p>{renderHighlightedText(finding.description)}</p>
              <div className="findingHighlights">
                <div>
                  <strong>Why it matters</strong>
                  <span>{findingWhyItMatters(finding)}</span>
                </div>
                <div>
                  <strong>Do first</strong>
                  <span>{recommendationPreview(finding)}</span>
                </div>
              </div>
              <small className="confidenceText">
                {confidenceLabel(finding.confidence)} confidence ({Math.round(finding.confidence * 100)}%)
              </small>
              <div className="findingActions" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="secondaryButton" onClick={() => onAskAI(finding)}>
                  Ask AI
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
