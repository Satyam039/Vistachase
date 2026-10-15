// URL rules shared by the SEO module. Every path, canonical, image and redirect target staff type
// goes through here, so the dashboard can't publish an off-site canonical, a javascript: link or
// an open redirect.

/** Paths a redirect may never start from: app internals and signed-in areas. */
const RESERVED_PREFIXES = ["/api", "/_next", "/media", "/admin", "/account", "/booking", "/book", "/review", "/track", "/partners/dashboard", "/seo"];

const PATH_CHARS = /^\/[A-Za-z0-9\-._~/%]*$/;

/**
 * Normalises a same-site path: leading "/", no query, fragment, "//", ".." or trailing slash
 * (except "/"). Returns null when the input isn't a plain site path.
 */
export function normalizePath(input: string): string | null {
  const raw = input.trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.length > 300) return null;
  if (/[?#\s\\]/.test(raw)) return null;
  if (!PATH_CHARS.test(raw)) return null;
  const segments = raw.split("/");
  if (segments.some((s) => s === ".." || s === ".")) return null;
  let path = raw.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  try {
    decodeURIComponent(path);
  } catch {
    return null;
  }
  return path || "/";
}

export function isReservedPath(path: string): boolean {
  const lower = path.toLowerCase();
  return RESERVED_PREFIXES.some((p) => lower === p || lower.startsWith(`${p}/`));
}

/** The public site address from existing configuration (SITE_URL, else FRONTEND_URL), or null. */
export function configuredSiteUrl(): URL | null {
  for (const value of [process.env.SITE_URL, process.env.FRONTEND_URL]) {
    if (!value) continue;
    try {
      const url = new URL(value.split(",")[0].trim());
      if (url.protocol === "https:" || url.protocol === "http:") return url;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

const sameHost = (a: string, b: string) => a.replace(/^www\./, "").toLowerCase() === b.replace(/^www\./, "").toLowerCase();

export type UrlCheck = { ok: true; value: string } | { ok: false; error: string };

/** Canonical: a site path, or an absolute URL on this site's host. Stored as given (path form preferred). */
export function checkCanonical(input: string): UrlCheck {
  const value = input.trim();
  if (value.startsWith("/")) {
    const path = normalizePath(value);
    return path ? { ok: true, value: path } : { ok: false, error: "Use a site path like /private-tours (no query string)." };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Use a site path like /private-tours or a full https:// address on this site." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: "Only http(s) addresses." };
  if (url.username || url.password) return { ok: false, error: "Addresses can't contain a user name or password." };
  const site = configuredSiteUrl();
  if (!site) return { ok: false, error: "The site address isn't configured (SITE_URL), so use a path like /private-tours." };
  if (!sameHost(url.hostname, site.hostname)) return { ok: false, error: `The canonical must point to this site (${site.hostname}).` };
  if (url.search || url.hash) return { ok: false, error: "Canonical URLs can't have a query string or #fragment." };
  return { ok: true, value: url.toString().replace(/\/$/, "") || url.toString() };
}

/** Images: a file this site serves (/media/...) or an https URL. */
export function checkImageRef(input: string): UrlCheck {
  const value = input.trim();
  if (value.startsWith("/")) {
    const path = normalizePath(value);
    if (!path || !path.startsWith("/media/")) return { ok: false, error: "Images must be under /media/ or an https:// address." };
    return { ok: true, value: path };
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, error: "Images must be under /media/ or an https:// address." };
  }
}

/** Links staff set (CTA, llms.txt): a site path, or an https / mailto / tel link. Never javascript: or data:. */
export function checkLink(input: string): UrlCheck {
  const value = input.trim();
  if (value.startsWith("/")) {
    if (value.startsWith("//")) return { ok: false, error: "Use a site path like /contact-us or a full https:// address." };
    const [pathPart, ...rest] = value.split(/(?=[?#])/);
    const path = normalizePath(pathPart);
    if (!path) return { ok: false, error: "Use a site path like /contact-us or a full https:// address." };
    const suffix = rest.join("");
    if (suffix && !/^[?#][A-Za-z0-9\-._~%&=+:,/?#]*$/.test(suffix)) return { ok: false, error: "That link has characters it shouldn't." };
    return { ok: true, value: path + suffix };
  }
  try {
    const url = new URL(value);
    if (!["https:", "mailto:", "tel:"].includes(url.protocol) || url.username || url.password) throw new Error();
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, error: "Links must be a site path, or an https://, mailto: or tel: address." };
  }
}

/** "Lake Louise & Moraine Lake!" -> "lake-louise-moraine-lake" */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lower-case, single-spaced keyword text used to find duplicates. */
export function normalizeKeyword(input: string): string {
  return input.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}
