import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// No backend: every request fails, so the app opens the embedded demo workspace.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("not found", { status: 404 }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const hash = () => window.location.hash;
const drawer = () => document.querySelector(".drawer");
const pageTitle = () => document.querySelector(".appHeader h2")?.textContent;

async function renderDemoAt(url: string) {
  window.history.replaceState(null, "", url);
  render(<App />);
  await screen.findAllByText("MESA Public Demo");
}

function clickNav(label: string) {
  const nav = screen.getByRole("navigation", { name: "Workspace sections" });
  const item = [...nav.querySelectorAll("button")].find(
    (button) => button.querySelector("strong")?.textContent === label
  );
  if (!item) throw new Error(`no navigation item ${label}`);
  fireEvent.click(item);
}

async function goBack() {
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

async function goForward() {
  await act(async () => {
    window.history.forward();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("hash routing", () => {
  it("gives each page a URL and the back and forward buttons move between them", async () => {
    await renderDemoAt("/");
    expect(hash()).toBe("");

    clickNav("Findings");
    expect(hash()).toBe("#/findings");
    clickNav("Evolution");
    expect(hash()).toBe("#/evolution");

    await goBack();
    await waitFor(() => expect(hash()).toBe("#/findings"));
    expect(document.querySelector(".findingCard")).not.toBeNull();

    await goBack();
    await waitFor(() => expect(hash()).toBe(""));
    expect(pageTitle()).toBe("Overview");

    await goForward();
    await waitFor(() => expect(hash()).toBe("#/findings"));
  });

  it("opens a finding at its own URL, and back closes it", async () => {
    await renderDemoAt("/");
    clickNav("Findings");

    fireEvent.click(document.querySelector<HTMLButtonElement>(".findingCardOpen")!);
    const id = drawer()!.querySelector(".findingMeta span")!.textContent!;
    expect(hash()).toBe(`#/findings/${id}`);

    await goBack();
    await waitFor(() => expect(drawer()).toBeNull());
    expect(hash()).toBe("#/findings");

    await goForward();
    await waitFor(() => expect(drawer()).not.toBeNull());
    expect(hash()).toBe(`#/findings/${id}`);
  });

  it("closing a finding returns to the list without leaving an extra history entry", async () => {
    await renderDemoAt("/");
    clickNav("Findings");
    const lengthBefore = window.history.length;

    fireEvent.click(document.querySelector<HTMLButtonElement>(".findingCardOpen")!);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(drawer()).toBeNull());
    expect(hash()).toBe("#/findings");
    await goBack();
    await waitFor(() => expect(hash()).toBe(""));
    expect(window.history.length).toBe(lengthBefore + 1);
  });

  it("opens a finding from a shared link once the scan has loaded", async () => {
    await renderDemoAt("/");
    clickNav("Findings");
    fireEvent.click(document.querySelector<HTMLButtonElement>(".findingCardOpen")!);
    const id = drawer()!.querySelector(".findingMeta span")!.textContent!;
    cleanup();

    await renderDemoAt(`/#/findings/${id}`);
    await waitFor(() => expect(drawer()).not.toBeNull());
    expect(drawer()!.querySelector(".findingMeta span")!.textContent).toBe(id);
    expect(hash()).toBe(`#/findings/${id}`);
  });

  it("drops an unknown finding from a link and shows the findings list", async () => {
    await renderDemoAt("/#/findings/NOT-A-FINDING");
    await waitFor(() => expect(hash()).toBe("#/findings"));
    expect(drawer()).toBeNull();
    expect(document.querySelector(".findingCard")).not.toBeNull();
  });

  it("follows hash edits made in the address bar", async () => {
    await renderDemoAt("/");
    await act(async () => {
      window.location.hash = "#/roadmap";
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(pageTitle()).toBe("Roadmap");
  });

  it("rewrites old ?section= links to the hash form", async () => {
    await renderDemoAt("/?section=evolution");
    await waitFor(() => expect(hash()).toBe("#/evolution"));
    expect(window.location.search).not.toContain("section=");
  });

  it("links documentation pages", async () => {
    await renderDemoAt("/#/docs/user-guide");
    expect(hash()).toBe("#/docs/user-guide");
    clickNav("Overview");
    expect(hash()).toBe("");
    await goBack();
    await waitFor(() => expect(hash()).toBe("#/docs/user-guide"));
  });
});
