// The site's three staff areas, each at its own address and only for its own roles:
//
//   admin    /admin               ADMIN, OPERATOR, DISPATCHER (bookings, departures, dispatch;
//                                 partners, staff and the audit log are ADMIN only)
//   seo      /seo                 SEO_MANAGER, EDITOR, VIEWER, plus ADMIN (SEO and page copy)
//   partner  /partners/dashboard  AFFILIATE (their own referrals, commissions and payouts)
//
// The middleware sends anyone who opens another area to their own, before the page is drawn.
// The API checks the role on every call as well (backend/src/lib/auth/permissions.ts).

export type Portal = "admin" | "seo" | "partner" | "customer";

export function portalFor(role: string | undefined | null): Portal {
  if (role === "ADMIN" || role === "OPERATOR" || role === "DISPATCHER") return "admin";
  if (role === "SEO_MANAGER" || role === "EDITOR" || role === "VIEWER") return "seo";
  if (role === "AFFILIATE") return "partner";
  return "customer";
}

/** Where each role lands after signing in, and where it's sent from an area it can't open. */
export function homeForRole(role: string | undefined | null): string {
  const portal = portalFor(role);
  if (portal === "admin") return "/admin";
  if (portal === "seo") return role === "EDITOR" ? "/seo/content" : "/seo";
  if (portal === "partner") return "/partners/dashboard";
  return "/account/trips";
}

/** Admin pages operators and dispatchers can't open. */
export const ADMIN_ONLY_PATHS = ["/admin/partners", "/admin/staff", "/admin/audit"];

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** The area a path belongs to, or null for public pages (and the areas' own sign-in pages). */
export function areaOf(path: string): Exclude<Portal, "customer"> | null {
  if (under(path, "/admin")) return "admin";
  if (under(path, "/seo")) return under(path, "/seo/login") ? null : "seo";
  if (under(path, "/partners/dashboard")) return "partner";
  return null;
}

/** Whether a role may open a path. Public pages are open to everyone. */
export function mayOpen(role: string | undefined | null, path: string): boolean {
  const area = areaOf(path);
  if (!area) return true;
  if (area === "seo" && role === "ADMIN") return true;
  if (portalFor(role) !== area) return false;
  if (area === "admin" && role !== "ADMIN") return !ADMIN_ONLY_PATHS.some((p) => under(path, p));
  return true;
}

/** Where a signed-out visitor signs in for an area. */
export function signInFor(area: Exclude<Portal, "customer">): string {
  if (area === "seo") return "/seo/login";
  if (area === "partner") return "/partners/login";
  return "/login";
}

/** A same-site path from ?next= that the role may open, or null. */
export function safeNextFor(role: string | undefined | null, next: string | null): string | null {
  if (!next || !/^\/[A-Za-z0-9/_-]*$/.test(next) || next.startsWith("//")) return null;
  return areaOf(next) && mayOpen(role, next) ? next : null;
}
