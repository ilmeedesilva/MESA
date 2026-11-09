import { test as base, expect, type Page } from "@playwright/test";

export const sections = [
  "overview",
  "scan",
  "findings",
  "graph",
  "history",
  "evolution",
  "roadmap",
  "gate",
  "ai",
  "evaluation",
  "benchmarks",
  "ai-baseline",
  "docs"
] as const;

export type Section = (typeof sections)[number];

export const widths = [360, 390, 768, 1024, 1440] as const;

/** Phone and tablet widths get touch input; phones also get mobile viewport behaviour. */
export function deviceFor(width: number) {
  return { viewport: { width, height: 900 }, hasTouch: width < 1200, isMobile: width < 768 };
}

/**
 * Every test page: /api requests get "not found", so the app opens its embedded demo data, and
 * any request that leaves localhost is blocked and fails the test.
 */
export const test = base.extend({
  page: async ({ page }, runTest) => {
    const external: string[] = [];
    await page.route(
      (url) => url.protocol.startsWith("http") && !["localhost", "127.0.0.1"].includes(url.hostname),
      (route) => {
        external.push(route.request().url());
        return route.abort();
      }
    );
    await page.route("**/api/**", (route) => route.fulfill({ status: 404, body: "not found" }));
    await runTest(page);
    expect(external, "requests to addresses outside localhost").toEqual([]);
  }
});

export { expect };

/** Opens the app at a hash route (for example "#/findings") and waits for the demo data. */
export async function openApp(page: Page, hash = "") {
  await page.goto(`/${hash}`);
  await page.waitForFunction(() => document.body.textContent?.includes("MESA Public Demo"));
  await page.waitForLoadState("networkidle");
}

export function hashFor(section: Section) {
  return section === "overview" ? "" : `#/${section}`;
}

/** The page's width and the width of its content (wider content means sideways scrolling). */
export async function pageWidths(page: Page) {
  return page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
}
