import { afterEach, describe, expect, it } from "vitest";
import { appSections, buildHash, buildUrl, parseHash, readRoute, writeUrl } from "./router";

describe("parseHash", () => {
  it("reads sections", () => {
    expect(parseHash("#/findings")).toEqual({ section: "findings" });
    expect(parseHash("#/gate")).toEqual({ section: "gate" });
    expect(parseHash("#/graph/")).toEqual({ section: "graph" });
  });

  it("reads a finding and a documentation page", () => {
    expect(parseHash("#/findings/MESA-CYCL-003")).toEqual({ section: "findings", findingId: "MESA-CYCL-003" });
    expect(parseHash("#/docs/user-guide")).toEqual({ section: "docs", docSlug: "user-guide" });
  });

  it("ignores details on sections that have none", () => {
    expect(parseHash("#/graph/something")).toEqual({ section: "graph" });
  });

  it("returns null without a route and opens the not-found page for unknown pages", () => {
    expect(parseHash("")).toBeNull();
    expect(parseHash("#")).toBeNull();
    expect(parseHash("#/")).toBeNull();
    expect(parseHash("#/not-a-page")).toEqual({ section: "not-found" });
    expect(parseHash("#/not-found")).toEqual({ section: "not-found" });
  });

  it("sends the pages taken out of the app to the not-found page", () => {
    for (const removed of ["evaluation", "benchmarks", "ai-baseline"]) {
      expect(parseHash(`#/${removed}`)).toEqual({ section: "not-found" });
    }
  });

  it("opens the not-found page for an unknown documentation page", () => {
    expect(parseHash("#/docs/not-a-doc")).toEqual({ section: "not-found" });
  });

  it("maps old page names to the pages that replaced them", () => {
    expect(parseHash("#/services")).toEqual({ section: "scan" });
    expect(parseHash("#/policies")).toEqual({ section: "scan" });
    expect(parseHash("#/evolution")).toEqual({ section: "history" });
  });
});

describe("buildHash", () => {
  it("round-trips every section", () => {
    for (const section of appSections.filter((s) => s !== "overview")) {
      expect(parseHash(buildHash({ section }))).toEqual({ section });
    }
  });

  it("gives the overview no hash", () => {
    expect(buildHash({ section: "overview" })).toBe("");
  });

  it("keeps the typed hash on the not-found page", () => {
    expect(buildHash({ section: "not-found" }, "#/evaluation")).toBe("#/evaluation");
  });

  it("encodes and decodes IDs with special characters", () => {
    const route = { section: "findings" as const, findingId: "MESA/CYCL 003" };
    expect(buildHash(route)).toBe("#/findings/MESA%2FCYCL%20003");
    expect(parseHash(buildHash(route))).toEqual(route);
  });

  it("keeps details only on the sections that use them", () => {
    expect(buildHash({ section: "graph", findingId: "MESA-CYCL-003", docSlug: "x" })).toBe("#/graph");
  });
});

describe("readRoute", () => {
  it("prefers the hash, then the old ?section= parameter", () => {
    expect(readRoute({ hash: "#/graph", search: "?section=findings" })).toEqual({ section: "graph" });
    expect(readRoute({ hash: "", search: "?project=p1&section=findings" })).toEqual({ section: "findings" });
    expect(readRoute({ hash: "", search: "?section=services" })).toEqual({ section: "scan" });
    expect(readRoute({ hash: "", search: "?section=evolution" })).toEqual({ section: "history" });
    expect(readRoute({ hash: "", search: "?section=evaluation" })).toEqual({ section: "not-found" });
    expect(readRoute({ hash: "", search: "" })).toEqual({ section: "overview" });
  });
});

describe("buildUrl and writeUrl", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("keeps the project in the query, drops the old section parameter and sets the hash", () => {
    expect(buildUrl("p1", { section: "findings", findingId: "F-1" }, "http://localhost/?section=graph")).toBe(
      "/?project=p1#/findings/F-1"
    );
    expect(buildUrl("", { section: "overview" }, "http://localhost/?project=p1#/graph")).toBe("/");
  });

  it("pushes new entries, replaces in place, and skips writes that change nothing", () => {
    const start = window.history.length;
    writeUrl("p1", { section: "graph" }, "push");
    expect(`${window.location.search}${window.location.hash}`).toBe("?project=p1#/graph");
    expect(window.history.length).toBe(start + 1);

    writeUrl("p1", { section: "graph" }, "push");
    expect(window.history.length).toBe(start + 1);

    writeUrl("p1", { section: "findings" }, "replace");
    expect(window.location.hash).toBe("#/findings");
    expect(window.history.length).toBe(start + 1);
  });

  it("stores the history state given with a push", () => {
    writeUrl("p1", { section: "findings", findingId: "F-1" }, "push", { mesaFindingOpenedInApp: true });
    expect(window.history.state).toEqual({ mesaFindingOpenedInApp: true });
  });
});
