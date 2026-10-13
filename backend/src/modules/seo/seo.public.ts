// What the public site reads: published metadata overrides for one path, published guides, the
// sitemap entries, redirects and llms.txt. Only published, public fields leave this file; audit
// results, drafts, notes and keyword research never do.

import prisma from "@/lib/db/prisma";
import { normalizePath } from "@/modules/seo/paths";
import { activeRedirectMap } from "@/modules/seo/seo.redirects";
import { GUIDE_PREFIX, NON_INDEXABLE_PATHS, STATIC_ROUTES } from "@/modules/seo/static-routes";

const PUBLIC_FIELDS = {
  path: true,
  pageType: true,
  seoTitle: true,
  metaDescription: true,
  h1: true,
  canonicalUrl: true,
  robotsIndex: true,
  robotsFollow: true,
  ogTitle: true,
  ogDescription: true,
  ogImage: true,
  twitterTitle: true,
  twitterDescription: true,
  twitterImage: true,
  breadcrumbLabel: true,
  featuredImage: true,
  featuredImageAlt: true,
  updatedAt: true,
} as const;

/** Overrides for one path, or null when the path has no published SEO row. */
export async function publicMeta(rawPath: string) {
  const path = normalizePath(rawPath);
  if (!path) return null;
  return prisma.seoPage.findFirst({ where: { path, status: "PUBLISHED" }, select: PUBLIC_FIELDS });
}

/** A published guide with its content, for /guides/<slug>. */
export async function publicGuide(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const page = await prisma.seoPage.findFirst({
    where: { path: `${GUIDE_PREFIX}${slug}`, source: "CMS", status: "PUBLISHED" },
    select: {
      ...PUBLIC_FIELDS,
      label: true,
      excerpt: true,
      body: true,
      answerSnippet: true,
      citationFact: true,
      faqs: true,
      authorName: true,
      authorBio: true,
      reviewedAt: true,
      publishedAt: true,
      imageTitle: true,
      imageCaption: true,
      ctaText: true,
      ctaUrl: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      relatedPaths: true,
      tags: true,
      pillar: true,
    },
  });
  if (!page) return null;
  // Related links: only pages that are published here or are known site routes.
  const related = await prisma.seoPage.findMany({ where: { path: { in: page.relatedPaths }, status: "PUBLISHED" }, select: { path: true, label: true, seoTitle: true } });
  return { ...page, related: related.map((r) => ({ path: r.path, label: r.label })) };
}

export async function publicGuides() {
  return prisma.seoPage.findMany({
    where: { source: "CMS", status: "PUBLISHED", robotsIndex: true },
    select: { path: true, label: true, excerpt: true, featuredImage: true, featuredImageAlt: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });
}

export interface SitemapEntry {
  path: string;
  lastModified: string;
  priority: number | null;
}

/**
 * Published, indexable pages whose canonical is themselves. Code routes, tours and destinations
 * that have no SEO row yet are included with their defaults; redirect sources and sign-in,
 * checkout and search pages never are.
 */
export async function sitemapEntries(): Promise<SitemapEntry[]> {
  const [pages, tours, destinations, redirects] = await Promise.all([
    prisma.seoPage.findMany({ select: { path: true, status: true, robotsIndex: true, canonicalUrl: true, lastCrawl: true, sitemapPriority: true, updatedAt: true, tour: { select: { updatedAt: true } } } }),
    prisma.tour.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.destination.findMany({ select: { slug: true, createdAt: true } }),
    activeRedirectMap(),
  ]);
  const excluded = new Set([...NON_INDEXABLE_PATHS, ...Object.keys(redirects)]);
  const byPath = new Map(pages.map((p) => [p.path, p]));
  const out = new Map<string, SitemapEntry>();

  const add = (path: string, lastModified: Date, priority: number | null) => {
    if (excluded.has(path)) return;
    const row = byPath.get(path);
    if (row) {
      if (row.status !== "PUBLISHED" || !row.robotsIndex) return;
      if (row.canonicalUrl) {
        const target = row.canonicalUrl.startsWith("/") ? row.canonicalUrl : (() => { try { return new URL(row.canonicalUrl).pathname.replace(/\/$/, "") || "/"; } catch { return null; } })();
        if (target !== path) return;
      }
      // The live page itself says noindex (set in code): respect it.
      const robots = (row.lastCrawl as { robots?: string } | null)?.robots;
      if (robots && /noindex/i.test(robots)) return;
      const updated = [row.updatedAt, row.tour?.updatedAt, lastModified].filter(Boolean) as Date[];
      out.set(path, { path, lastModified: new Date(Math.max(...updated.map((d) => d.getTime()))).toISOString(), priority: row.sitemapPriority ?? priority });
      return;
    }
    out.set(path, { path, lastModified: lastModified.toISOString(), priority });
  };

  const now = new Date();
  for (const r of STATIC_ROUTES) if (r.indexable) add(r.path, now, r.sitemapPriority ?? null);
  for (const t of tours) add(`/${t.slug}`, t.updatedAt, 0.8);
  for (const d of destinations) add(`/destinations/${d.slug}`, d.createdAt, 0.6);
  for (const p of pages) if (p.path.startsWith(GUIDE_PREFIX)) add(p.path, p.updatedAt, 0.5);
  return [...out.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.path.localeCompare(b.path));
}

export { activeRedirectMap };

// ---------------------------------------------------------------------------------------------
// llms.txt

/** The llms.txt file, or null while it is switched off. Links are absolute on `origin`. */
export async function llmsTxt(origin: string): Promise<string | null> {
  const settings = await prisma.seoSiteSettings.findUnique({ where: { id: "site" } });
  if (!settings?.llmsEnabled) return null;
  const entries = await prisma.seoLlmsEntry.findMany({ orderBy: [{ section: "asc" }, { sortOrder: "asc" }] });
  const abs = (p: string) => (p.startsWith("/") ? `${origin}${p}` : p);
  // Markdown-safe single line: no newlines, no link-breaking brackets.
  const line = (s: string | null | undefined) => (s ?? "").replace(/[\r\n]+/g, " ").replace(/[[\]]/g, "").trim();
  const list = (section: "PRIMARY" | "SECONDARY") =>
    entries
      .filter((e) => e.section === section)
      .map((e) => `- [${line(e.title)}](${abs(e.path)})${e.description ? `: ${line(e.description)}` : ""}`)
      .join("\n");

  const parts = [`# ${line(settings.siteName)}`];
  if (settings.summary) parts.push(`> ${line(settings.summary)}`);
  if (settings.aboutText) parts.push(settings.aboutText.replace(/\r/g, "").trim());
  const primary = list("PRIMARY");
  if (primary) parts.push(`## Key pages\n\n${primary}`);
  const contact = [
    settings.contactEmail && `- Email: ${line(settings.contactEmail)}`,
    settings.contactPhone && `- Phone: ${line(settings.contactPhone)}`,
    settings.address && `- Address: ${line(settings.address)}`,
    settings.serviceArea.length > 0 && `- Service area: ${settings.serviceArea.map(line).join(", ")}`,
    settings.businessHours && `- Hours: ${line(settings.businessHours)}`,
    settings.googleBusinessUrl && `- Google Business Profile: ${settings.googleBusinessUrl}`,
  ].filter(Boolean);
  if (contact.length > 0) parts.push(`## Contact\n\n${contact.join("\n")}`);
  const secondary = list("SECONDARY");
  if (secondary) parts.push(`## Optional\n\n${secondary}`);
  parts.push(`Last updated: ${settings.updatedAt.toISOString().slice(0, 10)}`);
  return `${parts.join("\n\n")}\n`;
}
