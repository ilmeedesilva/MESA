import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Finding, GraphEdge, PolicyRecord, ProjectRecord } from "./types";
import {
  aggregateEdges,
  buildFilterOptions,
  filterFindings,
  policyDocumentFromRecords,
  resolveProjectSelection,
  servicePathsFromText,
  softWrap,
  tokenizeHighlightedText,
  withBreakOpportunities
} from "./viewHelpers";

function finding(overrides: Partial<Finding>): Finding {
  return {
    id: "MESA-TEST-001",
    type: "CHATTY_SERVICE",
    severity: "LOW",
    confidence: 0.8,
    services: ["order-service", "user-service"],
    description: "test finding",
    evidence: [],
    recommendation: "",
    ...overrides
  } as Finding;
}

const findings = [
  finding({ id: "a", type: "CYCLIC_DEPENDENCY", severity: "CRITICAL", confidence: 0.9 }),
  finding({ id: "b", type: "CHATTY_SERVICE", severity: "LOW", confidence: 0.6, services: ["billing-service"] }),
  finding({ id: "c", type: "SHARED_DATABASE", severity: "HIGH", confidence: 0.88 })
];

describe("filterFindings", () => {
  const all = { type: "ALL", severity: "ALL", service: "ALL", minConfidence: 0 };

  it("returns everything with no filters", () => {
    expect(filterFindings(findings, all)).toHaveLength(3);
  });

  it("filters by type, severity, service and minimum confidence", () => {
    expect(filterFindings(findings, { ...all, type: "SHARED_DATABASE" }).map((f) => f.id)).toEqual(["c"]);
    expect(filterFindings(findings, { ...all, severity: "CRITICAL" }).map((f) => f.id)).toEqual(["a"]);
    expect(filterFindings(findings, { ...all, service: "billing-service" }).map((f) => f.id)).toEqual(["b"]);
    expect(filterFindings(findings, { ...all, minConfidence: 0.85 }).map((f) => f.id)).toEqual(["a", "c"]);
  });
});

describe("buildFilterOptions", () => {
  it("lists severities from most to least severe and services alphabetically", () => {
    const options = buildFilterOptions(findings);
    expect(options.severities).toEqual(["CRITICAL", "HIGH", "LOW"]);
    expect(options.services).toEqual(["billing-service", "order-service", "user-service"]);
    expect(options.types).toEqual(["CHATTY_SERVICE", "CYCLIC_DEPENDENCY", "SHARED_DATABASE"]);
  });
});

describe("aggregateEdges", () => {
  it("merges repeated edges of the same type and keeps the stronger risk", () => {
    const edges: GraphEdge[] = [
      { source: "a", target: "b", type: "api_call", risk: "low" },
      { source: "a", target: "b", type: "api_call", risk: "high" },
      { source: "b", target: "a", type: "api_call", risk: "none" }
    ];
    const aggregated = aggregateEdges(edges);
    expect(aggregated).toHaveLength(2);
    const forward = aggregated.find((edge) => edge.source === "a");
    expect(forward?.count).toBe(2);
    expect(forward?.risk).toBe("high");
  });
});

describe("servicePathsFromText", () => {
  it("splits lines, trims them and drops blanks", () => {
    expect(servicePathsFromText("  services/a \n\nservices/b\n  \n")).toEqual(["services/a", "services/b"]);
  });
});

describe("policyDocumentFromRecords", () => {
  it("writes policies as YAML with a lower-case severity", () => {
    const policies: PolicyRecord[] = [
      { id: "p1", project_id: "x", name: "No cycles", rule: "cycle_count = 0", severity: "HIGH", enabled: true }
    ];
    expect(policyDocumentFromRecords(policies)).toBe(
      "policies:\n  - id: p1\n    name: No cycles\n    rule: cycle_count = 0\n    severity: high\n    enabled: true\n"
    );
  });
});

describe("resolveProjectSelection", () => {
  const projects = [{ id: "p1" }, { id: "p2" }] as ProjectRecord[];

  it("keeps the current project, then the preferred one, then the first", () => {
    expect(resolveProjectSelection(projects, "p2")).toBe("p2");
    expect(resolveProjectSelection(projects, "missing", "p2")).toBe("p2");
    expect(resolveProjectSelection(projects, "missing")).toBe("p1");
    expect(resolveProjectSelection([], "missing")).toBe("");
  });
});

describe("tokenizeHighlightedText", () => {
  const codeParts = (text: string) =>
    tokenizeHighlightedText(text)
      .filter((part) => part.kind === "code")
      .map((part) => part.value);

  it("keeps score fractions such as 67.2/100 as plain text", () => {
    expect(codeParts("System health is 67.2/100 (Moderate).")).toEqual([]);
    expect(
      tokenizeHighlightedText("Score 70.1/100, grade Good.")
        .map((part) => part.value)
        .join("")
    ).toBe("Score 70.1/100, grade Good.");
  });

  it("highlights file paths, URLs and hyphenated service names", () => {
    expect(codeParts("Found in /workspace/app/config.yml:8 and http://localhost:8061/eureka/.")).toEqual([
      "/workspace/app/config.yml:8",
      "http://localhost:8061/eureka/"
    ]);
    expect(codeParts("services: config-service.")).toEqual(["config-service"]);
  });
});

describe("withBreakOpportunities", () => {
  it("keeps the text and allows breaks after separators", () => {
    const nodes = withBreakOpportunities("breakdown.hard_coded_dependency_risk");
    expect(nodes.filter((node) => typeof node === "string").join("")).toBe("breakdown.hard_coded_dependency_risk");
    expect(nodes.filter((node) => typeof node !== "string")).toHaveLength(4);
  });
});

describe("softWrap", () => {
  const text = (nodes: React.ReactNode[]) => renderToStaticMarkup(<>{nodes}</>);

  it("adds break opportunities only inside long path or identifier tokens", () => {
    expect(text(softWrap("A short sentence stays as it is."))).toBe("A short sentence stays as it is.");
    expect(text(softWrap("Detector HardCodedServiceDependencyDetector"))).toBe(
      "Detector Hard<wbr/>Coded<wbr/>Service<wbr/>Dependency<wbr/>Detector"
    );
    expect(text(softWrap("in /workspace/app.yml:8"))).toBe("in /<wbr/>workspace/<wbr/>app.<wbr/>yml:<wbr/>8");
  });
});
