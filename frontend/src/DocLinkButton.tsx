import React from "react";

export function DocLinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="docLinkButton" onClick={onClick}>
      {label}
    </button>
  );
}
