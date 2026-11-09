import { DocLinkButton } from "./DocLinkButton";
import type { InterpretationMode } from "../types";

export function InterpretationModeCard({
  mode,
  onChangeMode,
  onOpenDoc
}: {
  mode: InterpretationMode;
  onChangeMode: (mode: InterpretationMode) => void;
  onOpenDoc: (slug: string) => void;
}) {
  return (
    <section className="interpretationPanel globalInterpretationPanel">
      <div className="interpretationIntro">
        <div className="eyebrow">Global Interpretation Mode</div>
        <h2>Choose how MESA explains results everywhere</h2>
        <p>
          Switch between a guided plain-language view and a deeper research-oriented explanation. This applies across
          findings, drawers, AI prompts, and scan workspaces.
        </p>
        <div className="docLinks">
          <DocLinkButton label="Findings guide" onClick={() => onOpenDoc("findings-guide")} />
        </div>
      </div>
      <div className="modeToggle" role="group" aria-label="Interpretation mode">
        <button
          type="button"
          className={mode === "beginner" ? "modeButton active" : "modeButton"}
          aria-pressed={mode === "beginner"}
          onClick={() => onChangeMode("beginner")}
        >
          <small>Recommended</small>
          <strong>Beginner</strong>
          <span>Plain language explanations, impact, and the best first action.</span>
        </button>
        <button
          type="button"
          className={mode === "research" ? "modeButton active" : "modeButton"}
          aria-pressed={mode === "research"}
          onClick={() => onChangeMode("research")}
        >
          <small>Detailed</small>
          <strong>Research</strong>
          <span>Detector labels, richer evidence detail, and technical context.</span>
        </button>
      </div>
    </section>
  );
}
