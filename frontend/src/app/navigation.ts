import type { AppSection } from "../types";

export const appNavigation = [
  {
    group: "Project",
    items: [{ id: "overview", label: "Overview", description: "Project summary and quick actions" }]
  },
  {
    group: "Analysis",
    items: [
      { id: "scan", label: "Scan", description: "Configure sources and run scans" },
      { id: "findings", label: "Findings", description: "Inspect findings and filters" },
      { id: "graph", label: "Graph", description: "Explore architecture and health" },
      { id: "ai", label: "AI Explainer", description: "Ask grounded questions about the scan" }
    ]
  },
  {
    group: "Results",
    items: [
      { id: "history", label: "Scan History", description: "Review previous scans" },
      { id: "evolution", label: "Evolution", description: "Compare architecture changes" },
      { id: "roadmap", label: "Roadmap", description: "Recommended remediation order" },
      { id: "gate", label: "Fitness Gate", description: "Pass or fail against architecture rules" }
    ]
  },
  {
    group: "Research",
    items: [
      { id: "evaluation", label: "Evaluation", description: "Research evidence and validation" },
      {
        id: "benchmarks",
        label: "Benchmarks",
        description: "Ground-truth precision/recall/F1 against seeded and real repositories"
      },
      {
        id: "ai-baseline",
        label: "AI Baseline",
        description: "MESA vs a general-purpose AI, run repeatedly on the same code"
      }
    ]
  },
  {
    group: "Reference",
    items: [{ id: "docs", label: "Documentation", description: "Guides and methodology" }]
  }
] as const satisfies ReadonlyArray<{
  group: string;
  items: ReadonlyArray<{ id: AppSection; label: string; description: string }>;
}>;

export type NavigationItem = {
  id: AppSection;
  label: string;
  description: string;
  group: string;
};

export const navigationItems: NavigationItem[] = appNavigation.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.group }))
);

export const sectionsRequiringProject = new Set<AppSection>([
  "overview",
  "scan",
  "findings",
  "graph",
  "history",
  "evolution",
  "roadmap",
  "gate",
  "ai",
  "evaluation"
]);
