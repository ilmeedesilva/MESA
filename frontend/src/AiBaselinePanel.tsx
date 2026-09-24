import React from "react";
import { ApiError, api, messageFor } from "./api";
import type {
  AiBaselineComparisonReport,
  AiBaselineFindingLabel,
  AiBaselineRun,
  AiBaselineSystemReport,
  BenchmarkEvaluationReport
} from "./types";

type MesaReference = { precision: number; recall: number; f1_score: number } | null;

type UnstableFinding = AiBaselineFindingLabel & { occurrences: number };

const SYSTEM_DESCRIPTIONS: Record<string, string> = {
  "god-service":
    "Synthetic test case — 8 made-up services, built specifically to check whether accuracy holds up as the number of services grows.",
  "cyclic-dependencies":
    "Synthetic test case — a small, 2-service sanity check. If a model can't get this right consistently, its results on harder cases need even more scrutiny.",
  "spring-sample": "Real, public repository — piomin/sample-spring-microservices-new (6 services).",
  "sock-shop":
    "Real, public repository — Sock Shop (8 services), deliberately messy: real test files and code comments are mixed in with real service code."
};

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
  mesaError
}: {
  system: AiBaselineSystemReport;
  mesaReference: MesaReference;
  mesaError: string | null;
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
          <span className="aiBaselineCompareLabel">General-purpose AI (mean of {system.runs.length} runs)</span>
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
          AI accuracy (F1) on each of the {system.runs.length} identical attempts — the dashed line is where MESA
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

export function AiBaselinePanel() {
  const [report, setReport] = React.useState<AiBaselineComparisonReport | null>(null);
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
    api<AiBaselineComparisonReport>("/api/ai-baseline-comparison")
      .then((result) => {
        if (cancelled) return;
        setReport(result);
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
    if (!report) return;
    let cancelled = false;
    const benchmarkIds = Array.from(new Set(report.systems.map((system) => benchmarkIdFromPath(system.benchmark))));

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
            report.systems
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
  }, [report]);

  const orderedSystems = report
    ? [...report.systems].sort((a, b) => {
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
            MESA vs. a general-purpose AI model, prompted with MESA's own anti-pattern taxonomy and run repeatedly
            on the same code — measuring accuracy and, separately, whether the answer stays the same when nothing
            about the input does.
          </p>
        </div>
        {report ? (
          <span>
            {report.systems.length} system{report.systems.length === 1 ? "" : "s"} · provider: {report.provider}
          </span>
        ) : null}
      </div>

      <div className="aiBaselineIntro">
        <strong>How to read this page</strong>
        <p>
          Every system below was scanned twice: once by MESA, and separately by a general-purpose AI model that was
          given the exact same list of anti-patterns to look for. To test whether the AI's answer can be trusted, it
          was asked the identical question {report ? report.runs_per_system : 5} times on the unchanged code. MESA's
          side of the comparison cannot vary — the same rules on the same code always give the same answer — so its
          numbers are shown once, labelled "by construction." The AI's side shows the average across its repeated
          attempts, plus how much those attempts actually agreed with each other.
        </p>
      </div>

      {isLoading ? <div className="emptyInline">Loading AI baseline comparison...</div> : null}

      {notGenerated ? (
        <div className="emptyInline">
          No AI baseline comparison has been exported yet. Run it from a terminal:
          <pre className="aiBaselineCliHint">mesa evaluate-ai-baseline benchmarks/ground_truth.yml --systems god-service,cyclic-dependencies --runs 5 --provider anthropic --output-dir evaluation-results/ai-baseline-comparison</pre>
          Then reload this page.
        </div>
      ) : null}

      {error ? <div className="error">{error}</div> : null}

      {orderedSystems.length > 0 ? (
        <div className="aiBaselineResults">
          {orderedSystems.map((system) => (
            <SystemCard
              key={system.id}
              system={system}
              mesaReference={mesaReferences[system.id] ?? null}
              mesaError={mesaErrors[system.id] ?? null}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
