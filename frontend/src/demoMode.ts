import { docBySlug, docsByQuery } from "./docsPortal";
import { demoWorkspace } from "./demoData";
import { formatType, getMostUrgentFinding, recommendationPreview, shortId, summaryFindingTitle } from "./viewHelpers";
import type {
  AIExplainerIntent,
  AIExplainerResponse,
  AnalysisResult,
  HealthScore,
  PersistedScanResult,
  RemediationRoadmap,
  RoadmapBucket,
  ScanRecord
} from "./types";

export function bucketLabel(bucket: RoadmapBucket) {
  if (bucket === "quick_win") return "Quick win";
  if (bucket === "medium_term") return "Medium-term";
  return "High-effort";
}

export function isPublicDemoProject(projectId: string) {
  return projectId === demoWorkspace.project.id;
}

export function isDemoScan(scanId: string) {
  return demoWorkspace.scans.some((scan) => scan.id === scanId);
}

export function demoPersistedScan(scanId: string): PersistedScanResult {
  const scan = demoWorkspace.scans.find((item) => item.id === scanId);
  const result = demoWorkspace.results[scanId as keyof typeof demoWorkspace.results];
  if (!scan || !result) {
    throw new Error("Demo scan payload is not available.");
  }
  return {
    scan: scan as unknown as ScanRecord,
    result: result as unknown as AnalysisResult
  };
}

export function localDemoAIResponse({
  intent,
  question,
  activeScan,
  result,
  scores,
  compareBaseScan,
  roadmap,
  docQuery
}: {
  intent: AIExplainerIntent;
  question: string;
  activeScan: ScanRecord | null;
  result: AnalysisResult | null;
  scores: HealthScore[];
  compareBaseScan: ScanRecord | null;
  roadmap: RemediationRoadmap | null;
  docQuery?: string;
}): AIExplainerResponse {
  const resolvedIntent = intent === "AUTO" ? resolveDemoIntent(question, Boolean(result), Boolean(docQuery)) : intent;
  const urgentFinding = result ? getMostUrgentFinding(result.findings) : null;
  const systemScore = scores.find((score) => score.scope === "system") ?? result?.summary.health_scores?.system ?? null;

  if (resolvedIntent === "DOC_QA") {
    const docs = docsByQuery(docQuery || question, "ALL");
    const doc = docs[0] ?? docBySlug("public-demo-guide");
    return {
      intent: "DOC_QA",
      title: `Doc answer: ${doc.title}`,
      answer: `${doc.summary} Open the ${doc.title} page from the documentation workspace for the full step-by-step guide.`,
      evidence: [
        {
          kind: "doc",
          label: doc.title,
          pointer: doc.path.replace("../../docs/", "docs/"),
          snippet: doc.summary
        }
      ],
      suggestions: ["Open the full documentation page from inside MESA.", "Use the evaluator quick start if you are reviewing the demo."],
      follow_up_questions: ["How do I use this demo?", "What should I look at first in the results?"],
      limitations: ["This answer is from embedded documentation, not the live backend."],
      confidence: "HIGH",
      grounded: true,
      source: "mesa-public-demo-docs"
    };
  }

  if (!result || !activeScan) {
    return {
      intent: resolvedIntent,
      title: "Demo data not loaded",
      answer: "Load the embedded demo workspace first so MESA can show example results.",
      evidence: [],
      suggestions: ["Use the public demo workspace banner to load embedded examples."],
      follow_up_questions: ["How do I use this demo?"],
      limitations: ["No active demo scan was loaded."],
      confidence: "LOW",
      grounded: true,
      source: "mesa-public-demo"
    };
  }

  if (resolvedIntent === "PRIORITIZE_FIXES") {
    const firstAction = roadmap?.suggested_order[0];
    return {
      intent: "PRIORITIZE_FIXES",
      title: "Recommended fix order",
      answer: firstAction
        ? `Start with ${firstAction.title.toLowerCase()}. In this demo scan, that action comes first because it reduces immediate coupling and clears the path for the larger structural fixes that follow.`
        : `Start with ${summaryFindingTitle(urgentFinding ?? result.findings[0]).toLowerCase()}. This is the strongest signal in the current demo result.`,
      evidence: [
        {
          kind: "scan",
          label: "Demo scan",
          pointer: activeScan.id,
          snippet: `${result.summary.finding_count} findings across ${result.summary.service_count} services.`
        },
        ...(roadmap?.suggested_order[0]
          ? [
              {
                kind: "roadmap",
                label: "Suggested order",
                pointer: roadmap.suggested_order[0].action_id,
                snippet: roadmap.suggested_order[0].why_now
              }
            ]
          : [])
      ],
      suggestions: roadmap?.suggested_order.slice(0, 3).map((step) => step.title) ?? [recommendationPreview(urgentFinding ?? result.findings[0])],
      follow_up_questions: ["Explain the top finding.", "Why is the health score low?"],
      limitations: ["This answer is generated from embedded demo data, not from a live backend response."],
      confidence: "HIGH",
      grounded: true,
      source: "mesa-public-demo"
    };
  }

  if (resolvedIntent === "HEALTH_SCORE_EXPLANATION" && systemScore) {
    return {
      intent: "HEALTH_SCORE_EXPLANATION",
      title: "Demo health score explanation",
      answer: `${systemScore.target} is graded ${systemScore.grade.toLowerCase()} with a score of ${systemScore.score.toFixed(1)}/100. In this demo, the weakest areas are ${Object.entries(systemScore.breakdown)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .map(([dimension]) => formatType(dimension).toLowerCase())
        .join(", ")}.`,
      evidence: [
        {
          kind: "score",
          label: "System score",
          pointer: "health_scores.system",
          snippet: `${systemScore.score.toFixed(1)}/100 (${systemScore.grade})`
        }
      ],
      suggestions: systemScore.recommendations.slice(0, 3),
      follow_up_questions: ["What should I fix first?", "Show me the roadmap."],
      limitations: ["This explanation comes from embedded example results."],
      confidence: "HIGH",
      grounded: true,
      source: "mesa-public-demo"
    };
  }

  if (resolvedIntent === "COMPARE_SCANS" && compareBaseScan) {
    const latestReport = demoWorkspace.evolution[0];
    return {
      intent: "COMPARE_SCANS",
      title: "Demo comparison summary",
      answer: `Between ${shortId(compareBaseScan.id)} and ${shortId(activeScan.id)}, the example system added more services, more dependencies, and more risks. The later snapshot is more platform-centered and the overall health score dropped by ${latestReport.score_trend.system_delta}.`,
      evidence: [
        {
          kind: "comparison",
          label: "Architecture change summary",
          pointer: "architecture_change_summary.summary",
          snippet: String(latestReport.architecture_change_summary.summary)
        }
      ],
      suggestions: [...latestReport.recommendations],
      follow_up_questions: ["What should I fix first?", "Explain the roadmap order."],
      limitations: ["The comparison is between two embedded demo scans."],
      confidence: "HIGH",
      grounded: true,
      source: "mesa-public-demo"
    };
  }

  if (resolvedIntent === "POLICY_WRITING_ASSISTANCE") {
    return {
      intent: "POLICY_WRITING_ASSISTANCE",
      title: "Demo policy draft",
      answer: "This embedded demo suggests starting with rules for dependency cycles, hard-coded service URLs, and outbound dependency limits.",
      evidence: [
        {
          kind: "policy",
          label: "Current demo policy set",
          pointer: "policies",
          snippet: "The demo project already includes policies for cycles, hard-coded URLs, and outbound dependency limits."
        }
      ],
      suggestions: ["Save the current draft into a live project when the backend is available.", "Keep policy names simple and specific for evaluators."],
      follow_up_questions: ["Explain governance simply.", "What should I fix first?"],
      limitations: ["Draft generation is static in public demo mode."],
      policy_document: demoWorkspace.policyText,
      confidence: "MODERATE",
      grounded: true,
      source: "mesa-public-demo"
    };
  }

  const scanSummary = `This demo scan shows ${result.summary.finding_count} findings across ${result.summary.service_count} services. The most urgent area is ${summaryFindingTitle(urgentFinding ?? result.findings[0]).toLowerCase()}, and the roadmap is designed to show what should be cleaned up first versus what needs deeper refactoring.`;
  return {
    intent: resolvedIntent,
    title: "Demo scan summary",
    answer: scanSummary,
    evidence: [
      {
        kind: "scan",
        label: "Demo scan summary",
        pointer: activeScan.id,
        snippet: `${result.summary.finding_count} findings across ${result.summary.service_count} services.`
      },
      ...(urgentFinding
        ? [
            {
              kind: "finding",
              label: summaryFindingTitle(urgentFinding),
              pointer: urgentFinding.id,
              snippet: urgentFinding.description
            }
          ]
        : [])
    ],
    suggestions: roadmap?.suggested_order.slice(0, 3).map((step) => step.title) ?? ["Open the remediation roadmap.", "Inspect the architecture graph.", "Compare the two demo scans."],
    follow_up_questions: ["What should I fix first?", "Explain the health score.", "How do I use this demo?"],
    limitations: ["This answer comes from embedded example results and does not analyze your own repository."],
    confidence: "HIGH",
    grounded: true,
    source: "mesa-public-demo"
  };
}

export function resolveDemoIntent(question: string, hasScan: boolean, hasDocQuery: boolean) {
  const normalized = `${question} ${hasDocQuery ? "doc" : ""}`.toLowerCase();
  if (normalized.includes("fix first") || normalized.includes("solve first") || normalized.includes("priority")) return "PRIORITIZE_FIXES";
  if (normalized.includes("health") || normalized.includes("score")) return "HEALTH_SCORE_EXPLANATION";
  if (normalized.includes("compare") || normalized.includes("changed")) return "COMPARE_SCANS";
  if (normalized.includes("policy") || normalized.includes("governance") || normalized.includes("yaml")) return "POLICY_WRITING_ASSISTANCE";
  if (normalized.includes("doc") || normalized.includes("guide") || normalized.includes("how do i") || normalized.includes("how to")) return "DOC_QA";
  return hasScan ? "SCAN_SUMMARY" : "DOC_QA";
}
