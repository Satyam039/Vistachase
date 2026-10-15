// What the public site reads: published metadata overrides for one path, published guides, the
// sitemap entries, redirects and llms.txt. Only published, public fields leave this file; audit
// results, drafts, notes and keyword research never do.

import prisma from "@/lib/db/prisma";
import { normalizePath } from "@/modules/seo/paths";
import { activeRedirectMap } from "@/modules/seo/seo.redirects";
import { publishedPageSchema } from "@/modules/seo/portal/schema";
import { BLOG_PREFIX, GUIDE_PREFIX, NON_INDEXABLE_PATHS, STATIC_ROUTES, type CmsPrefix } from "@/modules/seo/static-routes";

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

/** A published guide (/guides/<slug>) or blog post (/blog-post/<slug>) with its content. */
export async function publicGuide(slug: string, prefix: CmsPrefix = GUIDE_PREFIX) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const page = await prisma.seoPage.findFirst({
    where: { path: `${prefix}${slug}`, source: "CMS", status: "PUBLISHED" },
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
      datePublished: true,
      dateModified: true,
      thumbnailImage: true,
      thumbnailAlt: true,
      id: true,
    },
  });
  if (!page) return null;
  const { id, ...content } = page;
  // Extra JSON-LD published for this page in the SEO portal (validated there).
  const schema = await publishedPageSchema(id);
  // Related links: only pages that are published here or are known site routes.
  const related = await prisma.seoPage.findMany({ where: { path: { in: page.relatedPaths }, status: "PUBLISHED" }, select: { path: true, label: true, seoTitle: true } });
  return { ...content, schema, related: related.map((r) => ({ path: r.path, label: r.label })) };
}

export async function publicGuides() {
  return prisma.seoPage.findMany({
    where: { source: "CMS", status: "PUBLISHED", robotsIndex: true, path: { startsWith: GUIDE_PREFIX } },
    select: { path: true, label: true, excerpt: true, featuredImage: true, featuredImageAlt: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });
}

/** Published blog posts for /blog: featured first, then newest (original Webflow dates when known). */
export async function publicBlogPosts() {
  const posts = await prisma.seoPage.findMany({
    where: { source: "CMS", status: "PUBLISHED", path: { startsWith: BLOG_PREFIX } },
    select: { path: true, label: true, excerpt: true, featuredImage: true, featuredImageAlt: true, thumbnailImage: true, thumbnailAlt: true, featured: true, publishedAt: true, datePublished: true, robotsIndex: true },
  });
  const date = (p: (typeof posts)[number]) => (p.datePublished ?? p.publishedAt ?? new Date(0)).getTime();
  return posts
    .sort((a, b) => Number(b.featured) - Number(a.featured) || date(b) - date(a))
    .map(({ robotsIndex: _r, ...p }) => ({ ...p, datePublished: p.datePublished ?? p.publishedAt }));
}

const VERIFICATION = /^[A-Za-z0-9_-]{10,100}$/;
const GTAG_ID = { ga4: /^G-[A-Z0-9]{4,20}$/, ads: /^AW-\d{6,15}$/ };

/**
 * Site-wide settings the public layout reads: the site verification meta, the Google tag, the
 * published site-wide JSON-LD and crawler rules. Everything is off or empty until staff set it
 * (tracking and verification only after an admin approves), so by default nothing changes.
 */
export async function publicSiteConfig() {
  const [settings, blocks] = await Promise.all([
    prisma.seoSiteSettings.findUnique({ where: { id: "site" }, select: { googleSiteVerification: true, tracking: true, crawlerRules: true } }),
    prisma.seoSchemaBlock.findMany({ where: { scope: "SITE", status: "PUBLISHED" }, select: { json: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const t = (settings?.tracking ?? {}) as { enabled?: boolean; ga4Id?: string; adsId?: string; consentDefault?: string };
  const tracking =
    t.enabled && (GTAG_ID.ga4.test(t.ga4Id ?? "") || GTAG_ID.ads.test(t.adsId ?? ""))
      ? {
          ga4Id: GTAG_ID.ga4.test(t.ga4Id ?? "") ? t.ga4Id! : null,
          adsId: GTAG_ID.ads.test(t.adsId ?? "") ? t.adsId! : null,
          consentDefault: t.consentDefault === "denied" ? "denied" : null,
        }
      : null;
  const verification = settings?.googleSiteVerification && VERIFICATION.test(settings.googleSiteVerification) ? settings.googleSiteVerification : null;
  return {
    verification,
    tracking,
    siteSchema: blocks.map((b) => b.json).filter((j) => j && typeof j === "object"),
    crawlerRules: blockedCrawlers(settings?.crawlerRules),
  };
}

/** User agents set to "block" (everything else stays allowed, as today). */
export function blockedCrawlers(rules: unknown): string[] {
  if (!rules || typeof rules !== "object") return [];
  return Object.entries(rules as Record<string, unknown>)
    .filter(([agent, v]) => v === "block" && /^[A-Za-z0-9_.-]{2,40}$/.test(agent))
    .map(([agent]) => agent);
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
    prisma.seoPage.findMany({ select: { path: true, status: true, robotsIndex: true, sitemapInclude: true, canonicalUrl: true, lastCrawl: true, sitemapPriority: true, updatedAt: true, dateModified: true, tour: { select: { updatedAt: true } } } }),
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
      if (row.status !== "PUBLISHED" || !row.robotsIndex || !row.sitemapInclude) return;
      if (row.canonicalUrl) {
        const target = row.canonicalUrl.startsWith("/") ? row.canonicalUrl : (() => { try { return new URL(row.canonicalUrl).pathname.replace(/\/$/, "") || "/"; } catch { return null; } })();
        if (target !== path) return;
      }
      // The live page itself says noindex (set in code): respect it.
      const robots = (row.lastCrawl as { robots?: string } | null)?.robots;
      if (robots && /noindex/i.test(robots)) return;
      // Blog posts: the content's own modified date (kept from Webflow), not the row's.
      const updated = (row.dateModified ? [row.dateModified] : [row.updatedAt, row.tour?.updatedAt, lastModified]).filter(Boolean) as Date[];
      out.set(path, { path, lastModified: new Date(Math.max(...updated.map((d) => d.getTime()))).toISOString(), priority: row.sitemapPriority ?? priority });
      return;
    }
    out.set(path, { path, lastModified: lastModified.toISOString(), priority });
  };

  const now = new Date();
  for (const r of STATIC_ROUTES) if (r.indexable) add(r.path, now, r.sitemapPriority ?? null);
  for (const t of tours) add(`/${t.slug}`, t.updatedAt, 0.8);
  for (const d of destinations) add(`/destinations/${d.slug}`, d.createdAt, 0.6);
  for (const p of pages) if (p.path.startsWith(GUIDE_PREFIX) || p.path.startsWith(BLOG_PREFIX)) add(p.path, p.dateModified ?? p.updatedAt, 0.5);
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
