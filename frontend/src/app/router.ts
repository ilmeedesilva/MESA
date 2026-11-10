import { docsCatalog } from "../docsPortal";
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
 * A link to a page that does not exist (including the pages taken out of the app, such as
 * #/evaluation) opens the not-found page, and the address bar keeps what was typed.
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
  "roadmap",
  "gate",
  "ai",
  "docs"
];

/** Old page names that still open the page that replaced them. */
const legacySectionAliases: Record<string, AppSection> = { services: "scan", policies: "scan", evolution: "history" };

/** Old documentation links that still open the page that replaced them. */
const legacyDocSlugs: Record<string, string> = { "evaluator-quick-start": "quick-start" };

function isKnownDocSlug(slug: string) {
  return docsCatalog.some((doc) => doc.slug === slug);
}

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
  if (!section) return { section: "not-found" };
  const detail = decodeSegment(second);
  if (section === "findings" && detail) return { section, findingId: detail };
  if (section === "docs" && detail) {
    const slug = legacyDocSlugs[detail] ?? detail;
    return isKnownDocSlug(slug) ? { section, docSlug: slug } : { section: "not-found" };
  }
  return { section };
}

/** Builds the hash for a route; the overview has none. The not-found page keeps the current hash. */
export function buildHash(route: Route, currentHash: string = window.location.hash): string {
  if (route.section === "not-found") return currentHash;
  if (route.section === "overview") return "";
  const detail = route.section === "findings" ? route.findingId : route.section === "docs" ? route.docSlug : undefined;
  return detail ? `#/${route.section}/${encodeURIComponent(detail)}` : `#/${route.section}`;
}

/** Reads the route from a location: the hash first, then the old ?section= query parameter. */
export function readRoute(location: Pick<Location, "hash" | "search"> = window.location): Route {
  const fromHash = parseHash(location.hash);
  if (fromHash) return fromHash;
  const legacySection = new URLSearchParams(location.search).get("section");
  if (!legacySection) return { section: "overview" };
  return { section: asSection(legacySection) ?? "not-found" };
}

/** The full URL for a project and route. Drops the old ?section= parameter. */
export function buildUrl(projectId: string, route: Route, current: string = window.location.href): string {
  const url = new URL(current);
  if (projectId) url.searchParams.set("project", projectId);
  else url.searchParams.delete("project");
  // The not-found page leaves the address as it was typed, old ?section= value included.
  if (route.section !== "not-found") url.searchParams.delete("section");
  url.hash = buildHash(route, url.hash);
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
