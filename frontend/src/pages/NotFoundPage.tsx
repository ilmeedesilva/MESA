import { StatePanel } from "../components/StatePanel";

export function NotFoundPage({ onGoHome }: { onGoHome: () => void }) {
  return (
    <StatePanel
      kind="empty"
      title="This page does not exist"
      actions={
        <button type="button" onClick={onGoHome}>
          Go to Overview
        </button>
      }
    >
      The link may be old or mistyped. Everything in MESA is reachable from the menu.
    </StatePanel>
  );
}
