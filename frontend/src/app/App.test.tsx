import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { demoPersistedScan } from "../demoMode";
import { demoWorkspace } from "../demoData";

// A live API with one project and one scan, built from the embedded demo data.
const demo = demoPersistedScan(demoWorkspace.scans[0].id);
const scan = { ...demo.scan, id: "scan-1", project_id: "project-1" };
const responses: Record<string, unknown> = {
  "GET /api/health": { status: "ok" },
  "GET /api/projects": [{ id: "project-1", name: "Live Project", description: "", created_at: scan.created_at }],
  "GET /api/projects/project-1/scans": [scan],
  "GET /api/projects/project-1/policies": [],
  "GET /api/projects/project-1/evolution": [],
  "GET /api/projects/project-1/setup": null,
  "GET /api/scans/scan-1": { scan, result: demo.result },
  "GET /api/scans/scan-1/scores": [],
  "GET /api/scans/scan-1/roadmap": demoWorkspace.roadmaps[demoWorkspace.scans[0].id],
  "GET /api/scans/scan-1/graph": { nodes: [], edges: [] },
  "GET /api/ai/explainer/status": {
    mode: "grounded",
    state: "GROUNDED_ONLY",
    live_enabled: false,
    api_key_configured: false,
    api_key_hint: null,
    model: "none",
    base_url: "",
    message: ""
  }
};

let calls: string[] = [];

beforeEach(() => {
  calls = [];
  window.history.replaceState({}, "", "/");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${String(input)}`;
      calls.push(key);
      if (!(key in responses)) return new Response("not found", { status: 404 });
      return new Response(JSON.stringify(responses[key]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App data loading", () => {
  it("loads each piece of project and scan data once on start", async () => {
    render(<App />);

    await waitFor(() => expect(calls).toContain("GET /api/scans/scan-1/graph"));
    // Let any follow-up requests settle.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await screen.findAllByText("Live Project")).not.toHaveLength(0);

    const counts = calls.reduce<Record<string, number>>((all, key) => ({ ...all, [key]: (all[key] ?? 0) + 1 }), {});
    expect(counts).toEqual({
      "GET /api/health": 1,
      "GET /api/ai/explainer/status": 1,
      "GET /api/projects": 1,
      "GET /api/projects/project-1/scans": 1,
      "GET /api/projects/project-1/policies": 1,
      "GET /api/projects/project-1/evolution": 1,
      "GET /api/projects/project-1/setup": 1,
      "GET /api/scans/scan-1": 1,
      "GET /api/scans/scan-1/scores": 1,
      "GET /api/scans/scan-1/roadmap": 1,
      "GET /api/scans/scan-1/graph": 1
    });
  });
});
