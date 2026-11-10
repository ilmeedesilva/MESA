import { afterEach, describe, expect, it, vi } from "vitest";

// The flag is read when the module loads, so each test imports the modules afresh.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("demo site build", () => {
  it("sends no request to a MESA server and says it is a demo", async () => {
    vi.stubEnv("VITE_MESA_DEMO_SITE", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { api, messageFor } = await import("./api");
    const { demoSiteActionMessage } = await import("./demoSite");

    const failure = await api("/api/projects").catch((caught: unknown) => caught);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(messageFor(failure, "Could not create the project")).toBe(demoSiteActionMessage);
  });

  it("is off in the normal app", async () => {
    vi.stubEnv("VITE_MESA_DEMO_SITE", "");
    const { isDemoSite } = await import("./demoSite");
    expect(isDemoSite).toBe(false);
  });
});
