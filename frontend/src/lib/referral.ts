// Partner (affiliate) referral code shown in the address bar.
//
// A partner link such as /banff-highlights-tour?ref=ABCPRIVATE sets two cookies in the middleware:
//   vc_ref       httpOnly, read by the API when a booking is made (this is what credits the partner)
//   vc_ref_code  readable copy with the same 30-day life, used only to keep ?ref=<code> in the
//                address bar as the guest moves around the public site
// Both are cleared by the browser after 30 days; a newer partner link replaces them (last click wins).

export const REF_COOKIE = "vc_ref";
export const REF_VIEW_COOKIE = "vc_ref_code";
export const REF_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const REF_PATTERN = /^[A-Za-z0-9]{3,24}$/;

// Staff, partner and customer-account screens never carry the partner code in their address.
const NO_REF_PREFIXES = ["/admin", "/seo", "/affiliate", "/partners/dashboard", "/account", "/login", "/register", "/api"];

export function keepsRefInUrl(pathname: string): boolean {
  return !NO_REF_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The readable referral code from a document.cookie string, if valid. */
export function refFromCookies(cookieString: string): string | null {
  for (const part of cookieString.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === REF_VIEW_COOKIE) {
      const value = decodeURIComponent(rest.join("="));
      return REF_PATTERN.test(value) ? value.toUpperCase() : null;
    }
  }
  return null;
}

/**
 * The address with ?ref=<code> added, or null when it should stay as it is (it already has a
 * ref, the page is a portal/account page, or there is no code).
 */
export function withRef(href: string, code: string | null): string | null {
  if (!code) return null;
  const url = new URL(href);
  if (!keepsRefInUrl(url.pathname) || url.searchParams.has("ref")) return null;
  url.searchParams.set("ref", code);
  return `${url.pathname}${url.search}${url.hash}`;
}
