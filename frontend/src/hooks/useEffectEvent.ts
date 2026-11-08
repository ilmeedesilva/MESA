import React from "react";

/**
 * Returns a stable function that always calls the latest `handler`.
 *
 * Use it for logic that an effect runs but that should not decide when the effect runs
 * (the same idea as React's experimental `useEffectEvent`). The effect lists only the values
 * that should trigger it, plus this stable function, so it re-runs exactly as before while
 * still reading current state.
 */
export function useEffectEvent<Args extends unknown[], Result>(
  handler: (...args: Args) => Result
): (...args: Args) => Result {
  const handlerRef = React.useRef(handler);
  React.useLayoutEffect(() => {
    handlerRef.current = handler;
  });
  return React.useCallback((...args: Args) => handlerRef.current(...args), []);
}
