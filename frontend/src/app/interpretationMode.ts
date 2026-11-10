import type { InterpretationMode } from "../types";

/** The explanation level is remembered per browser. Storage can be missing or blocked, so every access is guarded. */
export const interpretationModeStorageKey = "mesa.explanationLevel";

export function readStoredInterpretationMode(): InterpretationMode {
  try {
    return window.localStorage.getItem(interpretationModeStorageKey) === "technical" ? "technical" : "simple";
  } catch {
    return "simple";
  }
}

export function storeInterpretationMode(mode: InterpretationMode) {
  try {
    window.localStorage.setItem(interpretationModeStorageKey, mode);
  } catch {
    // Private windows or blocked storage: the choice simply lasts for this visit.
  }
}
