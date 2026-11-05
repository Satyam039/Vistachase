// The site's three distinct portal areas, each with its own routes, access rules, and logins:
//
//   admin      /admin                 ADMIN, OPERATOR, DISPATCHER (dedicated /admin/login)
//   affiliate  /affiliate             AFFILIATE (dedicated /affiliate/login, referrals, payouts)
//   seo        /seo                   SEO_MANAGER, EDITOR, VIEWER, plus ADMIN (/seo/login)
//   customer   / (public + /account)  CUSTOMER (dedicated /login, /register, /account/trips)
//
// The middleware enforces portal isolation before the page is drawn.
// The backend API checks the role on every call as well (backend/src/lib/auth/permissions.ts).

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
  if (portal === "partner") return "/affiliate/dashboard";
  return "/account/trips";
}

/** Admin pages operators and dispatchers can't open. */
export const ADMIN_ONLY_PATHS = ["/admin/partners", "/admin/affiliates", "/admin/staff", "/admin/roles", "/admin/audit"];

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** The area a path belongs to, or null for public pages (and the areas' own sign-in pages). */
export function areaOf(path: string): Portal | null {
  if (under(path, "/admin")) {
    return under(path, "/admin/login") ? null : "admin";
  }
  if (under(path, "/seo")) {
    return under(path, "/seo/login") ? null : "seo";
  }
  if (under(path, "/affiliate")) {
    if (path === "/affiliate" || under(path, "/affiliate/login") || under(path, "/affiliate/register")) {
      return null;
    }
    return "partner";
  }
  if (under(path, "/partners/dashboard")) return "partner";
  if (under(path, "/account")) return "customer";
  return null;
}

/** Whether a role may open a path. Public pages are open to everyone. */
export function mayOpen(role: string | undefined | null, path: string): boolean {
  const area = areaOf(path);
  if (!area) return true;
  if (area === "seo" && role === "ADMIN") return true;
  if (area === "partner" && role === "ADMIN") return true;
  if (area === "customer") {
    // Only customer accounts may access customer account management; staff and affiliates go to their portals
    return role === "CUSTOMER";
  }
  if (portalFor(role) !== area) return false;
  if (area === "admin" && role !== "ADMIN") return !ADMIN_ONLY_PATHS.some((p) => under(path, p));
  return true;
}

/** Where a signed-out visitor signs in for an area (each portal has its own sign-in page). */
export function signInFor(area: Portal): string {
  if (area === "admin") return "/admin/login";
  if (area === "partner") return "/affiliate/login";
  if (area === "seo") return "/seo/login";
  return "/login";
}

/** A same-site path from ?next= that the role may open, or null. */
export function safeNextFor(role: string | undefined | null, next: string | null): string | null {
  if (!next || !/^\/[A-Za-z0-9/_-]*$/.test(next) || next.startsWith("//")) return null;
  return mayOpen(role, next) ? next : null;
}
