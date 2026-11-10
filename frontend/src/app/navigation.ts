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
      { id: "history", label: "History", description: "Past scans and what changed" },
      { id: "roadmap", label: "Roadmap", description: "Recommended remediation order" },
      { id: "gate", label: "Architecture Gate", description: "Pass or fail against architecture rules" }
    ]
  },
  {
    group: "Help",
    items: [{ id: "docs", label: "Documentation", description: "Guides and API reference" }]
  }
] as const satisfies ReadonlyArray<{
  group: string;
  items: ReadonlyArray<{ id: AppSection; label: string; description: string }>;
}>;

/** Header details for the not-found page, which has no menu entry. */
export const notFoundItem: NavigationItem = {
  id: "not-found",
  label: "Page not found",
  description: "This link does not match a page in MESA",
  group: "MESA"
};

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
  "roadmap",
  "gate",
  "ai"
]);
