import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// A live API with one project and no scans yet.
const emptyProject = { id: "project-1", name: "Shop", description: "", created_at: "2026-11-01T10:00:00Z" };
const live: Record<string, unknown> = {
  "GET /api/health": { status: "ok", version: "1.2.3" },
  "GET /api/projects": [emptyProject],
  "GET /api/projects/project-1/scans": [],
  "GET /api/projects/project-1/policies": [],
  "GET /api/projects/project-1/evolution": [],
  "GET /api/projects/project-1/setup": null,
  "GET /api/ai/explainer/status": {
    mode: "grounded",
    state: "GROUNDED_ONLY",
    live_enabled: false,
    api_key_configured: false,
    api_key_hint: null,
    model: "gpt-5.4-mini",
    base_url: "https://api.openai.com/v1",
    message: ""
  }
};

let serverUp = true;

beforeEach(() => {
  serverUp = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!serverUp) throw new TypeError("Failed to fetch");
      const key = `${init?.method ?? "GET"} ${String(input)}`;
      if (!(key in live)) return new Response("not found", { status: 404 });
      return new Response(JSON.stringify(live[key]), { status: 200, headers: { "content-type": "application/json" } });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
  document.title = "";
});

async function openLive(url: string) {
  window.history.replaceState(null, "", url);
  render(<App />);
  await screen.findAllByText("Shop");
}

describe("empty states", () => {
  it("shows a clear next step on result pages when the project has no scan yet", async () => {
    for (const page of ["findings", "graph", "roadmap", "gate"]) {
      await openLive(`/?project=project-1#/${page}`);
      expect(await screen.findByRole("heading", { name: "No scan yet" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Go to Scan" })).toBeInTheDocument();
      cleanup();
    }
  });

  it("says there are no scans yet on History", async () => {
    await openLive("/?project=project-1#/history");
    expect(await screen.findByRole("heading", { name: "No scans yet" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to Scan" }));
    expect(window.location.hash).toBe("#/scan");
  });

  it("names the page in the browser tab and shows the server version in the footer", async () => {
    await openLive("/?project=project-1#/findings");
    await waitFor(() => expect(document.title).toBe("Findings - MESA"));
    expect(await screen.findByText("MESA version 1.2.3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/ilmeedesilva/MESA"
    );
  });
});

describe("server not reachable", () => {
  it("says so in plain words, and Try again connects once the server is back", async () => {
    serverUp = false;
    window.history.replaceState(null, "", "/");
    render(<App />);
    expect(await screen.findByText(/MESA can't reach your MESA server/)).toBeInTheDocument();
    expect(screen.getByText("MESA demo data")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Still can't reach your MESA server");

    serverUp = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findAllByText("Shop")).not.toHaveLength(0);
    await waitFor(() => expect(screen.queryByText(/MESA can't reach your MESA server/)).toBeNull());
    expect(await screen.findByText("MESA version 1.2.3")).toBeInTheDocument();
  });
});
