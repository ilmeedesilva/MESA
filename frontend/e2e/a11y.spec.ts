import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { deviceFor, expect, hashFor, openApp, sections, test } from "./fixtures";

// axe-core checks against WCAG 2.0, 2.1 and 2.2 at levels A and AA. Any violation fails.
const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
  const violations = results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    elements: violation.nodes.map((node) => node.target.join(" ")).slice(0, 5)
  }));
  expect(violations, "accessibility violations").toEqual([]);
}

for (const width of [1440, 768, 390]) {
  test.describe(`${width}px`, () => {
    test.use(deviceFor(width));

    for (const section of sections) {
      test(`${section} has no accessibility violations`, async ({ page }) => {
        await openApp(page, hashFor(section));
        await expectNoViolations(page);
      });
    }
  });
}

test.describe("open panels", () => {
  test("phone menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("#app-sidebar")).toBeVisible();
    await expectNoViolations(page);
  });

  test("tablet sidebar over the page", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await openApp(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("#app-sidebar")).toHaveClass(/overlayOpen/);
    await expectNoViolations(page);
  });

  test("desktop icon rail", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openApp(page);
    await expect(page.locator("#app-sidebar")).toHaveClass(/collapsed/);
    await expectNoViolations(page);
  });

  test("finding drawer", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page, "#/findings");
    await page.locator(".findingCardOpen").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoViolations(page);
  });

  test("metric detail", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page);
    await page.getByRole("button", { name: "See more" }).click();
    await expect(page.getByRole("dialog", { name: /detail/ })).toBeVisible();
    await expectNoViolations(page);
  });
});
