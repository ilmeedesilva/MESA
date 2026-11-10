import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { interpretationModeStorageKey, readStoredInterpretationMode } from "./interpretationMode";
import { findingLocations } from "../viewHelpers";
import type { Finding } from "../types";

// No backend: the app opens the demo data.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("not found", { status: 404 }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

async function renderFindings() {
  window.history.replaceState(null, "", "/#/findings");
  render(<App />);
  await screen.findAllByText("MESA Public Demo");
}

const levelButton = (name: "Simple" | "Technical") =>
  within(screen.getByRole("group", { name: "Explanation level" })).getByRole("button", { name: new RegExp(name) });

const firstCard = () => document.querySelector<HTMLElement>(".findingCard")!;

describe("explanation level", () => {
  it("starts in Simple: no finding IDs, rules or file:line on cards or in the panel", async () => {
    await renderFindings();
    expect(levelButton("Simple")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Plain-language view", { selector: ".modePill" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Beginner|Research/);

    const card = firstCard();
    expect(card.textContent).not.toMatch(/MESA-[A-Z]+-\d+/);
    expect(within(card).queryByText(/^Rule:/)).toBeNull();
    expect(card.querySelector(".findingLocations")).toBeNull();

    fireEvent.click(card.querySelector<HTMLButtonElement>(".findingCardOpen")!);
    const panel = screen.getByRole("dialog");
    expect(within(panel).getByText("What MESA found")).toBeInTheDocument();
    expect(within(panel).getByText("Why it matters")).toBeInTheDocument();
    expect(within(panel).getByText("What to do first")).toBeInTheDocument();
    expect(panel.textContent).not.toMatch(/MESA-[A-Z]+-\d+/);
    expect(within(panel).queryByText("Raw evidence")).toBeNull();
    expect(within(panel).queryByText(/^Recommendation source:/)).toBeNull();
  });

  it("Technical adds the finding ID, detector, rule and file:line, and keeps the Simple content", async () => {
    await renderFindings();
    fireEvent.click(levelButton("Technical"));
    expect(screen.getByText("Technical view", { selector: ".modePill" })).toBeInTheDocument();

    const cards = [...document.querySelectorAll<HTMLElement>(".findingCard")];
    expect(cards.some((card) => /MESA-[A-Z]+-\d+/.test(card.textContent ?? ""))).toBe(true);
    expect(cards.some((card) => card.querySelector(".findingLocations code")?.textContent?.match(/:\d+$/))).toBe(true);
    expect(within(cards[0]).getByText(/^Detector:/)).toBeInTheDocument();
    expect(within(cards[0]).getByText("Do first")).toBeInTheDocument();

    fireEvent.click(cards[0].querySelector<HTMLButtonElement>(".findingCardOpen")!);
    const panel = screen.getByRole("dialog");
    expect(panel.textContent).toMatch(/MESA-[A-Z]+-\d+/);
    expect(within(panel).getByText("Raw evidence")).toBeInTheDocument();
    expect(within(panel).getByText("Rule")).toBeInTheDocument();
    expect(within(panel).getByText("What MESA found")).toBeInTheDocument();
  });

  it("remembers the choice in this browser", async () => {
    await renderFindings();
    fireEvent.click(levelButton("Technical"));
    expect(window.localStorage.getItem(interpretationModeStorageKey)).toBe("technical");
  });

  it("opens in the stored level", async () => {
    window.localStorage.setItem(interpretationModeStorageKey, "technical");
    await renderFindings();
    expect(levelButton("Technical")).toHaveAttribute("aria-pressed", "true");
  });

  it("falls back to Simple when storage is blocked or holds an unknown value", () => {
    window.localStorage.setItem(interpretationModeStorageKey, "research");
    expect(readStoredInterpretationMode()).toBe("simple");
    window.localStorage.setItem(interpretationModeStorageKey, "technical");
    const own = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      }
    });
    try {
      expect(readStoredInterpretationMode()).toBe("simple");
    } finally {
      if (own) Object.defineProperty(window, "localStorage", own);
      else delete (window as { localStorage?: Storage }).localStorage;
    }
    expect(readStoredInterpretationMode()).toBe("technical");
  });
});

describe("findingLocations", () => {
  const base = { id: "F", type: "X", severity: "LOW", confidence: 0.5, services: [], description: "" };

  it("lists evidence steps, raw evidence and source files as file:line without duplicates", () => {
    const finding = {
      ...base,
      evidence_chain: [{ step: "a", description: "", source: { file_path: "a.py", line_number: 3 } }],
      evidence: [{ file_path: "a.py", line_number: 3 }, { file_path: "b.py", line_number: 7 }, { value: 1 }],
      source_files: ["a.py", "c.py"]
    } as unknown as Finding;
    expect(findingLocations(finding)).toEqual(["a.py:3", "b.py:7", "c.py"]);
  });

  it("returns nothing when a finding has no locations", () => {
    expect(findingLocations({ ...base, evidence: [] } as unknown as Finding)).toEqual([]);
  });
});
