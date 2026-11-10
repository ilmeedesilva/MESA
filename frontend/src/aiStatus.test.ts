import { describe, expect, it } from "vitest";
import { aiAnswerLabel, aiProviderName, aiStatusSummary } from "./viewHelpers";
import type { AIExplainerStatus } from "./types";

const status = (state: AIExplainerStatus["state"], base_url: string, model = "model-x"): AIExplainerStatus => ({
  mode: "hybrid",
  state,
  live_enabled: state !== "GROUNDED_ONLY",
  api_key_configured: state !== "MISSING_API_KEY",
  api_key_hint: null,
  model,
  base_url,
  message: "Hybrid AI is off. MESA is using grounded local explanations only."
});

const openai = "https://api.openai.com/v1";
const anthropic = "https://api.anthropic.com";

describe("aiProviderName", () => {
  it("names the configured provider", () => {
    expect(aiProviderName(openai)).toBe("OpenAI");
    expect(aiProviderName(anthropic)).toBe("Anthropic");
    expect(aiProviderName("https://llm.example.com/v1")).toBe("llm.example.com");
    expect(aiProviderName("")).toBe("AI provider");
  });
});

describe("aiStatusSummary", () => {
  it("says AI is off when it is not configured, and never names an unused model", () => {
    const off = aiStatusSummary(status("GROUNDED_ONLY", openai, "gpt-5.4-mini"));
    expect(off.text).toBe("AI: off. Using MESA's built-in explanations.");
    expect(off.kind).toBe("off");
    expect(off.detail).toBeNull();
    expect(aiStatusSummary(status("MISSING_API_KEY", anthropic)).text).toBe(
      "AI: off. Using MESA's built-in explanations."
    );
    expect(aiStatusSummary(status("MISSING_API_KEY", anthropic)).detail).toContain("Anthropic API key");
  });

  it("names the provider that is actually configured when AI works; the model is detail", () => {
    expect(aiStatusSummary(status("READY", openai)).text).toBe("AI: on (OpenAI).");
    expect(aiStatusSummary(status("READY", anthropic)).text).toBe("AI: on (Anthropic).");
    expect(aiStatusSummary(status("READY", anthropic, "claude-opus-5-5")).detail).toBe("Model: claude-opus-5-5.");
  });

  it("says AI is unavailable when it is configured but failing, with the reason as detail", () => {
    for (const state of [
      "PLACEHOLDER_API_KEY",
      "INVALID_API_KEY",
      "MODEL_UNAVAILABLE",
      "ACCESS_DENIED",
      "CONNECTION_ERROR"
    ] as const) {
      const summary = aiStatusSummary(status(state, anthropic));
      expect(summary.text).toBe("AI unavailable right now. Showing MESA's built-in explanation.");
      expect(summary.detail).toContain("Anthropic");
    }
  });

  it("never shows the backend's own wording", () => {
    for (const state of ["GROUNDED_ONLY", "MISSING_API_KEY", "READY", "CONNECTION_ERROR"] as const) {
      const summary = aiStatusSummary(status(state, openai));
      expect(`${summary.text} ${summary.detail ?? ""}`).not.toMatch(/grounded|hybrid/i);
    }
  });
});

describe("aiAnswerLabel", () => {
  it("labels AI answers AI, with the provider and model as detail", () => {
    expect(aiAnswerLabel("anthropic-hybrid:claude-opus-5-5")).toEqual({
      label: "AI",
      tone: "good",
      detail: "Answered by Anthropic (claude-opus-5-5)"
    });
    expect(aiAnswerLabel("openai-hybrid:gpt-5.4-mini").detail).toBe("Answered by OpenAI (gpt-5.4-mini)");
    expect(aiAnswerLabel("openai-hybrid").detail).toBe("Answered by OpenAI");
  });

  it("labels everything else MESA, without the internal source name", () => {
    expect(aiAnswerLabel("mesa-grounded-explainer-fallback")).toEqual({
      label: "MESA",
      tone: "neutral",
      detail: "Built-in explanation (AI was unavailable for this answer)"
    });
    expect(aiAnswerLabel("mesa-public-demo").detail).toBe("Built-in explanation");
    expect(aiAnswerLabel(undefined).label).toBe("MESA");
  });
});
