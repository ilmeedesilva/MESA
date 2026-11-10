import AxeBuilder from "@axe-core/playwright";
import { docsCatalog } from "../src/docsPortal";
import { deviceFor, expect, openApp, pageWidths, test } from "./fixtures";

// Every in-app doc, at phone and desktop width: Markdown tables, lists and emphasis are rendered
// (no raw "| --- |" text), wide tables and code scroll inside their own box rather than the page,
// links go to the right place, and the page has no accessibility violations.
const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const width of [390, 1440] as const) {
  test.describe(`${width}px`, () => {
    test.use(deviceFor(width));

    for (const doc of docsCatalog) {
      test(`${doc.slug} renders`, async ({ page }, testInfo) => {
        await openApp(page, `#/docs/${doc.slug}`);
        const article = page.locator(".docsMarkdown");
        await expect(article.locator("h1, h2").first()).toBeVisible();

        const text = await article.evaluate((element) => {
          const copy = element.cloneNode(true) as HTMLElement;
          copy.querySelectorAll("pre").forEach((pre) => pre.remove());
          return copy.innerText;
        });
        expect(text, "raw table syntax").not.toMatch(/\|\s*---/);
        expect(text, "raw emphasis markers").not.toMatch(/(^|\s)\*\*\S|\S\*\*(\s|$)/);
        expect(text, "raw link syntax").not.toMatch(/\]\([^)]*\)/);

        const tableLines = doc.content.split("\n").filter((line) => /^\|\s*---/.test(line)).length;
        await expect(article.locator(".docsTableScroll table")).toHaveCount(tableLines);

        const { innerWidth, scrollWidth } = await pageWidths(page);
        expect(scrollWidth, "no sideways page scrolling").toBeLessThanOrEqual(innerWidth);

        const results = await new AxeBuilder({ page }).include(".docsArticle").withTags(wcag).analyze();
        expect(
          results.violations.map((violation) => violation.id),
          "accessibility violations"
        ).toEqual([]);

        await testInfo.attach(`${doc.slug}-${width}px.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png"
        });
      });
    }
  });
}

test.describe("tables and links", () => {
  test.use(deviceFor(390));

  test("a wide table scrolls inside its box and can be scrolled with the keyboard", async ({ page }) => {
    await openApp(page, "#/docs/ci-github-action");
    const box = page.locator(".docsTableScroll").first();
    const sizes = await box.evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }));
    expect(sizes.scroll, "the table is wider than the phone").toBeGreaterThan(sizes.client);
    await box.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => box.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  });
});

test("the Markdown renderer loads only on the Documentation page", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  await openApp(page, "#/findings");
  expect(
    scripts.filter((url) => url.includes("DocsMarkdown")),
    "not loaded on Findings"
  ).toEqual([]);
  await page
    .getByRole("button", { name: /Documentation/ })
    .first()
    .click();
  await expect(page.locator(".docsMarkdown h1").first()).toBeVisible();
  expect(
    scripts.filter((url) => url.includes("DocsMarkdown")),
    "loaded on Documentation"
  ).toHaveLength(1);
});
