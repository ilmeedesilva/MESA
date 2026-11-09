import type { AppSection } from "../types";

/**
 * Hash routes, so every page can be linked to and the back button works, also on static
 * hosting such as GitHub Pages:
 *
 *   #/findings                  a section
 *   #/findings/MESA-CYCL-003    the Findings page with one finding open
 *   #/docs/quick-start          a documentation page
 *
 * The overview has no hash. The selected project stays in the query string (?project=...).
 */
export type Route = {
  section: AppSection;
  findingId?: string;
  docSlug?: string;
};

export const appSections: readonly AppSection[] = [
  "overview",
  "scan",
  "findings",
  "graph",
  "history",
  "evolution",
  "roadmap",
  "gate",
  "ai",
  "evaluation",
  "benchmarks",
  "ai-baseline",
  "docs"
];

const legacySectionAliases: Record<string, AppSection> = { services: "scan", policies: "scan" };

function asSection(value: string | null | undefined): AppSection | null {
  if (!value) return null;
  if (value in legacySectionAliases) return legacySectionAliases[value];
  return (appSections as readonly string[]).includes(value) ? (value as AppSection) : null;
}

function decodeSegment(segment: string | undefined): string | undefined {
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Parses "#/section[/detail]". Returns null when there is no route in the hash. */
export function parseHash(hash: string): Route | null {
  const path = hash.replace(/^#\/?/, "").replace(/\/+$/, "");
  if (!path) return null;
  const [first, second] = path.split("/");
  const section = asSection(decodeSegment(first));
  if (!section) return { section: "overview" };
  const detail = decodeSegment(second);
  if (section === "findings" && detail) return { section, findingId: detail };
  if (section === "docs" && detail) return { section, docSlug: detail };
  return { section };
}

/** Builds the hash for a route; the overview has none. */
export function buildHash(route: Route): string {
  if (route.section === "overview") return "";
  const detail = route.section === "findings" ? route.findingId : route.section === "docs" ? route.docSlug : undefined;
  return detail ? `#/${route.section}/${encodeURIComponent(detail)}` : `#/${route.section}`;
}

/** Reads the route from a location: the hash first, then the old ?section= query parameter. */
export function readRoute(location: Pick<Location, "hash" | "search"> = window.location): Route {
  const fromHash = parseHash(location.hash);
  if (fromHash) return fromHash;
  const legacy = asSection(new URLSearchParams(location.search).get("section"));
  return { section: legacy ?? "overview" };
}

/** The full URL for a project and route. Drops the old ?section= parameter. */
export function buildUrl(projectId: string, route: Route, current: string = window.location.href): string {
  const url = new URL(current);
  if (projectId) url.searchParams.set("project", projectId);
  else url.searchParams.delete("project");
  url.searchParams.delete("section");
  url.hash = buildHash(route);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** History state marker for a finding opened inside the app, so closing it can go back instead. */
export type RouteHistoryState = { mesaFindingOpenedInApp?: boolean } | null;

export function writeUrl(projectId: string, route: Route, mode: "push" | "replace", state: RouteHistoryState = null) {
  const next = buildUrl(projectId, route);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (mode === "replace") {
    if (next !== current) window.history.replaceState(window.history.state, "", next);
    return;
  }
  if (next !== current) window.history.pushState(state, "", next);
}
