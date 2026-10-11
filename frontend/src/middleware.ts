import { NextResponse, type NextRequest } from "next/server";

// Partner referrals: any page opened with ?ref=<code> stores the code for 30 days. Bookings
// made in that time are credited to the partner (the backend reads the vc_ref cookie and only
// credits ACTIVE partners). A later partner link replaces an earlier one (last click wins).
const REF = /^[A-Za-z0-9]{3,24}$/;

export function middleware(request: NextRequest) {
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
  }
  return response;
}

export const config = {
  // Pages only: skip Next internals, the API and media proxies, and files.
  matcher: ["/((?!_next/|api/|media/|favicon.ico|.*\\..*).*)"],
};
