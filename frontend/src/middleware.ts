import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { areaOf, homeForRole, mayOpen, signInFor } from "@/lib/portals";
import { REF_COOKIE, REF_MAX_AGE_SECONDS, REF_PATTERN, REF_VIEW_COOKIE } from "@/lib/referral";

// Partner referrals: any page opened with ?ref=<code> stores the code for 30 days. Bookings
// made in that time are credited to the partner (the backend reads the vc_ref cookie and only
// credits ACTIVE partners). A later partner link replaces an earlier one (last click wins).
// The code also stays in the address bar while the guest browses (see lib/referral.ts).
// The landing is also reported to the API as a click for the partner's stats; clicks never earn.
const REF = REF_PATTERN;
const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/$/, "");

function reportClick(request: NextRequest, code: string) {
  // nginx appends the visitor's address last; the API trusts one proxy hop, so pass only that.
  const ip = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  return fetch(`${BACKEND_URL}/api/affiliates/click`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": request.headers.get("user-agent") ?? "",
      ...(ip ? { "X-Forwarded-For": ip } : {}),
    },
    body: JSON.stringify({ code, path: request.nextUrl.pathname.slice(0, 300) }),
    signal: AbortSignal.timeout(2000),
  }).catch(() => undefined); // stats only: never delay or break the page
}

// SEO redirects managed under Admin → SEO → Redirects (old URL → new URL). The map is fetched from
// the API at most once a minute and refreshed in the background; if the API is slow or down, pages
// load as normal (fail open). The backend refuses loops, off-site targets and app paths.
type RedirectMap = Record<string, [to: string, status: number]>;
const REDIRECT_TTL_MS = 60_000;
let redirectCache: { map: RedirectMap; at: number } | null = null;
let redirectLoad: Promise<void> | null = null;

function loadRedirects(): Promise<void> {
  redirectLoad ??= fetch(`${BACKEND_URL}/api/seo/public/redirects`, { signal: AbortSignal.timeout(1500) })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((body: { redirects?: RedirectMap }) => {
      redirectCache = { map: body.redirects ?? {}, at: Date.now() };
    })
    .catch(() => {
      // Keep serving the last map; try again after the next TTL.
      redirectCache = { map: redirectCache?.map ?? {}, at: Date.now() };
    })
    .finally(() => {
      redirectLoad = null;
    });
  return redirectLoad;
}

async function findRedirect(pathname: string, event: NextFetchEvent) {
  if (!redirectCache) await loadRedirects();
  else if (Date.now() - redirectCache.at > REDIRECT_TTL_MS) event.waitUntil(loadRedirects());
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  // A mixed-case old address (/Winter-Special) goes straight to the final page, not via the
  // lower-case address first (one hop instead of a chain).
  return redirectCache?.map[path] ?? (CASE_SENSITIVE.test(path) ? null : redirectCache?.map[path.toLowerCase()]) ?? null;
}

// Admin (/admin), SEO (/seo) and partner (/partners/dashboard) pages are only drawn for their own
// roles (src/lib/portals.ts). The role is asked of the API, which reads it from the database, so a
// role change applies on the next page. Signed-out visitors go to that area's sign-in page and
// other roles to their own area. If the API can't be reached the page loads and its own API calls
// are refused, as before.
async function sessionRole(request: NextRequest): Promise<string | null | undefined> {
  const token = request.cookies.get("vc_token")?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Cookie: `vc_token=${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { user?: { role?: string } | null };
    return body.user?.role ?? null;
  } catch {
    return undefined;
  }
}

async function portalGate(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Legacy partner route aliases preserved for backwards compatibility
  if (path === "/partners/login") {
    const target = request.nextUrl.clone();
    target.pathname = "/affiliate/login";
    return NextResponse.redirect(target, 301);
  }
  if (path === "/partners/dashboard") {
    const target = request.nextUrl.clone();
    target.pathname = "/affiliate/dashboard";
    return NextResponse.redirect(target, 301);
  }

  const area = areaOf(path);
  if (!area) return null;
  const role = await sessionRole(request);
  if (role === undefined || mayOpen(role, path)) return null;
  const target = request.nextUrl.clone();
  target.search = "";
  if (role === null) {
    target.pathname = signInFor(area);
    target.searchParams.set("next", path);
  } else {
    target.pathname = homeForRole(role);
  }
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

// Webflow served mixed-case addresses (/About-Us), and old links with capitals must still land:
// public pages answer one permanent redirect to the lower-case address. Areas whose addresses
// carry case-sensitive codes (booking references, tracking and review links) are left alone.
const CASE_SENSITIVE = /^\/(booking|review|track|account|admin|seo|affiliate|partners|book|verify-email|reset-password)(\/|$)/i;

function lowerCaseRedirect(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const lower = path.toLowerCase();
  if (lower === path || CASE_SENSITIVE.test(path)) return null;
  const target = request.nextUrl.clone();
  target.pathname = lower; // the query string (utm, ref) is kept
  return NextResponse.redirect(target, 301);
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const gate = await portalGate(request);
  if (gate) return gate;

  const redirect = await findRedirect(request.nextUrl.pathname, event);
  if (redirect && redirect[0].startsWith("/") && !redirect[0].startsWith("//")) {
    const target = request.nextUrl.clone();
    target.pathname = redirect[0]; // the query string (utm, ref) is kept
    return NextResponse.redirect(target, redirect[1]);
  }

  // After the saved redirects, so a redirect saved for a mixed-case old address still wins.
  const lower = lowerCaseRedirect(request);
  if (lower) return lower;

  const ref = request.nextUrl.searchParams.get("ref");
  const response = NextResponse.next();
  if (ref && REF.test(ref)) {
    const code = ref.toUpperCase();
    const cookie = {
      maxAge: REF_MAX_AGE_SECONDS,
      sameSite: "lax" as const,
      // Browsers drop Secure cookies on plain HTTP, so match the scheme the visitor used.
      secure: (request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || request.nextUrl.protocol.replace(":", "")) === "https",
      path: "/",
    };
    // The site keeps ?ref=<code> in the address while the guest browses (ReferralLinkKeeper), so
    // the same code arrives again on every reload or shared page. That is not a new click: it must
    // not restart the 30-day window or count again in the partner's stats.
    const same = request.cookies.get(REF_COOKIE)?.value === code;
    if (!same) {
      response.cookies.set(REF_COOKIE, code, { ...cookie, httpOnly: true });
      event.waitUntil(reportClick(request, code));
    }
    if (!same || request.cookies.get(REF_VIEW_COOKIE)?.value !== code) {
      // Readable copy, used only to keep the code in the address bar (never trusted for credit).
      response.cookies.set(REF_VIEW_COOKIE, code, { ...cookie, httpOnly: false });
    }
  }
  return response;
}

export const config = {
  // Pages only: skip Next internals, the API and media proxies, and files.
  matcher: ["/((?!_next/|api/|media/|favicon.ico|.*\\..*).*)"],
};
