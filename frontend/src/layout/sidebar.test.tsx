import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";

function resizeTo(width: number) {
  act(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
    window.dispatchEvent(new Event("resize"));
  });
}

const sidebarIsCollapsed = () => document.querySelector(".appSidebar")!.classList.contains("collapsed");

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("not found", { status: 404 }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  resizeTo(1024);
  window.history.replaceState(null, "", "/");
});

describe("sidebar", () => {
  it("collapses by itself below 1360px wide and expands above it", async () => {
    resizeTo(1300);
    render(<App />);
    await screen.findAllByText("MESA Public Demo");
    expect(sidebarIsCollapsed()).toBe(true);
    resizeTo(1440);
    expect(sidebarIsCollapsed()).toBe(false);
  });

  it("keeps a manual collapse when the window is resized", async () => {
    resizeTo(1440);
    render(<App />);
    await screen.findAllByText("MESA Public Demo");
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(sidebarIsCollapsed()).toBe(true);

    resizeTo(1000);
    resizeTo(1440);
    expect(sidebarIsCollapsed()).toBe(true);
  });

  it("keeps a manual expand when the window is resized", async () => {
    resizeTo(1300);
    render(<App />);
    await screen.findAllByText("MESA Public Demo");
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(sidebarIsCollapsed()).toBe(false);

    resizeTo(1000);
    resizeTo(1250);
    expect(sidebarIsCollapsed()).toBe(false);
  });
});

describe("phone menu and tablet rail", () => {
  const menu = () => document.getElementById("app-sidebar")!;
  const menuOpen = () => menu().classList.contains("overlayOpen");

  it("opens the phone menu, closes it with Esc and returns focus to the menu button", async () => {
    resizeTo(390);
    render(<App />);
    await screen.findAllByText("MESA Public Demo");
    const button = screen.getByRole("button", { name: "Open menu" });
    expect(menuOpen()).toBe(false);

    button.focus();
    fireEvent.click(button);
    expect(menuOpen()).toBe(true);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(menu().contains(document.activeElement)).toBe(true);
    expect(document.querySelector(".appFrame")).toHaveAttribute("inert");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(menuOpen()).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(document.querySelector(".appFrame")).not.toHaveAttribute("inert");
  });

  it("closes the phone menu after choosing a page, or tapping the backdrop", async () => {
    resizeTo(390);
    render(<App />);
    await screen.findAllByText("MESA Public Demo");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    fireEvent.click(within(nav).getByRole("button", { name: /^Findings/ }));
    expect(menuOpen()).toBe(false);
    expect(window.location.hash).toBe("#/findings");
    expect(document.querySelector(".mobileBarTitle span")).toHaveTextContent("Findings");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(document.querySelector(".navBackdrop")!);
    expect(menuOpen()).toBe(false);
  });

  it("shows an icon rail on tablets that opens the full sidebar over the page", async () => {
    resizeTo(900);
    render(<App />);
    await screen.findAllByText("MESA Public Demo");
    expect(menu()).toHaveClass("collapsed");
    expect(document.querySelector(".mobileBar")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(menuOpen()).toBe(true);
    expect(menu()).not.toHaveClass("collapsed");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menuOpen()).toBe(false);
    expect(menu()).toHaveClass("collapsed");
  });

  it("closes the menu when the layout changes", async () => {
    resizeTo(390);
    render(<App />);
    await screen.findAllByText("MESA Public Demo");
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    resizeTo(1440);
    expect(menuOpen()).toBe(false);
    expect(document.querySelector(".mobileBar")).toBeNull();
  });
});
