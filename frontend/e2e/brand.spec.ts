import { deviceFor, expect, openApp, test } from "./fixtures";
import type { Page } from "@playwright/test";

// The MESA logo and icons: the logo at the top of the sidebar, the app icon in the collapsed
// sidebar, the mark in the phone top bar, and every favicon file.

async function imageLoaded(page: Page, selector: string) {
  return page.locator(selector).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0);
}

test.describe("desktop", () => {
  test.use(deviceFor(1440));

  test("the sidebar shows the logo, named MESA, and the app icon when collapsed", async ({ page }) => {
    await openApp(page, "#/findings");
    const heading = page.locator("#app-sidebar").getByRole("heading", { level: 1 });
    await expect(heading).toHaveAccessibleName("MESA");
    expect(await imageLoaded(page, ".appLogo img"), "logo loaded").toBe(true);
    const logo = await page.locator(".appLogo img").boundingBox();
    expect(logo!.width, "at least the logo's smallest size").toBeGreaterThanOrEqual(96);

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.locator("img.appIdentityMark")).toHaveAttribute("alt", "MESA");
    expect(await imageLoaded(page, "img.appIdentityMark"), "app icon loaded").toBe(true);
    await expect(page.locator(".appLogo")).toHaveCount(0);
  });
});

test.describe("phone", () => {
  test.use(deviceFor(390));

  test("the top bar shows the mark, and the menu still opens with the logo", async ({ page }) => {
    await openApp(page, "#/findings");
    expect(await imageLoaded(page, ".mobileBarMark"), "mark loaded").toBe(true);
    await expect(page.locator(".mobileBarTitle span")).toHaveText("Findings");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("#app-sidebar .appLogo img")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#app-sidebar")).not.toHaveClass(/overlayOpen/);
  });
});

test("every favicon file is linked and loads", async ({ page }) => {
  await openApp(page);
  const links = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("href")));
  expect(links).toEqual(["/favicon.ico", "/favicon.svg", "/apple-touch-icon.png"]);
  for (const href of links) {
    const response = await page.request.get(href!);
    expect(response.status(), href!).toBe(200);
  }
});
