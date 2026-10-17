// Blog SEO (SEO portal): the posts at /blog-post/<slug> (the Webflow addresses, kept exactly),
// with the checks the handoff asks for: metadata, one H1 and the heading structure, images and alt
// text, internal links (broken, or through a redirect), BlogPosting fields and sitemap inclusion.
// Posts are SeoPage rows (source CMS), so they share the page editor, drafts and publishing.

import prisma from "@/lib/db/prisma";
import { checksFor, liveOf } from "@/modules/seo/seo.pages";
import { activeRedirectMap } from "@/modules/seo/seo.redirects";
import { BLOG_PREFIX, STATIC_ROUTES } from "@/modules/seo/static-routes";
import { bodyImages } from "@/modules/seo/portal/images";
import { isWebflowUrl } from "@/modules/seo/seo.audit";

/** The number of posts in the Webflow Blog Posts collection (handoff, section 6). */
export const HANDOFF_BLOG_POSTS = 84;

export function headingOutline(body: string | null) {
  const lines = (body ?? "").split("\n");
  const levels = lines.map((l) => l.match(/^(#{1,6})\s+/)?.[1].length ?? 0).filter(Boolean);
  const problems: string[] = [];
  if (levels.includes(1)) problems.push("The body has an H1 (# heading); the post name is the page's only H1.");
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) problems.push(`A heading jumps from H${levels[i - 1]} to H${levels[i]}.`);
  return { h2: levels.filter((l) => l === 2).length, h3: levels.filter((l) => l === 3).length, h4: levels.filter((l) => l >= 4).length, problems: [...new Set(problems)] };
}

export function bodyLinks(body: string | null): string[] {
  if (!body) return [];
  return [...body.matchAll(/(?<!!)\[[^\]]+\]\(([^)\s]+)\)/g)].map((m) => m[1]);
}

export type Window = "24h" | "7d" | "30d";
export interface BlogFilter {
  q?: string;
  status?: string;
  problem?: string;
  /** Webflow-style list controls (all optional; without them the full list comes back as before). */
  featured?: "yes" | "no";
  indexing?: "yes" | "no";
  changes?: "draft";
  published?: Window;
  created?: Window;
  modified?: Window;
  sort?: "name" | "published" | "created" | "modified" | "status";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

const WINDOW_MS: Record<Window, number> = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 };
const within = (iso: Date | string | null | undefined, w: Window | undefined, now: number) => !w || (!!iso && now - new Date(iso).getTime() <= WINDOW_MS[w]);

export async function blogOverview(filter: BlogFilter = {}) {
  const [posts, redirects, knownPages, tours, destinations] = await Promise.all([
    prisma.seoPage.findMany({ where: { source: "CMS", path: { startsWith: BLOG_PREFIX } }, orderBy: [{ datePublished: "desc" }, { createdAt: "desc" }], include: { _count: { select: { issues: { where: { status: "OPEN" } }, mappings: true } } } }),
    activeRedirectMap(),
    prisma.seoPage.findMany({ where: { status: "PUBLISHED" }, select: { path: true } }),
    prisma.tour.findMany({ select: { slug: true } }),
    prisma.destination.findMany({ select: { slug: true } }),
  ]);
  const known = new Set([...knownPages.map((p) => p.path), ...STATIC_ROUTES.map((r) => r.path), ...tours.map((t) => `/${t.slug}`), ...destinations.map((d) => `/destinations/${d.slug}`)]);

  const rows = posts.map((p) => {
    const outline = headingOutline(p.body);
    const images = bodyImages(p.body);
    const links = bodyLinks(p.body);
    const internal = links.filter((l) => l.startsWith("/")).map((l) => l.split(/[?#]/)[0].replace(/\/+$/, "") || "/");
    const viaRedirect = internal.filter((l) => redirects[l]);
    const unknown = internal.filter((l) => !redirects[l] && !known.has(l) && !l.startsWith("/media/"));
    const words = (p.body ?? "").split(/\s+/).filter(Boolean).length;
    const checks = checksFor(p);
    const problems: string[] = [];
    if (!p.seoTitle) problems.push("no-title");
    if (!p.metaDescription) problems.push("no-description");
    if (outline.problems.length) problems.push("headings");
    if (images.some((i) => !i.alt.trim()) || (p.featuredImage && !p.featuredImageAlt)) problems.push("alt-text");
    if (!p.featuredImage) problems.push("no-featured-image");
    if ([p.featuredImage, p.thumbnailImage, p.ogImage, ...images.map((i) => i.src)].some((s) => s && isWebflowUrl(s))) problems.push("webflow-images");
    if (viaRedirect.length) problems.push("links-redirect");
    if (unknown.length) problems.push("links-unknown");
    if (!p.datePublished && !p.publishedAt) problems.push("no-date");
    if (!p.sitemapInclude || !p.robotsIndex) problems.push("not-in-sitemap");
    if (p.draft) problems.push("draft-changes");
    const live = liveOf(p);
    const blogPosting = (live?.jsonLd ?? []).some((b) => b.types.includes("BlogPosting"));
    return {
      id: p.id,
      path: p.path,
      slug: p.path.slice(BLOG_PREFIX.length),
      label: p.label,
      status: p.status,
      featured: p.featured,
      featuredImage: p.featuredImage,
      thumbnailImage: p.thumbnailImage,
      ogImage: p.ogImage,
      importSource: p.importSource,
      seoTitle: p.seoTitle,
      metaDescription: p.metaDescription,
      datePublished: p.datePublished ?? p.publishedAt,
      dateModified: p.dateModified ?? p.updatedAt,
      createdAt: p.createdAt,
      indexed: p.robotsIndex && p.sitemapInclude,
      words,
      headings: outline,
      images: images.length,
      imagesMissingAlt: images.filter((i) => !i.alt.trim()).length,
      internalLinks: internal.length,
      linksViaRedirect: viaRedirect,
      linksUnknown: unknown,
      inSitemap: p.status === "PUBLISHED" && p.robotsIndex && p.sitemapInclude,
      blogPosting: live ? blogPosting : null,
      lastCrawledAt: p.lastCrawledAt,
      hasDraft: Boolean(p.draft),
      blocking: checks.filter((c) => c.level === "error").length,
      openIssues: p._count.issues,
      keywords: p._count.mappings,
      problems,
    };
  });

  let list = rows;
  if (filter.q) {
    const q = filter.q.toLowerCase();
    list = list.filter((r) => r.label.toLowerCase().includes(q) || r.slug.includes(q) || (r.seoTitle ?? "").toLowerCase().includes(q));
  }
  if (filter.status) list = list.filter((r) => r.status === filter.status);
  if (filter.problem) list = list.filter((r) => r.problems.includes(filter.problem!));
  if (filter.featured) list = list.filter((r) => r.featured === (filter.featured === "yes"));
  if (filter.indexing) list = list.filter((r) => r.indexed === (filter.indexing === "yes"));
  if (filter.changes === "draft") list = list.filter((r) => r.hasDraft);
  const now = Date.now();
  if (filter.published) list = list.filter((r) => r.status === "PUBLISHED" && within(r.datePublished, filter.published, now));
  if (filter.created) list = list.filter((r) => within(r.createdAt, filter.created, now));
  if (filter.modified) list = list.filter((r) => within(r.dateModified, filter.modified, now));
  if (filter.sort) {
    const key = (r: (typeof rows)[number]): string | number =>
      filter.sort === "name" ? r.label.toLowerCase() : filter.sort === "status" ? r.status : new Date((filter.sort === "published" ? r.datePublished : filter.sort === "created" ? r.createdAt : r.dateModified) ?? 0).getTime();
    const sign = filter.dir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => (key(a) < key(b) ? -sign : key(a) > key(b) ? sign : 0));
  }
  const matching = list.length;
  if (filter.page) {
    const size = filter.pageSize ?? 25;
    list = list.slice((filter.page - 1) * size, filter.page * size);
  }

  const count = (k: string) => rows.filter((r) => r.problems.includes(k)).length;
  return {
    posts: list,
    matching,
    summary: {
      total: rows.length,
      expected: HANDOFF_BLOG_POSTS,
      published: rows.filter((r) => r.status === "PUBLISHED").length,
      drafts: rows.filter((r) => r.status === "DRAFT").length,
      scheduled: rows.filter((r) => r.status === "SCHEDULED").length,
      imported: rows.filter((r) => r.importSource).length,
      featured: rows.filter((r) => r.featured).length,
      noTitle: count("no-title"),
      noDescription: count("no-description"),
      headingProblems: count("headings"),
      altText: count("alt-text"),
      webflowImages: count("webflow-images"),
      linksViaRedirect: count("links-redirect"),
      linksUnknown: count("links-unknown"),
      withDraftChanges: count("draft-changes"),
    },
  };
}

const csvCell = (v: unknown) => {
  const t = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Leading = + - @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@]/.test(t) ? `'${t}` : t;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The blog list as CSV (the filtered rows, every page), for the Export button. */
export async function blogCsv(filter: BlogFilter = {}) {
  const { posts } = await blogOverview({ ...filter, page: undefined });
  const head = ["Name", "Slug", "URL", "Status", "Featured", "Indexed", "SEO title", "Meta description", "Featured image", "Thumbnail image", "Open Graph image", "Keywords", "Words", "Published", "Created", "Modified"];
  const lines = posts.map((p) => [p.label, p.slug, p.path, p.status, p.featured ? "yes" : "no", p.indexed ? "yes" : "no", p.seoTitle, p.metaDescription, p.featuredImage, p.thumbnailImage, p.ogImage, p.keywords, p.words, p.datePublished, p.createdAt, p.dateModified].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\n") + "\n";
}
