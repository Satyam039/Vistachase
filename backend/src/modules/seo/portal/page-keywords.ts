// Keywords by page: every page and blog post with the keywords it targets, and adding a keyword to
// a page by typing it. A keyword that isn't in the keyword sheet yet is created there (unverified,
// no volume or difficulty, intent and track inferred from the page type) and mapped in one step,
// so the sheet stays the single list. Roles, the "primary of one page only" warning and the change
// log all come from the existing keyword mapping.

import type { SeoPageType } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { normalizeKeyword } from "@/modules/seo/paths";
import { SeoError } from "@/modules/seo/seo.errors";
import { mapKeyword } from "@/modules/seo/seo.keywords";
import { liveOf } from "@/modules/seo/seo.pages";
import { BLOG_PREFIX } from "@/modules/seo/static-routes";

export type PageGroup = "pages" | "tours" | "destinations" | "blog" | "guides";

export function pageGroup(p: { path: string; pageType: SeoPageType }): PageGroup {
  if (p.path.startsWith(BLOG_PREFIX)) return "blog";
  if (p.pageType === "TOUR") return "tours";
  if (p.pageType === "DESTINATION") return "destinations";
  if (p.pageType === "GUIDE") return "guides";
  return "pages";
}

const PAGE_ORDER: Record<string, number> = { HOME: 0, LANDING: 1, STATIC: 2, LEGAL: 3 };

export async function pageKeywords(filter: { q?: string; group?: PageGroup } = {}) {
  const pages = await prisma.seoPage.findMany({
    select: {
      id: true,
      path: true,
      label: true,
      pageType: true,
      status: true,
      focusKeyword: true,
      ogImage: true,
      featuredImage: true,
      featuredImageAlt: true,
      lastCrawl: true,
      mappings: { select: { id: true, role: true, keyword: { select: { id: true, keyword: true, archivedAt: true, searchVolume: true, volumeBasis: true } } } },
    },
  });
  const term = filter.q?.trim().toLowerCase();
  const rows = pages
    .map((p) => ({
      id: p.id,
      path: p.path,
      label: p.label,
      pageType: p.pageType,
      status: p.status,
      group: pageGroup(p),
      focusKeyword: p.focusKeyword,
      ogImage: p.ogImage,
      featuredImage: p.featuredImage,
      featuredImageAlt: p.featuredImageAlt,
      // What the live page served as og:image at the last audit (the code default when nothing is set here).
      liveOgImage: liveOf(p)?.ogImage ?? null,
      keywords: p.mappings
        .map((m) => ({ mappingId: m.id, role: m.role, id: m.keyword.id, keyword: m.keyword.keyword, archived: m.keyword.archivedAt !== null, searchVolume: m.keyword.volumeBasis === "UNKNOWN" ? null : m.keyword.searchVolume }))
        .sort((a, b) => (a.role === b.role ? a.keyword.localeCompare(b.keyword) : a.role === "PRIMARY" ? -1 : 1)),
    }))
    .filter((p) => (!filter.group || p.group === filter.group) && (!term || `${p.label} ${p.path} ${p.keywords.map((k) => k.keyword).join(" ")}`.toLowerCase().includes(term)))
    .sort((a, b) => (PAGE_ORDER[a.pageType] ?? 9) - (PAGE_ORDER[b.pageType] ?? 9) || a.path.localeCompare(b.path));

  const counts = { pages: 0, tours: 0, destinations: 0, blog: 0, guides: 0 } as Record<PageGroup, number>;
  for (const p of pages) counts[pageGroup(p)]++;
  return { pages: rows, counts, withoutKeywords: pages.filter((p) => p.mappings.length === 0).length };
}

/** What a new keyword typed on a page most likely is, from the kind of page it targets. */
function inferredKind(pageType: SeoPageType) {
  if (pageType === "TOUR" || pageType === "LANDING" || pageType === "HOME") return { intent: "TRANSACTIONAL" as const, funnelStage: "BOFU" as const, track: "BOOKING_CONVERSION" as const };
  return { intent: "INFORMATIONAL" as const, funnelStage: "TOFU" as const, track: "TRAFFIC_ACQUISITION" as const };
}

export async function addPageKeyword(pageId: string, input: { keyword: string; role: "PRIMARY" | "SECONDARY" }, userId: string) {
  const page = await prisma.seoPage.findUnique({ where: { id: pageId }, select: { id: true, path: true, pageType: true } });
  if (!page) throw new SeoError(404, "Page not found.");
  const text = input.keyword.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (text.length < 2) throw new SeoError(400, "Type a keyword of at least 2 characters.");
  const normalized = normalizeKeyword(text);

  let keyword = await prisma.seoKeyword.findUnique({ where: { normalized } });
  let created = false;
  if (keyword?.archivedAt) throw new SeoError(409, `"${keyword.keyword}" is archived in the keyword sheet. Restore it there first.`);
  if (!keyword) {
    keyword = await prisma.$transaction(async (tx) => {
      const k = await tx.seoKeyword.create({
        data: { keyword: text, normalized, ...inferredKind(page.pageType), designation: input.role, status: "PLANNED", notes: `Added on ${page.path} in the SEO portal.`, createdById: userId },
      });
      await tx.auditLog.create({ data: { userId, action: "SEO_KEYWORD_CREATED", entityType: "SeoKeyword", entityId: k.id, details: { keyword: k.keyword, from: page.path } } });
      return k;
    });
    created = true;
  }
  const result = await mapKeyword(keyword.id, page.id, input.role, userId);
  return { created, keyword: result.keyword, warnings: result.warnings };
}
