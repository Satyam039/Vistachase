// Dashboard numbers. All of them are counted from this site's own pages, keywords and audits; search
// performance appears only through a connected provider (search-console.ts).

import type { SeoIssueSeverity } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { listClusters } from "@/modules/seo/seo.keywords";
import { liveOf } from "@/modules/seo/seo.pages";
import { SEVERITY_WEIGHT } from "@/modules/seo/seo.audit";
import { integrationStatus } from "@/modules/seo/search-console";

export async function overview() {
  const [pages, keywords, openIssues, runs, clusters, integrations, redirects] = await Promise.all([
    prisma.seoPage.findMany({ include: { _count: { select: { mappings: true } } } }),
    prisma.seoKeyword.findMany({ where: { archivedAt: null }, select: { track: true, validationStatus: true, volumeBasis: true, targetPath: true, priority: true, mappings: { select: { role: true, pageId: true } } } }),
    prisma.seoIssue.findMany({ where: { status: "OPEN" }, include: { page: { select: { important: true, label: true } } } }),
    prisma.seoAuditRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
    listClusters(),
    integrationStatus(),
    prisma.seoRedirect.count({ where: { active: true } }),
  ]);

  const status = { PUBLISHED: 0, DRAFT: 0, SCHEDULED: 0, ARCHIVED: 0 };
  const missing = { title: 0, description: 0, h1: 0, canonical: 0, focusKeyword: 0 };
  let noindex = 0;
  let neverCrawled = 0;
  for (const p of pages) {
    status[p.status]++;
    const live = liveOf(p);
    if (!p.lastCrawledAt) neverCrawled++;
    if (!p.robotsIndex || /noindex/i.test(live?.robots ?? "")) noindex++;
    if (p.status === "ARCHIVED") continue;
    if (!(p.seoTitle ?? live?.title)) missing.title++;
    if (!(p.metaDescription ?? live?.description)) missing.description++;
    if (!(p.h1 ?? live?.h1?.[0])) missing.h1++;
    if (!(p.canonicalUrl ?? live?.canonical)) missing.canonical++;
    if (!p.focusKeyword && p.pageType !== "LEGAL" && p.pageType !== "STATIC") missing.focusKeyword++;
  }

  const issueCount = (types: string[]) => openIssues.filter((i) => types.includes(i.type)).length;
  const bySeverity: Record<SeoIssueSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const i of openIssues) bySeverity[i.severity]++;

  const primaryCount = new Map<string, number>();
  const fixes = openIssues
    .map((i) => ({
      id: i.id,
      type: i.type,
      severity: i.severity,
      path: i.path,
      pageId: i.pageId,
      pageLabel: i.page?.label ?? null,
      message: i.message,
      score: SEVERITY_WEIGHT[i.severity] * (i.page?.important ? 2 : 1),
      firstSeenAt: i.firstSeenAt,
    }))
    .sort((a, b) => b.score - a.score || a.firstSeenAt.getTime() - b.firstSeenAt.getTime())
    .slice(0, 15);

  let mapped = 0;
  let cannibalised = 0;
  for (const k of keywords) {
    if (k.mappings.length > 0) mapped++;
    const primaries = k.mappings.filter((m) => m.role === "PRIMARY").length;
    if (primaries > 1) cannibalised++;
    primaryCount.set(String(primaries), (primaryCount.get(String(primaries)) ?? 0) + 1);
  }

  return {
    pages: {
      total: pages.length,
      status,
      noindex,
      neverCrawled,
      byType: pages.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.pageType]: (acc[p.pageType] ?? 0) + 1 }), {}),
      missing,
    },
    duplicates: {
      titles: issueCount(["DUPLICATE_TITLE"]),
      descriptions: issueCount(["DUPLICATE_DESCRIPTION"]),
      canonicals: issueCount(["DUPLICATE_CANONICAL"]),
      slugs: issueCount(["DUPLICATE_SLUG"]),
    },
    links: {
      broken: issueCount(["BROKEN_INTERNAL_LINK"]),
      redirectIssues: issueCount(["REDIRECT_LOOP", "REDIRECT_CHAIN", "REDIRECT_TARGET_BROKEN", "INTERNAL_LINK_REDIRECT", "PAGE_REDIRECTS"]),
      activeRedirects: redirects,
    },
    keywords: {
      total: keywords.length,
      traffic: keywords.filter((k) => k.track === "TRAFFIC_ACQUISITION").length,
      booking: keywords.filter((k) => k.track === "BOOKING_CONVERSION").length,
      mapped,
      plannedOnly: keywords.filter((k) => k.mappings.length === 0 && k.targetPath).length,
      unmapped: keywords.filter((k) => k.mappings.length === 0 && !k.targetPath).length,
      cannibalised,
      verified: keywords.filter((k) => k.validationStatus === "VERIFIED").length,
      unverified: keywords.filter((k) => k.validationStatus === "UNVERIFIED").length,
      metricsUnknown: keywords.filter((k) => k.volumeBasis === "UNKNOWN").length,
      intentMismatches: issueCount(["KEYWORD_INTENT_MISMATCH"]),
    },
    clusters,
    issues: { open: openIssues.length, bySeverity, fixes },
    audits: runs.map((r) => ({ id: r.id, trigger: r.trigger, status: r.status, startedAt: r.startedAt, finishedAt: r.finishedAt, summary: r.summary, error: r.error })),
    integrations,
    dataNote: "Every figure here is calculated from Vista Chase's own pages, keywords and audits. No ranking, traffic, search volume or backlink data is shown unless a provider is connected.",
  };
}
