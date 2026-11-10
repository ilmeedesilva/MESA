import { deviceFor, expect, openApp, test } from "./fixtures";

const menu = (page: import("@playwright/test").Page) => page.locator("#app-sidebar");
const pageTitle = (page: import("@playwright/test").Page) => page.locator(".appHeader h2");

test.describe("phone menu", () => {
  test.use(deviceFor(390));

  test("opens from the menu button and closes with Esc, the backdrop or a page choice", async ({ page }) => {
    await openApp(page);
    const button = page.getByRole("button", { name: "Open menu" });
    await expect(menu(page)).toBeHidden();

    await button.click();
    await expect(menu(page)).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu(page)).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await page.locator(".navBackdrop").click({ position: { x: 370, y: 400 } });
    await expect(menu(page)).toBeHidden();

    await button.click();
    await menu(page)
      .getByRole("button", { name: /^Findings/ })
      .click();
    await expect(menu(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/findings$/);
    await expect(page.locator(".mobileBarTitle span")).toHaveText("Findings");
  });
});

test.describe("tablet sidebar", () => {
  test.use(deviceFor(1024));

  test("is an icon rail that opens the full sidebar over the page", async ({ page }) => {
    await openApp(page);
    await expect(menu(page)).toHaveClass(/collapsed/);
    await expect(page.locator(".mobileBar")).toHaveCount(0);

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(menu(page)).toHaveClass(/overlayOpen/);
    await expect(menu(page).getByText("Architecture Analyzer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveClass(/collapsed/);
  });
});

test.describe("desktop sidebar", () => {
  test.use(deviceFor(1440));

  test("keeps a manual collapse when the window is resized", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(menu(page)).toHaveClass(/collapsed/);
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(menu(page)).toHaveClass(/collapsed/);
  });
});

test.describe("findings", () => {
  test.use(deviceFor(1440));

  test("open from a card, close with Close, Esc or the back button", async ({ page }) => {
    await openApp(page, "#/findings");
    const card = page.locator(".findingCardOpen").first();
    const dialog = page.getByRole("dialog");

    await card.click();
    await expect(dialog).toBeVisible();
    // Simple view hides finding IDs; the URL carries it.
    await expect(page).toHaveURL(/#\/findings\/MESA-[A-Z]+-\d+$/);

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#\/findings$/);

    await card.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(card).toBeFocused();

    await card.click();
    await expect(dialog).toBeVisible();
    await page.goBack();
    await expect(dialog).toBeHidden();
    await page.goForward();
    await expect(dialog).toBeVisible();
  });

  test("open full screen on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page, "#/findings");
    await page.locator(".findingCardOpen").first().click();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  });
});

test.describe("explanation level", () => {
  test.use(deviceFor(390));

  test("Simple hides IDs and file:line, Technical shows them, and the choice survives a reload", async ({ page }) => {
    await openApp(page, "#/findings");
    const levels = page.getByRole("group", { name: "Explanation level" });
    const cards = page.locator(".findingCard");
    await expect(levels.getByRole("button", { name: /Simple/ })).toHaveAttribute("aria-pressed", "true");
    await expect(cards.first()).toBeVisible();
    await expect(cards.filter({ hasText: /MESA-[A-Z]+-\d+/ })).toHaveCount(0);
    await expect(page.locator(".findingLocations")).toHaveCount(0);

    await levels.getByRole("button", { name: /Technical/ }).click();
    await expect(cards.filter({ hasText: /MESA-[A-Z]+-\d+/ }).first()).toBeVisible();
    await expect(page.locator(".findingLocations code").filter({ hasText: /:\d+$/ }).first()).toBeVisible();

    await page.reload();
    await expect(levels.getByRole("button", { name: /Technical/ })).toHaveAttribute("aria-pressed", "true");
    await cards.first().locator(".findingCardOpen").click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Raw evidence" })).toBeVisible();
  });
});

test.describe("links and the back button", () => {
  test.use(deviceFor(1440));

  test("every page has a URL, and back and forward move between them", async ({ page }) => {
    await openApp(page);
    const nav = page.getByRole("navigation", { name: "Workspace sections" });
    await nav.getByRole("button", { name: /^Findings/ }).click();
    await expect(page).toHaveURL(/#\/findings$/);
    await nav.getByRole("button", { name: /^Roadmap/ }).click();
    await expect(page).toHaveURL(/#\/roadmap$/);
    await expect(pageTitle(page)).toHaveText("Roadmap");

    await page.goBack();
    await expect(pageTitle(page)).toHaveText("Findings");
    await page.goBack();
    await expect(pageTitle(page)).toHaveText("Overview");
    await page.goForward();
    await expect(pageTitle(page)).toHaveText("Findings");
  });

  test("a shared finding link opens that finding, also after a reload", async ({ page }) => {
    await openApp(page, "#/findings");
    await page.locator(".findingCardOpen").first().click();
    await expect(page).toHaveURL(/#\/findings\/MESA-/);
    const id = decodeURIComponent(new URL(page.url()).hash.replace("#/findings/", ""));
    const title = await page.getByRole("dialog").getByRole("heading", { level: 2 }).innerText();

    await openApp(page, `#/findings/${id}`);
    await expect(page.getByRole("dialog").getByRole("heading", { level: 2 })).toHaveText(title);
    await page.reload();
    await expect(page.getByRole("dialog").getByRole("heading", { level: 2 })).toHaveText(title);
  });

  test("old ?section= links and documentation links open the right page", async ({ page }) => {
    await page.goto("/?section=roadmap");
    await expect(page).toHaveURL(/#\/roadmap$/);
    await expect(pageTitle(page)).toHaveText("Roadmap");

    await openApp(page, "#/docs/user-guide");
    await expect(page.locator(".docsArticle h1").first()).toBeVisible();
    await expect(page).toHaveURL(/#\/docs\/user-guide$/);
  });
});

test.describe("pages taken out of the app", () => {
  test.use(deviceFor(390));

  test("old links show the not-found page with a way home, and Evolution opens History", async ({ page }) => {
    for (const removed of ["evaluation", "benchmarks", "ai-baseline"]) {
      await openApp(page, `#/${removed}`);
      await expect(page.getByRole("heading", { name: "This page does not exist" })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`#/${removed}$`));
    }
    await page.getByRole("button", { name: "Go to Overview" }).click();
    await expect(page).toHaveURL(/\/(\?[^#]*)?$/);

    await openApp(page, "#/evolution");
    await expect(page).toHaveURL(/#\/history$/);
    await expect(page.getByRole("heading", { name: "What changed since the previous scan" })).toBeVisible();
  });
});

test.describe("graph", () => {
  test.use(deviceFor(1440));

  test("loads directly and after navigating to it, with working zoom buttons", async ({ page }) => {
    await openApp(page, "#/graph");
    await expect(page.locator(".graph canvas").first()).toBeAttached();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Fit graph to view" }).click();

    await page
      .getByRole("navigation", { name: "Workspace sections" })
      .getByRole("button", { name: /^Findings/ })
      .click();
    await page
      .getByRole("navigation", { name: "Workspace sections" })
      .getByRole("button", { name: /^Graph/ })
      .click();
    await expect(page.locator(".graph canvas").first()).toBeAttached();
  });

  test("fits a phone screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page, "#/graph");
    await expect(page.locator(".graph canvas").first()).toBeAttached();
    const box = await page.locator(".graph").boundingBox();
    expect(box!.width).toBeLessThanOrEqual(390);
    expect(box!.height).toBeLessThanOrEqual(844);
  });
});
