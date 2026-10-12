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

export function middleware(request: NextRequest, event: NextFetchEvent) {
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
