import { deviceFor, expect, hashFor, openApp, pageWidths, sections, test, widths } from "./fixtures";

// Every page, at every width, fits the screen: no sideways scrolling, and on phones the browser
// does not zoom out to fit something wider than the screen. Each page's screenshot is attached
// to the HTML report.
for (const width of widths) {
  test.describe(`${width}px`, () => {
    test.use(deviceFor(width));

    for (const section of sections) {
      test(`${section} fits the screen`, async ({ page }, testInfo) => {
        await openApp(page, hashFor(section));
        const { innerWidth, scrollWidth } = await pageWidths(page);
        expect(innerWidth, "the browser did not zoom out").toBe(width);
        expect(scrollWidth, "no sideways scrolling").toBeLessThanOrEqual(innerWidth);
        await testInfo.attach(`${section}-${width}px.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png"
        });
      });
    }

    test("an open finding fits the screen", async ({ page }) => {
      await openApp(page, "#/findings");
      await page.locator(".findingCardOpen").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const { innerWidth, scrollWidth } = await pageWidths(page);
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
      const box = await page.getByRole("dialog").boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(innerWidth + 1);
    });
  });
}

test.describe("documentation on a phone", () => {
  test.use(deviceFor(390));

  test("every documentation page fits the screen", async ({ page }) => {
    await openApp(page, "#/docs");
    const picker = page.getByRole("combobox", { name: "Page" });
    const slugs = await picker
      .locator("option")
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(slugs.length).toBeGreaterThan(5);
    for (const slug of slugs) {
      await picker.selectOption(slug);
      await expect(page).toHaveURL(new RegExp(`#/docs/${slug}$`));
      const { innerWidth, scrollWidth } = await pageWidths(page);
      expect(innerWidth, `${slug}: the browser did not zoom out`).toBe(390);
      expect(scrollWidth, `${slug}: no sideways scrolling`).toBeLessThanOrEqual(390);
    }
  });
});
