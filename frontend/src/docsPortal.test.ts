import { describe, expect, it } from "vitest";
import { docsCatalog, docsCategories } from "./docsPortal";
import { parseHash } from "./app/router";

describe("in-app documentation", () => {
  it("lists exactly the agreed developer docs, in four groups", () => {
    expect(docsCategories).toEqual(["Get started", "Scanning", "Understand results", "Automate"]);
    const byGroup = Object.fromEntries(
      docsCategories.map((category) => [
        category,
        docsCatalog.filter((doc) => doc.category === category).map((doc) => doc.title)
      ])
    );
    expect(byGroup).toEqual({
      "Get started": ["Quick start", "Getting started", "Demo data"],
      Scanning: ["Supported inputs", "Scan a GitHub repo", "Scan a local folder"],
      "Understand results": ["Findings", "Health score", "Roadmap", "Policies", "AI explainer"],
      Automate: ["CI and the GitHub Action", "API reference"]
    });
  });

  it("keeps research and coursework documents out of the app", () => {
    for (const doc of docsCatalog) {
      expect(doc.path).not.toMatch(/^docs\/(research|demo)\//);
    }
  });

  it("shows no research, evaluator, grounded or embedded wording in titles, summaries or guide text", () => {
    for (const doc of docsCatalog) {
      const visible = `${doc.title}\n${doc.summary}\n${doc.tags.join(" ")}\n${doc.content}`;
      expect(visible, doc.slug).not.toMatch(/research|evaluator|grounded|embedded|beginner/i);
    }
  });

  it("opens the old Quick Start link and sends removed docs to the not-found page", () => {
    expect(parseHash("#/docs/evaluator-quick-start")).toEqual({ section: "docs", docSlug: "quick-start" });
    for (const removed of [
      "methodology",
      "threats-to-validity",
      "research-index",
      "evaluation-and-limitations",
      "system-architecture",
      "demo-guide"
    ]) {
      expect(parseHash(`#/docs/${removed}`)).toEqual({ section: "not-found" });
    }
  });
});
