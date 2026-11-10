import { deviceFor, expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

const longName = "Customer Accounts and Payments Platform for the Northern Europe Region (legacy monolith split)";

/** A live MESA server with two projects, one with a very long name, and no scans yet. */
async function fakeLiveServer(page: Page) {
  const responses: Record<string, unknown> = {
    "/api/health": { status: "ok", version: "0.1.0" },
    "/api/projects": [
      { id: "p-long", name: longName, description: "", created_at: "2026-11-01T10:00:00Z" },
      { id: "p-short", name: "Shop", description: "", created_at: "2026-11-02T10:00:00Z" }
    ],
    "/api/ai/explainer/status": {
      mode: "grounded",
      state: "GROUNDED_ONLY",
      live_enabled: false,
      api_key_configured: false,
      api_key_hint: null,
      model: "",
      base_url: "",
      message: ""
    }
  };
  for (const id of ["p-long", "p-short"]) {
    responses[`/api/projects/${id}/scans`] = [];
    responses[`/api/projects/${id}/policies`] = [];
    responses[`/api/projects/${id}/evolution`] = [];
    responses[`/api/projects/${id}/setup`] = null;
  }
  // Registered after the fixture's catch-all, so it is tried first; anything else falls back to "not found".
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET" && path in responses) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(responses[path]) });
    }
    return route.fallback();
  });
}

const controls = (page: Page) => ({
  levelSwitch: page.locator(".appHeader .levelSwitch"),
  projectDropdown: page.locator(".appHeader").getByRole("combobox", { name: "Project" }),
  newProject: page.locator(".appHeader").getByRole("button", { name: "New project" })
});

async function boxes(page: Page) {
  const c = controls(page);
  return {
    levelSwitch: await c.levelSwitch.boundingBox(),
    projectDropdown: await c.projectDropdown.boundingBox(),
    newProject: await c.newProject.boundingBox()
  };
}

/** Elements inside the header that stick out past its left or right edge. */
async function headerOverflow(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector(".appHeader")!.getBoundingClientRect();
    return [...document.querySelectorAll(".appHeader *")]
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && (rect.left < header.left - 0.5 || rect.right > header.right + 0.5))
      .map(({ element }) => element.outerHTML.slice(0, 80));
  });
}

for (const width of [768, 1024, 1280, 1440, 1920]) {
  test.describe(`header at ${width}px`, () => {
    test.use(deviceFor(width));

    test("nothing moves or resizes when switching level or project, and nothing is cut off", async ({ page }) => {
      await fakeLiveServer(page);
      await page.goto("/?project=p-long");
      const c = controls(page);
      await expect(c.projectDropdown).toHaveValue("p-long");
      await expect(c.newProject).toBeVisible();
      await page.waitForLoadState("networkidle");

      // The full name is in the option list and the tooltip; the closed dropdown keeps its size.
      await expect(c.projectDropdown.locator("option", { hasText: longName })).toHaveCount(1);
      await expect(c.projectDropdown).toHaveAttribute("title", longName);

      const before = await boxes(page);
      expect(await headerOverflow(page)).toEqual([]);

      await c.levelSwitch.getByRole("button", { name: "Technical" }).click();
      expect(await boxes(page)).toEqual(before);
      expect(await headerOverflow(page)).toEqual([]);

      await c.levelSwitch.getByRole("button", { name: "Simple" }).click();
      expect(await boxes(page)).toEqual(before);

      await c.projectDropdown.selectOption("p-short");
      await expect(c.projectDropdown).toHaveValue("p-short");
      expect(await boxes(page)).toEqual(before);
      expect(await headerOverflow(page)).toEqual([]);

      const widths = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(widths.scrollWidth).toBeLessThanOrEqual(widths.innerWidth);
    });
  });
}
