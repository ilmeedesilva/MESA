import React from "react";
import { DocLinkButton } from "./DocLinkButton";
import {
  confidenceLabel,
  findingLocations,
  findingWhyItMatters,
  formatType,
  plainLanguageFindingTitle,
  recommendationPreview,
  renderHighlightedText
} from "../viewHelpers";
import type { Filters, Finding, InterpretationMode } from "../types";

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
          <p>
            {filteredFindings.length} of {findings.length} findings
          </p>
          <div className="docLinks">
            <DocLinkButton label="How to read findings" onClick={() => onOpenDoc("findings-guide")} />
          </div>
        </div>
        <span className="modePill">{interpretationMode === "simple" ? "Plain-language view" : "Technical view"}</span>
      </div>

      <div className="filters findingsFilters">
        <select
          aria-label="Filter by anti-pattern"
          value={filters.type}
          onChange={(event) => onFilterChange({ ...filters, type: event.target.value })}
        >
          <option value="ALL">All anti-patterns</option>
          {filterOptions.types.map((type) => (
            <option key={type} value={type}>
              {formatType(type)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by severity"
          value={filters.severity}
          onChange={(event) => onFilterChange({ ...filters, severity: event.target.value })}
        >
          <option value="ALL">All severities</option>
          {filterOptions.severities.map((severity) => (
            <option key={severity} value={severity}>
              {severity}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by service"
          value={filters.service}
          onChange={(event) => onFilterChange({ ...filters, service: event.target.value })}
        >
          <option value="ALL">All services</option>
          {filterOptions.services.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
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
      {findings.length > 0 && filteredFindings.length === 0 ? (
        <div className="emptyList">No findings match these filters.</div>
      ) : null}

      {filteredFindings.length > 0 ? (
        <div className="findingsGrid">
          {filteredFindings.map((finding) => (
            <article key={finding.id} className="findingCard clickable">
              <div className="findingMeta">
                <span>
                  {interpretationMode === "technical"
                    ? finding.id
                    : `${confidenceLabel(finding.confidence)} confidence`}
                </span>
                <strong className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</strong>
              </div>
              <h3>
                {/* The whole card opens the finding: this button's hit area is stretched over it. */}
                <button type="button" className="findingCardOpen" onClick={() => onSelectFinding(finding)}>
                  {plainLanguageFindingTitle(finding)}
                </button>
              </h3>
              {interpretationMode === "technical" ? <TechnicalDetails finding={finding} /> : null}
              <div className="serviceChips">
                {finding.services.map((service) => (
                  <span key={service}>{service}</span>
                ))}
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
              <div className="findingActions">
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

/** Technical view only: detector, rule and the exact file:line list for one finding card. */
function TechnicalDetails({ finding }: { finding: Finding }) {
  const locations = findingLocations(finding);
  const shown = locations.slice(0, 5);
  return (
    <div className="technicalDetails">
      <div className="technicalLabel">Detector: {finding.detector_name || formatType(finding.type)}</div>
      {finding.rule_id ? <div className="technicalLabel">Rule: {finding.rule_id}</div> : null}
      {shown.length > 0 ? (
        <ul className="findingLocations" aria-label="Where MESA found it">
          {shown.map((location) => (
            <li key={location}>
              <code>{location}</code>
            </li>
          ))}
          {locations.length > shown.length ? <li>and {locations.length - shown.length} more</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
