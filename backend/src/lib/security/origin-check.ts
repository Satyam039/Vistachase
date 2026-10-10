// CSRF origin check for state-changing API requests (used in app.ts).
//
// Browsers proxy /api/* through the frontend (Next rewrites), which forwards the page's Origin and
// puts the host the browser asked for in X-Forwarded-Host. A request is allowed when its Origin is
// configured (CORS_ORIGINS / FRONTEND_URL) or when it comes from the site itself, i.e. the Origin's
// host is the host the request was sent to. That keeps the site working on any address it is served
// from (bare IP, new domain) while another site's request is still refused: a cross-site page can't
// set X-Forwarded-Host without a CORS preflight, and that preflight fails for an unlisted origin.

/** "https://WWW.Example.com:443/" → "https://www.example.com"; unparsable input → "". */
export function normalizeOrigin(value: string): string {
  try {
    const url = new URL(value.trim());
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/:(80|443)$/, "");
}

export function isAllowedOrigin(origin: string, forwardedHost: string | undefined, allowedOrigins: string[]): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (allowedOrigins.some((o) => normalizeOrigin(o) === normalized)) return true;

  // Proxies may append hosts ("a, b"); the first is the one the browser used.
  const requestHost = forwardedHost?.split(",")[0];
  if (!requestHost) return false;
  return normalizeHost(new URL(normalized).host) === normalizeHost(requestHost);
}
