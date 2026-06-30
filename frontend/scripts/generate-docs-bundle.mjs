import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const docsRootCandidates = [
  path.resolve(frontendRoot, "docs"),
  path.resolve(frontendRoot, "..", "docs")
];

const docs = [
  {
    slug: "evaluator-quick-start",
    title: "Evaluator Quick Start",
    category: "Getting Started",
    summary: "Fastest path for evaluators to understand, run, and assess MESA.",
    path: "docs/guides/EVALUATOR_QUICK_START.md",
    tags: ["evaluator", "quick start", "demo", "evaluation"]
  },
  {
    slug: "user-guide",
    title: "Getting Started",
    category: "Getting Started",
    summary: "End-to-end guide for launching MESA and running a scan.",
    path: "docs/guides/USER_GUIDE.md",
    tags: ["getting started", "user", "guide", "scan"]
  },
  {
    slug: "supported-inputs",
    title: "Supported Inputs",
    category: "Supported Inputs",
    summary: "Overview of supported repository and service input modes.",
    path: "docs/guides/SUPPORTED_INPUTS.md",
    tags: ["inputs", "github", "local", "archive"]
  },
  {
    slug: "public-repo-scan-guide",
    title: "Public Repo Scan Guide",
    category: "Scan Guides",
    summary: "How to analyze a public repository using preview discovery.",
    path: "docs/guides/PUBLIC_REPO_SCAN_GUIDE.md",
    tags: ["public repo", "github", "discovery", "scan"]
  },
  {
    slug: "local-scan-guide",
    title: "Local Scan Guide",
    category: "Scan Guides",
    summary: "How to use local paths and manual service directories.",
    path: "docs/guides/LOCAL_SCAN_GUIDE.md",
    tags: ["local", "manual paths", "scan"]
  },
  {
    slug: "findings-guide",
    title: "How To Read Findings",
    category: "Result Guides",
    summary: "How to interpret severity, confidence, evidence, and action guidance.",
    path: "docs/guides/FINDINGS_GUIDE.md",
    tags: ["findings", "confidence", "evidence", "interpretation"]
  },
  {
    slug: "health-score-guide",
    title: "Health Score Guide",
    category: "Result Guides",
    summary: "What MESA health scores mean and how to interpret them.",
    path: "docs/guides/HEALTH_SCORE_GUIDE.md",
    tags: ["health", "score", "dimensions", "quality"]
  },
  {
    slug: "governance-guide",
    title: "Governance Guide",
    category: "Governance",
    summary: "How governance policies work and how to use them in scans.",
    path: "docs/guides/GOVERNANCE_GUIDE.md",
    tags: ["governance", "policy", "yaml", "rules"]
  },
  {
    slug: "ai-explainer-guide",
    title: "AI Explainer Guide",
    category: "AI",
    summary: "Current status and intended role of the future MESA AI explainer.",
    path: "docs/guides/AI_EXPLAINER_GUIDE.md",
    tags: ["ai", "explainer", "future", "assistant"]
  },
  {
    slug: "api-reference",
    title: "API Reference",
    category: "API",
    summary: "Reference documentation for MESA API routes and payloads.",
    path: "docs/api/API_DOCUMENTATION.md",
    tags: ["api", "reference", "routes", "backend"]
  },
  {
    slug: "evaluation-and-limitations",
    title: "Evaluation And Limitations",
    category: "Research",
    summary: "Evaluation setup, measured results, and threats to validity.",
    path: "docs/research/EVALUATION_SETUP_AND_RESULTS.md",
    tags: ["evaluation", "limitations", "results", "research"]
  },
  {
    slug: "threats-to-validity",
    title: "Threats To Validity",
    category: "Research",
    summary: "Important limitations and validity concerns for research interpretation.",
    path: "docs/research/THREATS_TO_VALIDITY.md",
    tags: ["threats", "validity", "limitations", "research"]
  },
  {
    slug: "methodology",
    title: "Methodology",
    category: "Research",
    summary: "Methodological framing behind MESA architecture analysis.",
    path: "docs/research/METHODOLOGY.md",
    tags: ["methodology", "detectors", "research", "approach"]
  },
  {
    slug: "system-architecture",
    title: "How MESA Works",
    category: "How It Works",
    summary: "System architecture and high-level design of the MESA platform.",
    path: "docs/research/SYSTEM_ARCHITECTURE.md",
    tags: ["architecture", "system", "how it works", "design"]
  },
  {
    slug: "research-index",
    title: "Research Docs Index",
    category: "Research",
    summary: "Index of the main research documentation set.",
    path: "docs/research/PHASE_12_DOCUMENTATION_INDEX.md",
    tags: ["research", "index", "docs"]
  },
  {
    slug: "demo-guide",
    title: "Demo Guide",
    category: "Demo",
    summary: "Script and guidance for walking through the product demo.",
    path: "docs/demo/FINAL_DEMO_SCRIPT.md",
    tags: ["demo", "presentation", "walkthrough"]
  }
];

async function main() {
  const docsRoot = await resolveDocsRoot();
  const docsWithContent = await Promise.all(
    docs.map(async (doc) => {
      const relativeDocPath = doc.path.replace(/^docs[\\/]/, "");
      const absolutePath = path.resolve(docsRoot, relativeDocPath);
      const content = await fs.readFile(absolutePath, "utf8");
      return { ...doc, content };
    })
  );

  const output = `/* Auto-generated by frontend/scripts/generate-docs-bundle.mjs */\n` +
    `export const generatedDocs = ${JSON.stringify(docsWithContent, null, 2)} as const;\n`;

  await fs.writeFile(path.resolve(frontendRoot, "src/generated-docs.ts"), output, "utf8");
}

async function resolveDocsRoot() {
  for (const candidate of docsRootCandidates) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isDirectory()) return candidate;
    } catch {
      // Continue to the next candidate.
    }
  }
  throw new Error(`Docs directory not found. Checked: ${docsRootCandidates.join(", ")}`);
}

main().catch((error) => {
  console.error("Failed to generate docs bundle:", error);
  process.exitCode = 1;
});
