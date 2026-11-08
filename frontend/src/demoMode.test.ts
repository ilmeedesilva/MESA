import { describe, expect, it } from "vitest";
import { demoWorkspace } from "./demoData";
import { demoPersistedScan, isDemoScan, isPublicDemoProject, resolveDemoIntent } from "./demoMode";
import { docBySlug, docsCatalog } from "./docsPortal";

describe("demo workspace", () => {
  it("loads every embedded demo scan with its result", () => {
    expect(demoWorkspace.scans.length).toBeGreaterThan(0);
    for (const scan of demoWorkspace.scans) {
      expect(isDemoScan(scan.id)).toBe(true);
      const persisted = demoPersistedScan(scan.id);
      expect(persisted.scan.id).toBe(scan.id);
      expect(Array.isArray(persisted.result.findings)).toBe(true);
    }
  });

  it("recognises only the demo project and rejects unknown scans", () => {
    expect(isPublicDemoProject(demoWorkspace.project.id)).toBe(true);
    expect(isPublicDemoProject("some-other-project")).toBe(false);
    expect(() => demoPersistedScan("not-a-demo-scan")).toThrow();
  });
});

describe("resolveDemoIntent", () => {
  it("routes questions to the right answer type", () => {
    expect(resolveDemoIntent("What should I fix first?", true, false)).toBe("PRIORITIZE_FIXES");
    expect(resolveDemoIntent("Why is the health score low?", true, false)).toBe("HEALTH_SCORE_EXPLANATION");
    expect(resolveDemoIntent("Compare the two scans", true, false)).toBe("COMPARE_SCANS");
    expect(resolveDemoIntent("Draft a governance policy", true, false)).toBe("POLICY_WRITING_ASSISTANCE");
    expect(resolveDemoIntent("How do I scan a repo?", true, false)).toBe("DOC_QA");
    expect(resolveDemoIntent("Summarize this", true, false)).toBe("SCAN_SUMMARY");
    expect(resolveDemoIntent("Summarize this", false, false)).toBe("DOC_QA");
  });
});

describe("embedded documentation", () => {
  it("has unique slugs and non-empty pages", () => {
    const slugs = docsCatalog.map((doc) => doc.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const doc of docsCatalog) expect(doc.content.trim().length).toBeGreaterThan(0);
  });

  it("falls back to the first page for an unknown slug", () => {
    expect(docBySlug("no-such-page")).toBe(docsCatalog[0]);
  });
});
