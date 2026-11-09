import React from "react";
import { useEffectEvent } from "./useEffectEvent";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "select:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])"
].join(", ");

function focusableIn(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(focusableSelector)].filter(
    (element) => element.offsetParent !== null || element === document.activeElement
  );
}

/**
 * Keyboard behaviour for a modal panel (menu, drawer): while `open`, the rest of the page is
 * inert, focus moves into the panel and Tab stays inside it, Esc calls `onClose`, and when the
 * panel closes focus returns to the element that had it before.
 */
export function useModalFocus({
  open,
  getContainer,
  inertSelectors,
  onClose,
  initialFocusSelector
}: {
  open: boolean;
  getContainer: () => HTMLElement | null;
  /** Elements outside the panel that become inert while it is open. */
  inertSelectors: string[];
  onClose: () => void;
  /** Element to focus first; defaults to the first focusable element in the panel. */
  initialFocusSelector?: string;
}) {
  const close = useEffectEvent(onClose);
  const container = useEffectEvent(getContainer);
  const inertKey = inertSelectors.join("|");

  React.useEffect(() => {
    if (!open) return;
    const panel = container();
    if (!panel) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const inerted = inertKey
      .split("|")
      .flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)])
      .filter((element) => !element.contains(panel) && !element.hasAttribute("inert"));
    inerted.forEach((element) => element.setAttribute("inert", ""));

    const first =
      (initialFocusSelector ? panel.querySelector<HTMLElement>(initialFocusSelector) : null) ?? focusableIn(panel)[0];
    (first ?? panel).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableIn(panel);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === firstItem || !panel.contains(document.activeElement))) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && (document.activeElement === lastItem || !panel.contains(document.activeElement))) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      inerted.forEach((element) => element.removeAttribute("inert"));
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, container, close, inertKey, initialFocusSelector]);
}
