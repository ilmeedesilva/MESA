import type { AppSection } from "../types";

/** Simple line icons (24px grid, current colour) for the navigation rail and menu buttons. */
const paths: Record<AppSection | "menu" | "close" | "zoomIn" | "zoomOut" | "fit", string> = {
  overview: "M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-5.5h3V20h5V9.5",
  scan: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9.5 16.5-4.5-4.5",
  findings: "M12 3.5 2.8 19.5h18.4L12 3.5ZM12 9.5v4.5M12 16.8v.2",
  graph:
    "M6 6.5a2.5 2.5 0 1 0 0 .01M18 6.5a2.5 2.5 0 1 0 0 .01M12 18.5a2.5 2.5 0 1 0 0 .01M8.3 7.6l2.6 8.6M15.7 7.6l-2.6 8.6M8.5 6.5h7",
  ai: "M12 3.5l1.9 4.8 4.8 1.9-4.8 1.9L12 16.9l-1.9-4.8-4.8-1.9 4.8-1.9L12 3.5ZM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z",
  history: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.5H8M12 8v4.5l3 2",
  evolution: "M3.5 17.5 9 12l4 4 7.5-8M15 8h5.5v5.5",
  roadmap: "M4 20.5V4.5M4 5h11l-2 3.5 2 3.5H4M9 20.5h11",
  gate: "M12 3.5 4.5 6.5v5.5c0 4.4 3.2 7.6 7.5 8.5 4.3-.9 7.5-4.1 7.5-8.5V6.5L12 3.5ZM8.8 12.2l2.2 2.2 4.2-4.4",
  evaluation:
    "M8.5 4.5h7M8 4.5H6.5a2 2 0 0 0-2 2v12.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2H16M8.5 3.5h7v2.5h-7zM8.5 13l2.3 2.3 4.7-4.8",
  benchmarks: "M4.5 20.5h15M7 17V11M12 17V6.5M17 17v-8",
  "ai-baseline":
    "M12 4v16.5M7.5 20.5h9M5 7.5h14M5 7.5 2.5 13.5a2.8 2.8 0 0 0 5 0L5 7.5ZM19 7.5l-2.5 6a2.8 2.8 0 0 0 5 0L19 7.5Z",
  docs: "M4.5 5.5c2.8-1 5.4-.8 7.5 1 2.1-1.8 4.7-2 7.5-1v13c-2.8-1-5.4-.8-7.5 1-2.1-1.8-4.7-2-7.5-1v-13ZM12 6.5v13",
  menu: "M4 6.5h16M4 12h16M4 17.5h16",
  close: "M6 6l12 12M18 6 6 18",
  zoomIn: "M12 5.5v13M5.5 12h13",
  zoomOut: "M5.5 12h13",
  fit: "M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"
};

export type IconName = keyof typeof paths;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
