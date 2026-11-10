import { deviceFor, expect, hashFor, openApp, sections, test } from "./fixtures";
import type { Page, TestInfo } from "@playwright/test";

/**
 * Full-page screenshots of every page at phone (390px) and desktop (1440px) width, attached to
 * the HTML test report (the playwright-report artifact in CI) for visual review. They use the
 * demo data, so they show no real project. Each test also checks there is no sideways scrolling.
 */

async function attach(page: Page, testInfo: TestInfo, name: string) {
  // Let fonts, the graph and any transitions settle before the picture is taken.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  const widths = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(widths.scrollWidth, `${name} scrolls sideways`).toBeLessThanOrEqual(widths.innerWidth);
}

async function chooseLevel(page: Page, level: "Simple" | "Technical", phone: boolean) {
  if (phone) await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .locator(phone ? "#app-sidebar" : ".appHeader")
    .getByRole("group", { name: "Explanation level" })
    .getByRole("button", { name: level })
    .click();
  if (phone) await page.keyboard.press("Escape");
}

for (const width of [390, 1440] as const) {
  const phone = width < 768;

  test.describe(`screenshots at ${width}px`, () => {
    test.use(deviceFor(width));

    for (const section of sections) {
      test(`${section}`, async ({ page }, testInfo) => {
        await openApp(page, hashFor(section));
        await expect(page.locator(phone ? ".mobileBar" : ".appHeader h2")).toBeVisible();
        if (section === "graph") await expect(page.locator(".graphStage")).toBeVisible();
        await attach(page, testInfo, `${width}px - ${section}`);
      });
    }

    test("finding panel, Simple and Technical", async ({ page }, testInfo) => {
      await openApp(page, "#/findings");
      await page.locator(".findingCardOpen").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await attach(page, testInfo, `${width}px - finding panel (Simple)`);
      await page.keyboard.press("Escape");

      await chooseLevel(page, "Technical", phone);
      await attach(page, testInfo, `${width}px - findings (Technical)`);
      await page.locator(".findingCardOpen").first().click();
      await expect(page.getByRole("dialog").getByRole("heading", { name: "Raw evidence" })).toBeVisible();
      await attach(page, testInfo, `${width}px - finding panel (Technical)`);
    });

    test("AI explainer answer", async ({ page }, testInfo) => {
      await openApp(page, "#/ai");
      await page.getByRole("button", { name: /Summarize this scan/ }).click();
      await expect(page.locator(".aiResponseCard .aiAnswerBadge")).toHaveText("MESA");
      await attach(page, testInfo, `${width}px - AI explainer answer`);
    });

    if (phone) {
      test("menu", async ({ page }, testInfo) => {
        await openApp(page, "#/findings");
        await page.getByRole("button", { name: "Open menu" }).click();
        await expect(page.locator("#app-sidebar")).toBeVisible();
        await attach(page, testInfo, `${width}px - menu`);
      });
    }
  });
}
