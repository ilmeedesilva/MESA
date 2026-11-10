import React from "react";
import type { InterpretationMode } from "../types";

const options: Array<{ mode: InterpretationMode; label: string; help: string }> = [
  { mode: "simple", label: "Simple", help: "Plain-language view" },
  { mode: "technical", label: "Technical", help: "Technical view: IDs, rules and raw evidence" }
];

/**
 * The explanation level as a small segmented control. Each option's help text is a tooltip
 * (on hover and keyboard focus, dismissed with Esc) and its screen-reader description. In the
 * phone menu, where there is no hover, the help is shown as text instead.
 */
export function ExplanationSwitch({
  mode,
  onChangeMode,
  showHelp = false
}: {
  mode: InterpretationMode;
  onChangeMode: (mode: InterpretationMode) => void;
  showHelp?: boolean;
}) {
  const id = React.useId();
  const [tooltip, setTooltip] = React.useState<InterpretationMode | null>(null);

  return (
    <div className={showHelp ? "explanationSwitch withHelp" : "explanationSwitch"}>
      {showHelp ? <span className="explanationSwitchLabel">Explanation level</span> : null}
      <div className="levelSwitch" role="group" aria-label="Explanation level">
        {options.map((option) => {
          const tipId = `${id}-${option.mode}`;
          return (
            <span
              key={option.mode}
              className="levelSwitchItem"
              onMouseEnter={() => setTooltip(option.mode)}
              onMouseLeave={() => setTooltip(null)}
            >
              <button
                type="button"
                className={mode === option.mode ? "active" : undefined}
                aria-pressed={mode === option.mode}
                aria-describedby={tipId}
                onClick={() => onChangeMode(option.mode)}
                onFocus={() => setTooltip(option.mode)}
                onBlur={() => setTooltip(null)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && tooltip) {
                    // Close the tooltip only; do not also close a menu or dialog around it.
                    event.stopPropagation();
                    setTooltip(null);
                  }
                }}
              >
                {option.label}
              </button>
              <span
                id={tipId}
                role="tooltip"
                className={!showHelp && tooltip === option.mode ? "levelTooltip visible" : "levelTooltip"}
              >
                {option.help}
              </span>
            </span>
          );
        })}
      </div>
      {showHelp ? (
        <small className="explanationSwitchHelp">
          {options.find((option) => option.mode === mode)?.help}. Remembered in this browser.
        </small>
      ) : null}
    </div>
  );
}
