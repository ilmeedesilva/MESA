import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without globals, so Testing Library does not unmount rendered trees by itself.
afterEach(() => {
  cleanup();
});

// jsdom has no matchMedia. This version understands min-width and max-width (in px), joined
// with "and", evaluates them against window.innerWidth, and reports changes on "resize".
if (!window.matchMedia) {
  const evaluate = (query: string) =>
    query.split(/\s+and\s+/).every((part) => {
      const match = part.match(/\((min|max)-width:\s*([\d.]+)px\)/);
      if (!match) return false;
      const width = Number(match[2]);
      return match[1] === "min" ? window.innerWidth >= width : window.innerWidth <= width;
    });

  window.matchMedia = (query: string) => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let matches = evaluate(query);
    const list = {
      media: query,
      get matches() {
        return matches;
      },
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
      addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
      dispatchEvent: () => false
    } as unknown as MediaQueryList;
    window.addEventListener("resize", () => {
      const next = evaluate(query);
      if (next === matches) return;
      matches = next;
      listeners.forEach((listener) => listener({ matches, media: query } as MediaQueryListEvent));
    });
    return list;
  };
}
