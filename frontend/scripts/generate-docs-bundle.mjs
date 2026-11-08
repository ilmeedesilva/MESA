import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const docsRootCandidates = [path.resolve(frontendRoot, "docs"), path.resolve(frontendRoot, "..", "docs")];

const docs = [
  {
    slug: "user-guide",
    title: "Getting Started",
    category: "Getting Started",
    summary: "End-to-end guide for launching MESA, running a scan and reading the results.",
    path: "docs/user-guide.md",
    tags: ["getting started", "user", "guide", "scan"]
  },
  {
    slug: "installation",
    title: "Installation",
    category: "Getting Started",
    summary: "Docker Compose and local Python setup.",
    path: "docs/guides/installation.md",
    tags: ["install", "docker", "setup"]
  },
  {
    slug: "concepts",
    title: "Concepts",
    category: "Getting Started",
    summary: "Short definitions of the terms MESA uses.",
    path: "docs/concepts.md",
    tags: ["glossary", "concepts", "terms"]
  },
  {
    slug: "supported-inputs",
    title: "Supported Inputs",
    category: "Supported Inputs",
    summary: "Overview of supported repository and service input modes.",
    path: "docs/guides/supported-inputs.md",
    tags: ["inputs", "github", "local", "archive"]
  },
  {
    slug: "public-repo-scan-guide",
    title: "Public Repo Scan Guide",
    category: "Scan Guides",
    summary: "How to analyze a public repository using preview discovery.",
    path: "docs/guides/scanning-public-repos.md",
    tags: ["public repo", "github", "discovery", "scan"]
  },
  {
    slug: "local-scan-guide",
    title: "Local Scan Guide",
    category: "Scan Guides",
    summary: "How to use local paths and manual service directories.",
    path: "docs/guides/quick-start.md",
    tags: ["local", "manual paths", "scan"]
  },
  {
    slug: "public-demo-guide",
    title: "Public Demo Guide",
    category: "Demo",
    summary: "How to use MESA when the live backend is unavailable.",
    path: "docs/guides/public-demo.md",
    tags: ["demo", "public", "embedded", "tour"]
  },
  {
    slug: "demo-projects-guide",
    title: "Demo Projects",
    category: "Demo",
    summary: "Before-and-after demo repositories for a scan comparison.",
    path: "docs/guides/demo-projects.md",
    tags: ["demo", "before", "after", "comparison"]
  },
  {
    slug: "findings-guide",
    title: "How To Read Findings",
    category: "Result Guides",
    summary: "How to interpret severity, confidence, evidence, and action guidance.",
    path: "docs/guides/findings.md",
    tags: ["findings", "confidence", "evidence", "interpretation"]
  },
  {
    slug: "health-score-guide",
    title: "Health Score Guide",
    category: "Result Guides",
    summary: "What MESA health scores mean and how to interpret them.",
    path: "docs/guides/health-score.md",
    tags: ["health", "score", "dimensions", "quality"]
  },
  {
    slug: "remediation-roadmap-guide",
    title: "Remediation Roadmap Guide",
    category: "Result Guides",
    summary: "How MESA groups recommendations into an ordered plan.",
    path: "docs/guides/remediation-roadmap.md",
    tags: ["roadmap", "remediation", "quick wins", "refactoring"]
  },
  {
    slug: "governance-guide",
    title: "Governance Guide",
    category: "Governance",
    summary: "How governance policies work and how to use them in scans.",
    path: "docs/guides/governance.md",
    tags: ["governance", "policy", "yaml", "rules"]
  },
  {
    slug: "fitness-gate-guide",
    title: "Fitness Gate in CI",
    category: "Governance",
    summary: "Run the pass/fail architecture gate in a CI pipeline.",
    path: "docs/guides/github-action.md",
    tags: ["gate", "ci", "github actions", "pipeline"]
  },
  {
    slug: "ai-explainer-guide",
    title: "AI Explainer Guide",
    category: "AI",
    summary: "How the evidence-grounded explainer works and its optional live modes.",
    path: "docs/guides/ai-explainer.md",
    tags: ["ai", "explainer", "grounded", "assistant"]
  },
  {
    slug: "system-architecture",
    title: "How MESA Works",
    category: "How It Works",
    summary: "The analysis pipeline, interfaces, storage and tech stack.",
    path: "docs/architecture.md",
    tags: ["architecture", "system", "how it works", "design"]
  },
  {
    slug: "detectors",
    title: "Detectors",
    category: "How It Works",
    summary: "How each of the five detectors works, with thresholds and limits.",
    path: "docs/detectors.md",
    tags: ["detectors", "rules", "thresholds", "anti-patterns"]
  },
  {
    slug: "api-reference",
    title: "API Reference",
    category: "API",
    summary: "Reference documentation for MESA API routes and payloads.",
    path: "docs/api.md",
    tags: ["api", "reference", "routes", "backend"]
  },
  {
    slug: "evaluation-and-limitations",
    title: "Evaluation And Limitations",
    category: "Research",
    summary: "Benchmark setup and measured results on seeded and real systems.",
    path: "docs/research/evaluation.md",
    tags: ["evaluation", "limitations", "results", "research"]
  },
  {
    slug: "ai-baseline",
    title: "AI Baseline Comparison",
    category: "Research",
    summary: "MESA compared with two general-purpose LLMs over repeated runs.",
    path: "docs/research/ai-baseline.md",
    tags: ["ai", "llm", "baseline", "determinism"]
  },
  {
    slug: "methodology",
    title: "Methodology And Threats To Validity",
    category: "Research",
    summary: "How MESA was built and evaluated, and the limits of the results.",
    path: "docs/research/methodology.md",
    tags: ["methodology", "threats", "validity", "research"]
  },
  {
    slug: "reproduce",
    title: "Reproducing The Results",
    category: "Research",
    summary: "Exact commands and expected numbers for the published results.",
    path: "docs/research/REPRODUCE.md",
    tags: ["reproduce", "benchmarks", "results", "research"]
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

  const output =
    `/* Auto-generated by frontend/scripts/generate-docs-bundle.mjs */\n` +
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
