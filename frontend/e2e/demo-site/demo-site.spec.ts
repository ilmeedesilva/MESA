import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
import { deviceFor, sections } from "../fixtures";

// The public demo site (GitHub Pages build) under /MESA/: demo data only, never a request to a
// MESA server, no "connect to your server" wording, working hash links and favicon.

const test = base.extend<{ apiRequests: string[] }>({
  apiRequests: async ({ page }, provide) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.includes("/api/")) requests.push(request.url());
    });
    // Nothing may leave localhost.
    await page.route(
      (url) => url.protocol.startsWith("http") && !["localhost", "127.0.0.1"].includes(url.hostname),
      (route) => route.abort()
    );
    await provide(requests);
  }
});

const serverWording = /can't reach your MESA server|Try again|Connect to your MESA server|Load demo data/i;

const demoLine = "You're viewing a demo with example data. Install MESA to scan your own code.";

async function openDemoSite(page: Page, hash = "") {
  // Relative to the base URL, so the page opens under /MESA/.
  await page.goto(`./${hash}`);
  await page.waitForFunction(() => document.body.textContent?.includes("MESA Public Demo"));
  await page.waitForLoadState("networkidle");
}

for (const width of [390, 1440] as const) {
  test.describe(`${width}px`, () => {
    test.use(deviceFor(width));

    for (const section of sections) {
      test(`${section} shows the demo line and never asks for a server`, async ({ page, apiRequests }) => {
        await openDemoSite(page, section === "overview" ? "" : `#/${section}`);
        // Every page has the demo line, except the not-found page, which has no status line.
        if (section !== "not-found") await expect(page.getByText(demoLine)).toBeVisible();
        expect(new URL(page.url()).pathname).toBe("/MESA/");
        await expect(page.locator("body")).not.toContainText(serverWording);
        await expect(page.locator(".appFooter")).toContainText("Demo");
        await expect(page.locator(".appFooter")).not.toContainText("Demo data");
        const widths = await page.evaluate(() => ({
          inner: window.innerWidth,
          scroll: document.documentElement.scrollWidth
        }));
        expect(widths.scroll, "no sideways scrolling").toBeLessThanOrEqual(widths.inner);
        expect(apiRequests, "requests to a MESA server").toEqual([]);
      });
    }
  });
}

test("the Quick start link opens the guide inside the demo site", async ({ page, apiRequests }) => {
  await openDemoSite(page, "#/findings");
  await page.getByRole("link", { name: "Quick start" }).click();
  await expect(page).toHaveURL(/\/MESA\/(\?[^#]*)?#\/docs\/quick-start$/);
  await expect(page.locator(".docsMarkdown h1")).toHaveText("MESA quick start");
  expect(apiRequests).toEqual([]);
});

test("deep links and reloads work under /MESA/", async ({ page }) => {
  await openDemoSite(page, "#/docs/ci-github-action");
  await expect(page.locator(".docsMarkdown h1")).toHaveText("CI and the GitHub Action");
  await page.reload();
  await expect(page.locator(".docsMarkdown h1")).toHaveText("CI and the GitHub Action");
});

test("the favicon and all assets load from /MESA/", async ({ page, request }) => {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  // Desktop width, where the sidebar is open and shows the full logo.
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDemoSite(page);
  const icons = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("href")));
  expect(icons).toEqual(["/MESA/favicon.ico", "/MESA/favicon.svg", "/MESA/apple-touch-icon.png"]);
  for (const icon of icons) expect((await request.get(icon!)).status(), icon!).toBe(200);
  // The logo at the top of the sidebar loads from under /MESA/ too.
  const logo = page.locator(".appLogo img");
  expect(await logo.getAttribute("src")).toMatch(/^\/MESA\/assets\/mesa-logo-.*\.svg$/);
  expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth > 0)).toBe(true);
  expect(failed).toEqual([]);
});

test("the AI Explainer answers from the demo data, without a server", async ({ page, apiRequests }) => {
  await openDemoSite(page, "#/ai");
  await page
    .getByRole("button", { name: /Summarize|Explain|Ask/i })
    .first()
    .click();
  await expect(page.locator("body")).not.toContainText(serverWording);
  expect(apiRequests).toEqual([]);
});

test("has no accessibility violations", async ({ page }) => {
  await openDemoSite(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});
