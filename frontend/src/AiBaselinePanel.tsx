import React from "react";
import { ApiError, api, messageFor } from "./api";
import type {
  AiBaselineComparisonReport,
  AiBaselineComparisonsResponse,
  AiBaselineFindingLabel,
  AiBaselineRun,
  AiBaselineSystemReport,
  BenchmarkEvaluationReport
} from "./types";

type MesaReference = { precision: number; recall: number; f1_score: number } | null;

type UnstableFinding = AiBaselineFindingLabel & { occurrences: number };

const SHORT_SYSTEM_NAMES: Record<string, string> = {
  "spring-sample": "Spring Boot sample",
  "sock-shop": "Sock Shop",
  "god-service": "God Service",
  "cyclic-dependencies": "Cyclic dependencies"
};

const SYSTEM_DESCRIPTIONS: Record<string, string> = {
  "god-service":
    "Synthetic test case — 8 made-up services, built specifically to check whether accuracy holds up as the number of services grows.",
  "cyclic-dependencies":
    "Synthetic test case — a small, 2-service sanity check. If a model can't get this right consistently, its results on harder cases need even more scrutiny.",
  "spring-sample": "Real, public repository — piomin/sample-spring-microservices-new (6 services).",
  "sock-shop":
    "Real, public repository — Sock Shop (8 services), deliberately messy: real test files and code comments are mixed in with real service code."
};

type ModelInfo = { label: string; rankNote: string; tier: "top" | "mid" | "unknown" };

// Leaderboard positions are from the independent Vals AI SWE-bench Verified
// leaderboard (results as of 1 September 2026), cited in the dissertation.
const MODEL_INFO: Record<string, ModelInfo> = {
  "claude-sonnet-5": {
    label: "Claude Sonnet 5",
    rankNote: "A typical mid-tier AI model: ranked 27th of 88 on the SWE-bench Verified coding leaderboard (Vals AI, Sept 2026).",
    tier: "mid"
  },
  "claude-opus-5": {
    label: "Claude Opus 5",
    rankNote: "The strongest AI model tested: ranked 1st of 88 on the SWE-bench Verified coding leaderboard (Vals AI, Sept 2026).",
    tier: "top"
  }
};

const MODEL_ORDER = ["claude-sonnet-5", "claude-opus-5"];

function modelInfo(model: string | null | undefined): ModelInfo {
  if (model && MODEL_INFO[model]) return MODEL_INFO[model];
  return { label: model ?? "AI model (not recorded)", rankNote: "General-purpose AI model.", tier: "unknown" };
}

function scoreTone(f1: number): "good" | "mixed" | "poor" {
  if (f1 >= 0.9) return "good";
  if (f1 >= 0.5) return "mixed";
  return "poor";
}

function realProblemTotal(system: AiBaselineSystemReport): number {
  const first = system.runs[0]?.metrics;
  return first ? first.true_positives + first.false_negatives : 0;
}

function averageFound(system: AiBaselineSystemReport): number {
  if (system.runs.length === 0) return 0;
  const total = system.runs.reduce((sum, run) => sum + run.metrics.true_positives, 0);
  return Math.round(total / system.runs.length);
}

function foundLabel(system: AiBaselineSystemReport): string {
  const counts = new Set(system.runs.map((run) => run.metrics.true_positives));
  const prefix = counts.size > 1 ? "~" : "";
  return `found ${prefix}${averageFound(system)} of ${realProblemTotal(system)}`;
}

function sameAnswerCount(system: AiBaselineSystemReport): number {
  return Math.round(system.determinism.exact_match_rate * system.runs.length);
}

function benchmarkIdFromPath(benchmarkPath: string): string {
  const fileName = benchmarkPath.split("/").pop() ?? benchmarkPath;
  return fileName.replace(/\.ya?ml$/i, "");
}

function isRealRepoBenchmark(benchmarkPath: string): boolean {
  return benchmarkIdFromPath(benchmarkPath).startsWith("real_repo_");
}

function findingsUnstableAcrossRuns(runs: AiBaselineRun[]): UnstableFinding[] {
  const totalRuns = runs.length;
  const occurrences = new Map<string, UnstableFinding>();
  runs.forEach((run) => {
    const seenThisRun = new Set<string>();
    run.false_positives.forEach((finding) => {
      const key = `${finding.type}::${[...finding.services].sort().join(",")}`;
      if (seenThisRun.has(key)) return;
      seenThisRun.add(key);
      const existing = occurrences.get(key);
      if (existing) {
        existing.occurrences += 1;
      } else {
        occurrences.set(key, { type: finding.type, services: finding.services, occurrences: 1 });
      }
    });
  });
  return Array.from(occurrences.values())
    .filter((item) => item.occurrences < totalRuns)
    .sort((a, b) => a.occurrences - b.occurrences);
}

function formatMetric(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(4) : "—";
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "—";
}

function buildPlainEnglishSummary(
  system: AiBaselineSystemReport,
  mesaReference: MesaReference,
  mesaError: string | null
): string[] {
  const sentences: string[] = [];
  const runs = system.runs.length;
  const deterministic = system.determinism.distinct_result_sets === 1;
  const recallPct = formatPercent(system.recall.mean);
  const precisionPct = formatPercent(system.precision.mean);

  if (mesaReference) {
    if (mesaReference.precision === 1 && mesaReference.recall === 1) {
      sentences.push(
        `MESA found every real problem here, correctly, and would score exactly the same on a 6th or 60th run — it isn't guessing, it's running fixed rules against the code.`
      );
    } else {
      sentences.push(
        `MESA scored precision ${formatMetric(mesaReference.precision)} and recall ${formatMetric(mesaReference.recall)} here — and would score exactly the same on a 6th run, because it's not guessing.`
      );
    }
  } else {
    sentences.push(mesaError ?? "MESA's own score for this exact system could not be measured on this machine right now.");
  }

  if (!deterministic) {
    sentences.push(
      `Asked the exact same question ${runs} times, the AI gave ${system.determinism.distinct_result_sets} different answers — on unchanged code, with an unchanged prompt.`
    );
  } else if (system.recall.mean < 0.5 && system.precision.mean >= 0.9) {
    sentences.push(
      `The AI gave the same answer every one of the ${runs} times — it avoided false alarms (precision ${precisionPct}) but missed most of the real problems, catching only ${recallPct} of them.`
    );
  } else if (system.precision.mean < 0.5) {
    sentences.push(
      `The AI gave the same answer every one of the ${runs} times — but only ${precisionPct} of what it flagged was actually a real problem.`
    );
  } else if (system.f1_score.mean < 0.5) {
    sentences.push(
      `The AI gave the same answer every one of the ${runs} times — but that answer was still substantially wrong (F1 ${formatMetric(system.f1_score.mean)}).`
    );
  } else {
    sentences.push(`The AI was consistent and reasonably close to correct on this system.`);
  }

  return sentences;
}

function SystemCard({
  system,
  mesaReference,
  mesaError,
  modelLabel
}: {
  system: AiBaselineSystemReport;
  mesaReference: MesaReference;
  mesaError: string | null;
  modelLabel: string;
}) {
  const unstable = findingsUnstableAcrossRuns(system.runs);
  const runF1s = system.runs.map((run) => run.metrics.f1_score);
  const benchmarkId = benchmarkIdFromPath(system.benchmark);
  const isRealRepo = isRealRepoBenchmark(system.benchmark);
  const description = SYSTEM_DESCRIPTIONS[system.id] ?? (isRealRepo ? "Real, public repository." : "Synthetic test case.");
  const summary = buildPlainEnglishSummary(system, mesaReference, mesaError);

  return (
    <div className="aiBaselineSystem">
      <div className="aiBaselineSystemHeader">
        <div>
          <span className={`aiBaselineBadge ${isRealRepo ? "real" : "synthetic"}`}>
            {isRealRepo ? "Real repository" : "Synthetic test case"}
          </span>
          <strong>{system.name}</strong>
          <span className="aiBaselineSystemMeta">
            {benchmarkId} · {system.runs.length} runs
          </span>
        </div>
      </div>

      <p className="aiBaselineDescription">{description}</p>

      <div className="aiBaselineSummary">
        <strong>What happened here, in plain English</strong>
        <ul>
          {summary.map((sentence, index) => (
            <li key={`sentence-${index}`}>{sentence}</li>
          ))}
        </ul>
      </div>

      <div className="aiBaselineCompare">
        <div className="aiBaselineCompareCol mesa">
          <span className="aiBaselineCompareLabel">MESA (deterministic)</span>
          {mesaReference ? (
            <>
              <div className="aiBaselineStatRow">
                <span>{formatMetric(mesaReference.precision)}</span>Precision
              </div>
              <div className="aiBaselineStatRow">
                <span>{formatMetric(mesaReference.recall)}</span>Recall
              </div>
              <div className="aiBaselineStatRow">
                <span>{formatMetric(mesaReference.f1_score)}</span>F1
              </div>
            </>
          ) : (
            <div className="emptyInline small">{mesaError ?? "MESA reference not available for this system."}</div>
          )}
          <div className="aiBaselineDeterminismNote">
            100% exact-match · 1.00 mean Jaccard, by construction — the same code run through the same rules cannot
            produce a different answer.
          </div>
        </div>
        <div className="aiBaselineCompareCol llm">
          <span className="aiBaselineCompareLabel">
            {modelLabel} (average of {system.runs.length} runs)
          </span>
          <div className="aiBaselineStatRow">
            <span>
              {formatMetric(system.precision.mean)} ± {system.precision.stdev.toFixed(4)}
            </span>
            Precision
          </div>
          <div className="aiBaselineStatRow">
            <span>
              {formatMetric(system.recall.mean)} ± {system.recall.stdev.toFixed(4)}
            </span>
            Recall
          </div>
          <div className="aiBaselineStatRow">
            <span>
              {formatMetric(system.f1_score.mean)} ± {system.f1_score.stdev.toFixed(4)}
            </span>
            F1
          </div>
          <div className="aiBaselineDeterminismNote">
            {formatPercent(system.determinism.exact_match_rate)} exact-match · {system.determinism.mean_pairwise_jaccard.toFixed(2)}{" "}
            mean overlap across {system.determinism.distinct_result_sets} distinct answer
            {system.determinism.distinct_result_sets === 1 ? "" : "s"} out of {system.runs.length} tries.
          </div>
        </div>
      </div>

      <div className="aiBaselineRunStrip">
        <span className="aiBaselineRunStripLabel">
          {modelLabel} accuracy (F1) on each of the {system.runs.length} identical attempts — the dashed line is where MESA
          always sits (1.00, perfect)
        </span>
        <div className="aiBaselineRunChart">
          <div className="aiBaselineRunReferenceLine" />
          <div className="aiBaselineRunBars">
            {runF1s.map((f1, index) => (
              <div key={`run-${index}`} className="aiBaselineRunBar">
                <span className="aiBaselineRunBarValue">{f1.toFixed(2)}</span>
                <div className="aiBaselineRunBarTrack">
                  <div className="aiBaselineRunBarFill" style={{ height: `${Math.max(f1, 0.05) * 100}%` }} />
                </div>
                <span className="aiBaselineRunBarLabel">Run {index + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {unstable.length > 0 ? (
        <div className="aiBaselineEvidence">
          <strong>Findings that showed up in some runs but not others (same code, same prompt, every time)</strong>
          {unstable.map((item, index) => (
            <div key={`unstable-${index}`} className="aiBaselineEvidenceCard">
              <code>{item.type}</code> — {item.services.join(", ")}
              <span> — appeared in {item.occurrences} of {system.runs.length} runs</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Scoreboard({
  reports,
  mesaReferences
}: {
  reports: AiBaselineComparisonReport[];
  mesaReferences: Record<string, MesaReference>;
}) {
  const systemOrder: AiBaselineSystemReport[] = [];
  reports.forEach((report) =>
    report.systems.forEach((system) => {
      if (!systemOrder.some((existing) => existing.id === system.id)) systemOrder.push(system);
    })
  );
  systemOrder.sort((a, b) => Number(isRealRepoBenchmark(b.benchmark)) - Number(isRealRepoBenchmark(a.benchmark)));

  return (
    <div className="aiScoreboard">
      <div className="aiScoreboardHead">
        <strong>The result in one table</strong>
        <p>
          Each cell shows the accuracy score (F1, from 0 to 1, where 1.00 is perfect), how many of the real problems
          were found ("~" means the count changed between runs, so the average is shown), and whether the same answer
          came back every time the identical question was asked.
        </p>
      </div>
      <div className="aiScoreboardScroll">
        <table className="aiScoreboardTable">
          <thead>
            <tr>
              <th>System</th>
              <th className="mesaCol">MESA</th>
              {reports.map((report) => (
                <th key={report.results_dir ?? report.model ?? "model"}>{modelInfo(report.model).label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {systemOrder.map((system) => {
              const mesa = mesaReferences[system.id];
              const total = realProblemTotal(system);
              const isReal = isRealRepoBenchmark(system.benchmark);
              return (
                <tr key={system.id}>
                  <th scope="row">
                    <span className={`aiBaselineBadge ${isReal ? "real" : "synthetic"}`}>{isReal ? "Real" : "Synthetic"}</span>
                    <span className="aiScoreboardSystemName">{SHORT_SYSTEM_NAMES[system.id] ?? system.name}</span>
                  </th>
                  <td className={`aiScoreCell ${mesa ? scoreTone(mesa.f1_score) : ""}`}>
                    {mesa ? (
                      <>
                        <span className="aiScoreValue">{mesa.f1_score.toFixed(2)}</span>
                        <span className="aiScoreDetail">
                          found {Math.round(mesa.recall * total)} of {total}
                        </span>
                        <span className="aiScoreConsistency consistent">Same answer every time</span>
                      </>
                    ) : (
                      <span className="aiScoreDetail">measuring…</span>
                    )}
                  </td>
                  {reports.map((report) => {
                    const result = report.systems.find((candidate) => candidate.id === system.id);
                    if (!result) {
                      return (
                        <td key={report.results_dir ?? report.model ?? "model"} className="aiScoreCell">
                          <span className="aiScoreDetail">not run</span>
                        </td>
                      );
                    }
                    const same = sameAnswerCount(result);
                    const runs = result.runs.length;
                    return (
                      <td
                        key={report.results_dir ?? report.model ?? "model"}
                        className={`aiScoreCell ${scoreTone(result.f1_score.mean)}`}
                      >
                        <span className="aiScoreValue">{result.f1_score.mean.toFixed(2)}</span>
                        <span className="aiScoreDetail">{foundLabel(result)}</span>
                        <span className={`aiScoreConsistency ${same === runs ? "consistent" : "inconsistent"}`}>
                          {same === runs ? "Same answer every time" : `Same answer in only ${same} of ${runs} runs`}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="aiScoreboardTakeaways">
        <li>
          <strong>MESA</strong> scored 1.00 on every system and gives the identical answer every time, because it runs
          fixed rules over the code instead of generating a guess.
        </li>
        {reports.map((report) => {
          const info = modelInfo(report.model);
          const realSystems = report.systems.filter((system) => isRealRepoBenchmark(system.benchmark));
          const bestRealRecall = realSystems.length
            ? Math.max(...realSystems.map((system) => system.recall.mean))
            : null;
          const fullyConsistent = report.systems.filter((system) => sameAnswerCount(system) === system.runs.length).length;
          return (
            <li key={`takeaway-${report.results_dir ?? report.model}`}>
              <strong>{info.label}</strong>
              {bestRealRecall !== null
                ? ` found at most ${Math.round(bestRealRecall * 100)}% of the real problems in the real repositories`
                : ""}
              , and gave the same answer on all runs for {fullyConsistent} of {report.systems.length} systems.
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ModelCards({ reports }: { reports: AiBaselineComparisonReport[] }) {
  return (
    <div className="aiModelCards">
      <div className="aiModelCard mesa">
        <span className="aiModelCardTag">The tool built in this research</span>
        <strong>MESA</strong>
        <p>Fixed, rule-based static analysis. The same code always gives the same answer.</p>
      </div>
      {reports.map((report) => {
        const info = modelInfo(report.model);
        return (
          <div key={report.results_dir ?? report.model ?? "model"} className={`aiModelCard ${info.tier}`}>
            <span className="aiModelCardTag">
              {info.tier === "top" ? "Strongest AI tested" : info.tier === "mid" ? "Typical AI model" : "AI model"}
            </span>
            <strong>{info.label}</strong>
            <p>{info.rankNote}</p>
            <p className="aiModelCardMeta">
              Asked the identical question {report.runs_per_system} times per system, with the same anti-pattern list MESA
              uses.
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function AiBaselinePanel() {
  const [reports, setReports] = React.useState<AiBaselineComparisonReport[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [notGenerated, setNotGenerated] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mesaReferences, setMesaReferences] = React.useState<Record<string, MesaReference>>({});
  const [mesaErrors, setMesaErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotGenerated(false);
    setError(null);
    api<AiBaselineComparisonsResponse>("/api/ai-baseline-comparisons")
      .then((result) => {
        if (cancelled) return;
        const ordered = [...result.reports].sort((a, b) => {
          const rank = (report: AiBaselineComparisonReport) => {
            const index = MODEL_ORDER.indexOf(report.model ?? "");
            return index === -1 ? MODEL_ORDER.length : index;
          };
          return rank(a) - rank(b);
        });
        setReports(ordered);
        setSelectedIndex(0);
      })
      .catch((caught) => {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setNotGenerated(true);
        } else {
          setError(messageFor(caught, "Could not load the AI baseline comparison"));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (reports.length === 0) return;
    let cancelled = false;
    const allSystems = reports.flatMap((report) => report.systems);
    const benchmarkIds = Array.from(new Set(allSystems.map((system) => benchmarkIdFromPath(system.benchmark))));

    benchmarkIds.forEach((benchmarkId) => {
      api<BenchmarkEvaluationReport>(`/api/benchmarks/${benchmarkId}/evaluate`, { method: "POST" })
        .then((result) => {
          if (cancelled) return;
          const byId = (result as unknown as { systems: Array<{ id: string; metrics: { precision: number; recall: number; f1_score: number } }> })
            .systems;
          setMesaReferences((current) => {
            const next = { ...current };
            byId.forEach((system) => {
              next[system.id] = {
                precision: system.metrics.precision,
                recall: system.metrics.recall,
                f1_score: system.metrics.f1_score
              };
            });
            return next;
          });
        })
        .catch((caught) => {
          if (cancelled) return;
          const message = messageFor(caught, "MESA reference unavailable");
          setMesaErrors((current) => {
            const next = { ...current };
            allSystems
              .filter((system) => benchmarkIdFromPath(system.benchmark) === benchmarkId)
              .forEach((system) => {
                next[system.id] = message;
              });
            return next;
          });
        });
    });

    return () => {
      cancelled = true;
    };
  }, [reports]);

  const selected = reports[selectedIndex] ?? null;
  const selectedLabel = modelInfo(selected?.model).label;
  const orderedSystems = selected
    ? [...selected.systems].sort((a, b) => {
        const aReal = isRealRepoBenchmark(a.benchmark) ? 0 : 1;
        const bReal = isRealRepoBenchmark(b.benchmark) ? 0 : 1;
        return aReal - bReal;
      })
    : [];

  return (
    <section className="panelBlock">
      <div className="panelHeader compact">
        <div>
          <h2>AI Baseline Comparison</h2>
          <p>
            Can a general-purpose AI model find the same architectural problems as MESA, and does it give the same
            answer when asked the same question again?
          </p>
        </div>
        {reports.length > 0 ? (
          <span>
            {reports.length} AI model{reports.length === 1 ? "" : "s"} tested · {reports[0].runs_per_system} runs per system
          </span>
        ) : null}
      </div>

      {isLoading ? <div className="emptyInline">Loading AI baseline comparison...</div> : null}

      {notGenerated ? (
        <div className="emptyInline">
          No AI baseline comparison has been exported yet. Run it from a terminal, with one output directory per model:
          <pre className="aiBaselineCliHint">MESA_ANTHROPIC_MODEL=claude-opus-5 mesa evaluate-ai-baseline benchmarks/ground_truth.yml --systems god-service,cyclic-dependencies --runs 5 --provider anthropic --output-dir evaluation-results/ai-baseline-comparison-opus5</pre>
          Then reload this page.
        </div>
      ) : null}

      {error ? <div className="error">{error}</div> : null}

      {reports.length > 0 ? (
        <>
          <ModelCards reports={reports} />
          <Scoreboard reports={reports} mesaReferences={mesaReferences} />

          <div className="aiBaselineIntro">
            <strong>How the test worked</strong>
            <p>
              Every system was checked by MESA and, separately, by each AI model. The AI was given the exact same list
              of anti-patterns that MESA looks for, plus the system's source code, and was asked the identical question{" "}
              {reports[0].runs_per_system} times on the unchanged code. Both were scored against the same answer key
              using the same scoring rules.
            </p>
          </div>

          <div className="aiModelTabs" role="tablist" aria-label="Choose which AI model's detailed results to show">
            <span className="aiModelTabsLabel">Detailed results for:</span>
            {reports.map((report, index) => (
              <button
                key={report.results_dir ?? report.model ?? index}
                type="button"
                role="tab"
                aria-selected={index === selectedIndex}
                className={index === selectedIndex ? "active" : ""}
                onClick={() => setSelectedIndex(index)}
              >
                {modelInfo(report.model).label}
              </button>
            ))}
          </div>

          <div className="aiBaselineResults">
            {orderedSystems.map((system) => (
              <SystemCard
                key={`${selected?.results_dir}-${system.id}`}
                system={system}
                mesaReference={mesaReferences[system.id] ?? null}
                mesaError={mesaErrors[system.id] ?? null}
                modelLabel={selectedLabel}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
