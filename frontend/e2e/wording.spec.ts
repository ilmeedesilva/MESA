import { deviceFor, expect, hashFor, openApp, sections, test } from "./fixtures";
import type { Page } from "@playwright/test";

// The detector's own finding text ("A concrete URL is embedded in source code") is kept on purpose.
const detectorPhrases = /\bis embedded in\b|\bthe embedded database host\b/gi;
const banned = /research|evaluator|grounded|embedded/i;

async function visibleText(page: Page) {
  return (await page.locator("body").innerText()).replace(detectorPhrases, "");
}

test.describe("product wording", () => {
  test.use(deviceFor(1440));

  for (const level of ["Simple", "Technical"] as const) {
    test(`no research, evaluator, grounded or embedded wording on any page (${level})`, async ({ page }) => {
      await openApp(page);
      await page
        .getByRole("group", { name: "Explanation level" })
        .getByRole("button", { name: new RegExp(level) })
        .click();

      for (const section of sections) {
        await openApp(page, hashFor(section));
        await expect(page.locator(".appHeader h2")).toBeVisible();
        expect(await visibleText(page), section).not.toMatch(banned);
      }

      await openApp(page, "#/findings");
      await page.locator(".findingCardOpen").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await visibleText(page), "finding panel").not.toMatch(banned);
      await page.keyboard.press("Escape");

      await openApp(page, "#/ai");
      await page.getByRole("button", { name: /Summarize this scan/ }).click();
      await expect(page.locator(".aiResponseCard h3")).not.toHaveText("MESA is preparing the answer...");
      expect(await visibleText(page), "AI answer").not.toMatch(banned);
    });
  }

  test("the AI Explainer shows one plain status line and a MESA label on answers", async ({ page }) => {
    await openApp(page, "#/ai");
    await expect(page.getByRole("status").filter({ hasText: "AI: off." })).toHaveText(
      /AI: off\. Using MESA's built-in explanations\./
    );
    await expect(page.getByRole("button", { name: "How to turn on AI" })).toBeVisible();
    await page.getByRole("button", { name: /Summarize this scan/ }).click();
    await expect(page.locator(".aiResponseCard .aiAnswerBadge")).toHaveText("MESA");
    await expect(page.locator(".aiResponseCard")).not.toContainText(/Answered by|fallback|hybrid/i);
  });
});
