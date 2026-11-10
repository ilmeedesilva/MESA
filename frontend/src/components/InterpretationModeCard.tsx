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
        <h2>Explanation level</h2>
        <p>Choose how much detail MESA shows on every page. This browser remembers your choice.</p>
        <div className="docLinks">
          <DocLinkButton label="Findings guide" onClick={() => onOpenDoc("findings-guide")} />
        </div>
      </div>
      <div className="modeToggle" role="group" aria-label="Explanation level">
        <button
          type="button"
          className={mode === "simple" ? "modeButton active" : "modeButton"}
          aria-pressed={mode === "simple"}
          onClick={() => onChangeMode("simple")}
        >
          <small>Recommended</small>
          <strong>Simple</strong>
          <span>Plain-language view</span>
        </button>
        <button
          type="button"
          className={mode === "technical" ? "modeButton active" : "modeButton"}
          aria-pressed={mode === "technical"}
          onClick={() => onChangeMode("technical")}
        >
          <small>Detailed</small>
          <strong>Technical</strong>
          <span>Technical view: IDs, rules and raw evidence</span>
        </button>
      </div>
    </section>
  );
}
