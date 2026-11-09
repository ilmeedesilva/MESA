import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// No backend: the app opens the embedded demo workspace.
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

async function renderDemo(url = "/") {
  window.history.replaceState(null, "", url);
  render(<App />);
  await screen.findAllByText("MESA Public Demo");
}

const drawer = () => document.querySelector<HTMLElement>(".drawer");

describe("keyboard use", () => {
  it("opens a finding from its card with the keyboard, keeps focus in the drawer, and Esc returns focus", async () => {
    await renderDemo("/#/findings");
    const opener = document.querySelector<HTMLButtonElement>(".findingCardOpen")!;
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName(opener.textContent!);
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close" }));
    expect(document.querySelector(".appFrame")).toHaveAttribute("inert");

    // Shift+Tab from the first control wraps to the last one inside the drawer.
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    await waitFor(() => expect(drawer()).toBeNull());
    expect(document.activeElement).toBe(opener);
    expect(document.querySelector(".appFrame")).not.toHaveAttribute("inert");
  });

  it("closes the drawer from the backdrop", async () => {
    await renderDemo("/#/findings");
    fireEvent.click(document.querySelector<HTMLButtonElement>(".findingCardOpen")!);
    fireEvent.click(document.querySelector(".drawerBackdrop")!);
    await waitFor(() => expect(drawer()).toBeNull());
  });

  it("opens the metric detail with focus inside, and Esc returns focus to See more", async () => {
    await renderDemo("/");
    const more = screen.getByRole("button", { name: "See more" });
    fireEvent.click(more);
    const popover = screen.getByRole("dialog", { name: /detail/ });
    expect(document.activeElement).toBe(within(popover).getByRole("button", { name: "Close" }));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /detail/ })).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it("has a skip link that moves focus to the page content", async () => {
    await renderDemo("/");
    fireEvent.click(screen.getByRole("button", { name: "Skip to content" }));
    expect(document.activeElement).toBe(screen.getByRole("main"));
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("marks the current page and the interpretation mode for screen readers", async () => {
    await renderDemo("/#/findings");
    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    expect(within(nav).getByRole("button", { name: /^Findings/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("button", { name: /^Overview/ })).not.toHaveAttribute("aria-current");

    const modes = screen.getByRole("group", { name: "Interpretation mode" });
    const beginner = within(modes).getByRole("button", { name: /Beginner/ });
    const research = within(modes).getByRole("button", { name: /Research/ });
    expect(beginner).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(research);
    expect(research).toHaveAttribute("aria-pressed", "true");
    expect(beginner).toHaveAttribute("aria-pressed", "false");
  });
});
