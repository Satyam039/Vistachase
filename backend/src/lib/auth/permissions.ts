// Who may do what in the content and SEO workspaces. The routes check these on every request
// (the role is read from the database by getAuthenticatedStaff), so hiding a button is never
// the only protection. None of these roles reaches bookings, payments, customers, partners or
// commissions: those routes keep their own ADMIN / OPERATOR / DISPATCHER lists.
//
//   SEO_MANAGER  keyword research, keyword mapping, page metadata, publishing, redirects, audits,
//                llms.txt and business info, plus tour and destination copy
//   EDITOR       tour and destination copy, and the content fields of SEO pages and guides
//                (not robots, canonical, slugs, publishing, keywords, redirects or settings)
//   VIEWER       read-only
//   ADMIN        everything, including staff accounts

import type { UserRole } from "@/lib/auth/auth";

export const SEO_READ: UserRole[] = ["ADMIN", "SEO_MANAGER", "EDITOR", "VIEWER"];
export const SEO_MANAGE: UserRole[] = ["ADMIN", "SEO_MANAGER"];
export const SEO_CONTENT: UserRole[] = ["ADMIN", "SEO_MANAGER", "EDITOR"];

export const CONTENT_READ: UserRole[] = ["ADMIN", "SEO_MANAGER", "EDITOR", "VIEWER"];
export const CONTENT_WRITE: UserRole[] = ["ADMIN", "SEO_MANAGER", "EDITOR"];

/** Roles an admin can give from the Staff screen. CUSTOMER removes staff access. */
export const ASSIGNABLE_ROLES = ["ADMIN", "OPERATOR", "DISPATCHER", "SEO_MANAGER", "EDITOR", "VIEWER"] as const;
export const STAFF_LIST_ROLES: UserRole[] = [...ASSIGNABLE_ROLES];

/** SEO page fields an EDITOR may change: words and images, not indexing or URLs. */
export const EDITOR_PAGE_FIELDS = new Set([
  "h1",
  "breadcrumbLabel",
  "excerpt",
  "body",
  "answerSnippet",
  "citationFact",
  "faqs",
  "authorName",
  "authorBio",
  "reviewedAt",
  "featuredImage",
  "featuredImageAlt",
  "imageTitle",
  "imageCaption",
  "ctaText",
]);

export const can = (role: UserRole, roles: UserRole[]) => role === "ADMIN" || roles.includes(role);

/** What the signed-in person may do, for the dashboards to show or hide controls. */
export function capabilities(role: UserRole) {
  return {
    role,
    seo: { read: can(role, SEO_READ), manage: can(role, SEO_MANAGE), editContent: can(role, SEO_CONTENT) },
    content: { read: can(role, CONTENT_READ), write: can(role, CONTENT_WRITE) },
    operations: can(role, ["OPERATOR", "DISPATCHER"]),
    staff: role === "ADMIN",
  };
}
