import { docsCatalog } from "./docsPortal";

/** Where repository files that are not in-app docs open: the files on GitHub. */
export const repositoryFileUrl = "https://github.com/ilmeedesilva/MESA/blob/main/";
export const repositoryTreeUrl = "https://github.com/ilmeedesilva/MESA/tree/main/";

export type DocLink =
  /** A heading on the same page ("#what-fails-the-check"). */
  | { kind: "anchor"; id: string }
  /** Another in-app doc; opens inside the app. */
  | { kind: "doc"; slug: string; href: string }
  /** A web address, or a repository file that is not an in-app doc; opens in a new tab. */
  | { kind: "external"; href: string };

/** Resolves "a/../b/./c" against nothing, like a URL path. Leading "../" past the root is dropped. */
function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

/**
 * Decides where a link in a doc goes. `docPath` is the doc's file in the repository (for example
 * "docs/guides/USER_GUIDE.md"); relative links are resolved against its folder, the way GitHub
 * resolves them.
 */
export function resolveDocLink(href: string, docPath: string): DocLink {
  if (href.startsWith("#")) {
    let id = href.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // Not encoded: use it as it is.
    }
    return { kind: "anchor", id };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return { kind: "external", href };

  const [pathPart, fragment] = href.split("#", 2);
  const folder = docPath.includes("/") ? docPath.slice(0, docPath.lastIndexOf("/") + 1) : "";
  const isDirectory = pathPart.endsWith("/");
  const resolved = normalizePath(pathPart.startsWith("/") ? pathPart : folder + pathPart);

  const doc = docsCatalog.find((entry) => entry.path === resolved);
  if (doc) return { kind: "doc", slug: doc.slug, href: `#/docs/${encodeURIComponent(doc.slug)}` };

  const base = isDirectory ? repositoryTreeUrl : repositoryFileUrl;
  return { kind: "external", href: `${base}${resolved}${isDirectory && resolved ? "/" : ""}${fragment ? `#${fragment}` : ""}` };
}
