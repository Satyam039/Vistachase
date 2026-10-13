import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

// Partner referrals: any page opened with ?ref=<code> stores the code for 30 days. Bookings
// made in that time are credited to the partner (the backend reads the vc_ref cookie and only
// credits ACTIVE partners). A later partner link replaces an earlier one (last click wins).
// The landing is also reported to the API as a click for the partner's stats; clicks never earn.
const REF = /^[A-Za-z0-9]{3,24}$/;
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
  return redirectCache?.map[path] ?? null;
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const redirect = await findRedirect(request.nextUrl.pathname, event);
  if (redirect && redirect[0].startsWith("/") && !redirect[0].startsWith("//")) {
    const target = request.nextUrl.clone();
    target.pathname = redirect[0]; // the query string (utm, ref) is kept
    return NextResponse.redirect(target, redirect[1]);
  }

  const ref = request.nextUrl.searchParams.get("ref");
  const response = NextResponse.next();
  if (ref && REF.test(ref)) {
    response.cookies.set("vc_ref", ref.toUpperCase(), {
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      // Browsers drop Secure cookies on plain HTTP, so match the scheme the visitor used.
      secure: (request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || request.nextUrl.protocol.replace(":", "")) === "https",
      httpOnly: true,
      path: "/",
    });
    event.waitUntil(reportClick(request, ref.toUpperCase()));
  }
  return response;
}

export const config = {
  // Pages only: skip Next internals, the API and media proxies, and files.
  matcher: ["/((?!_next/|api/|media/|favicon.ico|.*\\..*).*)"],
};
