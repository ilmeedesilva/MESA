import React from "react";
import { api } from "./api";
import type { ArchitectureFitnessGateResult, ArchitectureGateRuleResult } from "./types";

const RULE_LABELS: Record<string, { name: string; explains: string }> = {
  minimum_health_score: {
    name: "Minimum health score",
    explains: "The system health score must reach the minimum set for this gate."
  },
  critical_findings_exceeded: {
    name: "Critical findings",
    explains: "No more critical findings than the allowed maximum."
  },
  cyclic_dependency_detected: {
    name: "No new cyclic dependencies",
    explains: "A new dependency cycle blocks independent deployment."
  },
  governance_violation_detected: {
    name: "No governance violations",
    explains: "The scan must not break any saved project policy."
  },
  high_risk_service_coupling_detected: {
    name: "No new high-risk coupling",
    explains: "No new shared database, cycle or chatty pair between services."
  }
};

function ruleLabel(rule: ArchitectureGateRuleResult) {
  return RULE_LABELS[rule.rule_id] ?? { name: rule.rule_id.replace(/_/g, " "), explains: "" };
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "--";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

export function FitnessGatePanel({ scanId, isDemo }: { scanId: string | null; isDemo: boolean }) {
  const [minimumHealthScore, setMinimumHealthScore] = React.useState(75);
  const [maximumCriticalFindings, setMaximumCriticalFindings] = React.useState(0);
  const [result, setResult] = React.useState<ArchitectureFitnessGateResult | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const runGate = React.useCallback(
    async (minimum: number, maximumCritical: number) => {
      if (!scanId || isDemo) return;
      setIsRunning(true);
      setError(null);
      try {
        const gate = await api<ArchitectureFitnessGateResult>(`/api/scans/${scanId}/gate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            thresholds: { minimum_health_score: minimum, maximum_critical_findings: maximumCritical }
          })
        });
        setResult(gate);
      } catch (gateError) {
        setResult(null);
        setError(gateError instanceof Error ? gateError.message : "Could not evaluate the gate.");
      } finally {
        setIsRunning(false);
      }
    },
    [scanId, isDemo]
  );

  React.useEffect(() => {
    setResult(null);
    void runGate(minimumHealthScore, maximumCriticalFindings);
    // Re-run only when the scan changes; threshold edits run on demand.
  }, [scanId, isDemo]);

  const passed = result?.status === "passed";
  const score = result?.health_score ?? null;

  return (
    <section className="gatePanel">
      <div className="panelHeader compact">
        <div>
          <h2>Architecture Fitness Gate</h2>
          <p>
            Turns the scan into a pass or fail decision against architecture rules, the same check
            <code> mesa gate</code> runs in a CI pipeline.
          </p>
        </div>
        <span>{result ? `${result.rules.length} rules checked` : isRunning ? "Evaluating" : "No result yet"}</span>
      </div>

      {isDemo ? (
        <div className="emptyInline">The fitness gate needs the live backend. Start the API to evaluate this scan.</div>
      ) : null}
      {!isDemo && !scanId ? <div className="emptyInline">Run or load a scan to evaluate the gate.</div> : null}

      {!isDemo && scanId ? (
        <form
          className="gateControls"
          onSubmit={(event) => {
            event.preventDefault();
            void runGate(minimumHealthScore, maximumCriticalFindings);
          }}
        >
          <label>
            <span>Minimum health score</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={minimumHealthScore}
              onChange={(event) => setMinimumHealthScore(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Maximum critical findings</span>
            <input
              type="number"
              min={0}
              step={1}
              value={maximumCriticalFindings}
              onChange={(event) => setMaximumCriticalFindings(Number(event.target.value))}
            />
          </label>
          <button type="submit" disabled={isRunning}>
            {isRunning ? "Evaluating..." : "Run Gate"}
          </button>
        </form>
      ) : null}

      {error ? <div className="error">{error}</div> : null}

      {result ? (
        <>
          <div className={`gateVerdict ${passed ? "passed" : "failed"}`}>
            <div className="gateVerdictBadge">{passed ? "PASSED" : "FAILED"}</div>
            <div className="gateVerdictText">
              <strong>
                {passed
                  ? "This architecture meets every gate rule."
                  : `Blocked by ${result.failed_rules.length} rule${result.failed_rules.length === 1 ? "" : "s"}.`}
              </strong>
              <span>
                {passed
                  ? "In a CI pipeline this change would be allowed to merge."
                  : "In a CI pipeline this change would be stopped until the failed rules are fixed."}
              </span>
            </div>
            <div className="gateScore">
              <strong>{score === null ? "--" : score.toFixed(2)}</strong>
              <span>health score / minimum {result.threshold}</span>
              <div className="gateScoreBar">
                <div className="gateScoreFill" style={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }} />
                <div className="gateScoreMark" style={{ left: `${Math.max(0, Math.min(100, result.threshold))}%` }} />
              </div>
            </div>
          </div>

          <div className="gateRules">
            {result.rules.map((rule) => {
              const label = ruleLabel(rule);
              return (
                <div key={rule.rule_id} className={`gateRule ${rule.passed ? "passed" : "failed"}`}>
                  <span className="gateRuleIcon" aria-hidden="true">{rule.passed ? "✓" : "✕"}</span>
                  <div className="gateRuleBody">
                    <strong>{label.name}</strong>
                    <p>{rule.message}</p>
                    {label.explains ? <p className="gateRuleHint">{label.explains}</p> : null}
                  </div>
                  <div className="gateRuleValues">
                    <span>
                      observed <b>{formatValue(rule.observed_value)}</b>
                    </span>
                    <span>
                      limit <b>{formatValue(rule.threshold)}</b>
                    </span>
                    {rule.related_findings.length ? (
                      <span>{rule.related_findings.length} related finding(s)</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
