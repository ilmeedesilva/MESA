/**
 * The public demo site (GitHub Pages) is built with VITE_MESA_DEMO_SITE=true. It only has the
 * embedded demo data: there is never a MESA server, so it sends no requests to one and does not
 * offer to connect. The normal app (npm run dev, docker compose) is not affected.
 */
export const isDemoSite = import.meta.env.VITE_MESA_DEMO_SITE === "true";

/** Shown when someone on the demo site tries something that needs a MESA server. */
export const demoSiteActionMessage =
  "This demo shows example data only, so it can't do that. Install MESA to scan your own code.";
