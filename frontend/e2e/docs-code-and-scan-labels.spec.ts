import { deviceFor, expect, openApp, pageWidths, test } from "./fixtures";

// Two display fixes: code blocks in the in-app docs look like one block (the code inside is not
// styled as inline code) and long lines scroll inside the block; the demo scans in "Recent
// scans" have readable labels instead of the first 8 characters of their ID ("demo-sca").

for (const width of [390, 1440] as const) {
  test.describe(`${width}px`, () => {
    test.use(deviceFor(width));

    test("docs code blocks are one block and scroll inside it", async ({ page }) => {
      await openApp(page, "#/docs/ci-github-action");
      const block = page.locator(".docsMarkdown pre.docsCodeBlock").first();
      await expect(block).toBeVisible();

      const styles = await block.evaluate((pre) => {
        const code = pre.querySelector("code")!;
        const inline = document.querySelector(".docsMarkdown :is(p, li) > code")!;
        return {
          blockBackground: getComputedStyle(pre).backgroundColor,
          codeBackground: getComputedStyle(code).backgroundColor,
          codePadding: getComputedStyle(code).paddingLeft,
          inlineBackground: getComputedStyle(inline).backgroundColor
        };
      });
      expect(styles.codeBackground, "code inside a block has no own background").toBe("rgba(0, 0, 0, 0)");
      expect(styles.codePadding).toBe("0px");
      expect(styles.blockBackground).not.toBe("rgba(0, 0, 0, 0)");
      expect(styles.inlineBackground, "inline code keeps its highlight").not.toBe("rgba(0, 0, 0, 0)");

      // The guide has lines wider than a phone: the block scrolls, the page does not.
      const overflowing = await page
        .locator(".docsMarkdown pre.docsCodeBlock")
        .evaluateAll((blocks) => blocks.filter((pre) => pre.scrollWidth > pre.clientWidth).length);
      if (width === 390) expect(overflowing, "a long line scrolls inside its block").toBeGreaterThan(0);
      const { innerWidth, scrollWidth } = await pageWidths(page);
      expect(scrollWidth, "no sideways page scrolling").toBeLessThanOrEqual(innerWidth);
    });
  });
}

test.describe("recent scans", () => {
  test.use(deviceFor(1440));

  test("demo scans have readable labels", async ({ page }) => {
    await openApp(page, "#/findings");
    const rail = page.locator(".globalScanRail");
    await expect(rail.getByText("monolith demo", { exact: true })).toBeVisible();
    await expect(rail.getByText("shared db demo", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/demo-sca\b/);
  });
});
