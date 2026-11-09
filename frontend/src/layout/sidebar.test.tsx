import { act, fireEvent, render, screen } from "@testing-library/react";
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
