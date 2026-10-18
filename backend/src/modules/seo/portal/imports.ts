// Migration imports for the SEO portal: Webflow blog posts, per-page metadata and 301 redirects,
// from the Webflow API or an uploaded CSV / JSON file. Every import is two steps:
//
//   1. preview  parse, normalise and compare with what the site has; nothing is written except the
//               import record itself (the original data is kept as the migration record)
//   2. apply    an SEO manager confirms. New blog posts are created (published only when asked and
//               only if Webflow had them published); anything that already exists gets the imported
//               values as a *draft* to review, never a silent overwrite. Redirects arrive switched off
//               unless activation is confirmed.

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { parseCsv } from "@/modules/seo/seo.csv";
import { SeoError } from "@/modules/seo/seo.errors";
import { isReservedPath, normalizePath, SLUG_PATTERN } from "@/modules/seo/paths";
import { findRedirectLoop } from "@/modules/seo/seo.redirects";
import { pageUpdateSchema } from "@/modules/seo/seo.validation";
import { BLOG_PREFIX, STATIC_ROUTES } from "@/modules/seo/static-routes";
import { htmlToMarkdown } from "@/modules/seo/portal/html-to-markdown";
import { webflowLocalMap } from "@/modules/seo/portal/images";
import { fetchWebflowBlog, fetchWebflowPages, type WebflowItem, type WebflowPage } from "@/modules/seo/portal/webflow";
import { canonicalOrigin } from "@/modules/seo/portal/technical";
import { baselineAsMetadata } from "@/modules/seo/portal/baseline";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type ImportKind = "BLOG_POSTS" | "PAGE_METADATA" | "REDIRECTS";

const MAX_ROWS = 2000;
const SITE_HOSTS = ["www.vistachase.com", "vistachase.com"];

// ---------------------------------------------------------------------------------------------
// Field lookup: Webflow field slugs and CSV headers vary, so match a few known names.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function pick(record: Record<string, unknown>, names: string[]): unknown {
  const keys = new Map(Object.keys(record).map((k) => [norm(k), k]));
  for (const n of names) {
    const key = keys.get(norm(n));
    if (key !== undefined && record[key] !== undefined && record[key] !== null && record[key] !== "") return record[key];
  }
  return undefined;
}
const str = (v: unknown): string | null => (v === undefined || v === null ? null : typeof v === "string" ? v.trim() || null : typeof v === "number" || typeof v === "boolean" ? String(v) : null);
const truthy = (v: unknown) => v === true || (typeof v === "string" && /^(true|yes|1|on)$/i.test(v.trim()));
const dateOf = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const imageOf = (v: unknown): { url: string; alt: string | null } | null => {
  if (typeof v === "string" && /^https?:\/\//.test(v.trim())) return { url: v.trim(), alt: null };
  if (v && typeof v === "object" && typeof (v as { url?: unknown }).url === "string") return { url: (v as { url: string }).url, alt: str((v as { alt?: unknown }).alt) };
  return null;
};

const F = {
  name: ["name", "title", "post title"],
  slug: ["slug"],
  body: ["post-body", "post body", "body", "content", "post content", "rich text"],
  summary: ["post-summary", "post summary", "summary", "excerpt"],
  thumbnail: ["thumbnail-image", "thumbnail image", "thumbnail"],
  mainImage: ["main-image", "main image", "featured-image", "featured image", "hero-image", "cover-image", "image"],
  featured: ["featured", "featured?", "is-featured"],
  seoTitle: ["seo-title", "seo title", "meta-title", "meta title", "title tag"],
  metaDescription: ["meta-description", "meta description", "seo-description", "seo description"],
  ogTitle: ["og-title", "og title", "open graph title"],
  ogDescription: ["og-description", "og description", "open graph description"],
  ogImage: ["og-image", "og image", "open-graph-image", "open graph image", "social-image"],
  createdOn: ["created on", "createdon"],
  updatedOn: ["updated on", "updatedon", "last updated", "lastupdated", "modified"],
  publishedOn: ["published on", "publishedon", "last published", "lastpublished"],
  draft: ["draft", "_draft"],
  archived: ["archived", "_archived"],
  itemId: ["item id", "itemid", "id"],
};

export interface NormalizedPost {
  ref: string;
  name: string | null;
  slug: string | null;
  bodyHtml: string | null;
  summary: string | null;
  mainImage: { url: string; alt: string | null } | null;
  thumbnail: { url: string; alt: string | null } | null;
  featured: boolean;
  seoTitle: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  createdOn: string | null;
  updatedOn: string | null;
  publishedOn: string | null;
  state: "published" | "draft" | "archived" | "changes-in-draft" | "unknown";
}

function normalizePost(record: Record<string, unknown>, ref: string, meta: Partial<NormalizedPost> = {}): NormalizedPost {
  return {
    ref,
    name: str(pick(record, F.name)),
    slug: str(pick(record, F.slug))?.toLowerCase() ?? null,
    bodyHtml: str(pick(record, F.body)),
    summary: str(pick(record, F.summary)),
    mainImage: imageOf(pick(record, F.mainImage)),
    thumbnail: imageOf(pick(record, F.thumbnail)),
    featured: truthy(pick(record, F.featured)),
    seoTitle: str(pick(record, F.seoTitle)),
    metaDescription: str(pick(record, F.metaDescription)),
    ogTitle: str(pick(record, F.ogTitle)),
    ogDescription: str(pick(record, F.ogDescription)),
    ogImage: imageOf(pick(record, F.ogImage))?.url ?? null,
    createdOn: dateOf(pick(record, F.createdOn)),
    updatedOn: dateOf(pick(record, F.updatedOn)),
    publishedOn: dateOf(pick(record, F.publishedOn)),
    state: truthy(pick(record, F.archived)) ? "archived" : truthy(pick(record, F.draft)) ? "draft" : "unknown",
    ...meta,
  };
}

function csvRecords(csv: string): Record<string, string>[] {
  let rows: string[][];
  try {
    rows = parseCsv(csv);
  } catch (error) {
    throw new SeoError(400, (error as Error).message);
  }
  if (rows.length < 2) throw new SeoError(400, "The file needs a header row and at least one data row.");
  if (rows.length - 1 > MAX_ROWS) throw new SeoError(400, `Up to ${MAX_ROWS} rows per file.`);
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function jsonRecords(text: string): Record<string, unknown>[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new SeoError(400, `Not valid JSON: ${(error as Error).message}`);
  }
  const list = Array.isArray(data) ? data : Array.isArray((data as { items?: unknown }).items) ? (data as { items: unknown[] }).items : Array.isArray((data as { pages?: unknown }).pages) ? (data as { pages: unknown[] }).pages : null;
  if (!list) throw new SeoError(400, "Expected a list of items (or {\"items\": [...]}).");
  if (list.length > MAX_ROWS) throw new SeoError(400, `Up to ${MAX_ROWS} items per file.`);
  return list.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
}

/** A Webflow API item (or a JSON item shaped like one) → NormalizedPost. */
export function postFromItem(item: Record<string, unknown>, index: number, changesInDraft?: Set<string>): NormalizedPost {
  const fieldData = (item.fieldData && typeof item.fieldData === "object" ? item.fieldData : item) as Record<string, unknown>;
  const w = item as unknown as WebflowItem;
  const state: NormalizedPost["state"] = w.isArchived ? "archived" : w.isDraft ? "draft" : changesInDraft?.has(w.id) ? "changes-in-draft" : w.lastPublished || w.isDraft === false ? "published" : "unknown";
  return normalizePost(fieldData, String(item.id ?? `item ${index + 1}`), {
    createdOn: dateOf(w.createdOn) ?? dateOf(pick(fieldData, F.createdOn)),
    updatedOn: dateOf(w.lastUpdated) ?? dateOf(pick(fieldData, F.updatedOn)),
    publishedOn: dateOf(w.lastPublished) ?? dateOf(pick(fieldData, F.publishedOn)),
    ...(state !== "unknown" ? { state } : {}),
  } as Partial<NormalizedPost>);
}

// ---------------------------------------------------------------------------------------------
// Blog posts

export interface PostOptions {
  /** Which Webflow date becomes datePublished. "created" by default: "Published On" is the last re-publish. */
  dateSource: "created" | "published";
  mapLocalImages: boolean;
  useBaseline: boolean;
}

async function baselineFor(paths: string[]) {
  const latest = await prisma.seoBaselineUrl.findFirst({ orderBy: { crawledAt: "desc" }, select: { batchId: true } });
  if (!latest) return new Map<string, { title: string | null; description: string | null; ogImage: string | null }>();
  const rows = await prisma.seoBaselineUrl.findMany({ where: { batchId: latest.batchId, path: { in: paths } }, select: { path: true, title: true, description: true, ogImage: true } });
  return new Map(rows.map((r) => [r.path, r]));
}

export async function previewPosts(posts: NormalizedPost[], options: PostOptions) {
  const paths = posts.map((p) => (p.slug ? `${BLOG_PREFIX}${p.slug}` : "")).filter(Boolean);
  const [existing, redirects, baseline] = await Promise.all([
    prisma.seoPage.findMany({ where: { path: { in: paths } }, select: { id: true, path: true, status: true, importSource: true } }),
    prisma.seoRedirect.findMany({ where: { fromPath: { in: paths }, active: true }, select: { fromPath: true, toPath: true } }),
    options.useBaseline ? baselineFor(paths) : Promise.resolve(new Map()),
  ]);
  const byPath = new Map(existing.map((p) => [p.path, p]));
  const redirected = new Map(redirects.map((r) => [r.fromPath, r.toPath]));
  const local = options.mapLocalImages ? webflowLocalMap() : new Map<string, { src: string }>();
  const mapImage = (src: string) => local.get(src)?.src ?? null;
  const seen = new Map<string, number>();
  for (const p of posts) if (p.slug) seen.set(p.slug, (seen.get(p.slug) ?? 0) + 1);

  const rows = posts.map((post) => {
    const errors: string[] = [];
    const notes: string[] = [];
    const path = post.slug ? `${BLOG_PREFIX}${post.slug}` : null;
    if (!post.name) errors.push("No name.");
    if (!post.slug) errors.push("No slug.");
    else if (!SLUG_PATTERN.test(post.slug)) errors.push(`Slug "${post.slug}" isn't lower-case words joined by hyphens; the URL can't be kept exactly.`);
    if (post.slug && (seen.get(post.slug) ?? 0) > 1) errors.push("The same slug appears more than once in this file.");
    const converted = post.bodyHtml ? htmlToMarkdown(post.bodyHtml, { siteHosts: SITE_HOSTS, mapImage }) : null;
    if (!converted || !converted.markdown) notes.push("No post body.");
    if (converted && converted.markdown.length > 50_000) errors.push("The body is longer than 50,000 characters.");
    notes.push(...(converted?.notes ?? []));
    const base = path ? baseline.get(path) : undefined;
    const seoTitle = post.seoTitle ?? base?.title ?? null;
    const metaDescription = post.metaDescription ?? base?.description ?? null;
    const titleSource = post.seoTitle ? "export" : base?.title ? "live page" : "missing";
    const descriptionSource = post.metaDescription ? "export" : base?.description ? "live page" : "missing";
    if (titleSource === "missing") notes.push("No SEO title in the export (and no baseline crawl of this URL); the post name is used until one is set.");
    const mainImage = post.mainImage ? { url: mapImage(post.mainImage.url) ?? post.mainImage.url, alt: post.mainImage.alt } : null;
    const thumbnail = post.thumbnail ? { url: mapImage(post.thumbnail.url) ?? post.thumbnail.url, alt: post.thumbnail.alt } : null;
    const ogImage = post.ogImage ? mapImage(post.ogImage) ?? post.ogImage : base?.ogImage ?? null;
    const allImages = [...(converted?.stats.images.map((i) => i.src) ?? []), mainImage?.url, thumbnail?.url, ogImage].filter(Boolean) as string[];
    const stillWebflow = allImages.filter((s) => /website-files\.com|webflow\.(com|io)/i.test(s)).length;
    if (stillWebflow) notes.push(`${stillWebflow} image${stillWebflow === 1 ? "" : "s"} still on the Webflow CDN (no local copy yet); listed under Images & alt text.`);
    const missingAlt = converted?.stats.images.filter((i) => !i.alt).length ?? 0;
    if (missingAlt) notes.push(`${missingAlt} body image${missingAlt === 1 ? " has" : "s have"} no alt text in Webflow.`);

    let action: "create" | "update-draft" | "skip" | "error" = "create";
    const current = path ? byPath.get(path) : undefined;
    if (errors.length) action = "error";
    else if (post.state === "draft" || post.state === "archived") {
      action = "skip";
      notes.unshift(post.state === "draft" ? "Draft in Webflow: not migrated (ask Nishika)." : "Archived in Webflow: not migrated.");
    } else if (current) {
      action = "update-draft";
      notes.unshift(`${path} already exists here; the imported values become a draft on it to review.`);
    }
    if (path && redirected.has(path)) {
      action = action === "error" ? action : "error";
      errors.push(`An active redirect sends ${path} to ${redirected.get(path)}; remove it first.`);
    }
    if (post.state === "changes-in-draft") notes.push("Has unpublished changes in Webflow: the published version is imported.");
    if (post.state === "unknown") notes.push("The file doesn't say whether this post is published; it is treated as published.");

    const datePublished = options.dateSource === "published" ? post.publishedOn ?? post.createdOn : post.createdOn ?? post.publishedOn;
    return {
      ref: post.ref,
      name: post.name,
      slug: post.slug,
      path,
      state: post.state,
      action,
      errors,
      notes,
      words: converted?.stats.words ?? 0,
      headings: converted?.stats.headings ?? {},
      images: converted?.stats.images.length ?? 0,
      links: converted?.stats.links.length ?? 0,
      titleSource,
      descriptionSource,
      datePublished,
      dateModified: post.updatedOn,
      fields: {
        label: post.name,
        h1: post.name,
        body: converted?.markdown ?? null,
        excerpt: post.summary,
        seoTitle,
        metaDescription,
        ogTitle: post.ogTitle,
        ogDescription: post.ogDescription,
        ogImage,
        featuredImage: mainImage?.url ?? null,
        featuredImageAlt: mainImage?.alt ?? null,
        thumbnailImage: thumbnail?.url ?? null,
        thumbnailAlt: thumbnail?.alt ?? null,
        featured: post.featured,
        datePublished,
        dateModified: post.updatedOn,
      },
      existingId: current?.id ?? null,
    };
  });
  const counts = { create: 0, "update-draft": 0, skip: 0, error: 0 } as Record<string, number>;
  for (const r of rows) counts[r.action]++;
  return { rows, counts, options };
}

// ---------------------------------------------------------------------------------------------
// Page metadata

interface NormalizedMeta {
  ref: string;
  path: string | null;
  title: string | null;
  description: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
}

function pathFrom(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  try {
    if (/^https?:\/\//i.test(v)) {
      const url = new URL(v);
      if (!SITE_HOSTS.includes(url.host.toLowerCase())) return null;
      return normalizePath(url.pathname) ?? null;
    }
  } catch {
    return null;
  }
  return normalizePath(v.startsWith("/") ? v : `/${v}`);
}

function metaFromRecord(r: Record<string, unknown>, i: number): NormalizedMeta {
  return {
    ref: `row ${i + 2}`,
    path: pathFrom(str(pick(r, ["path", "url", "address", "page", "slug"]))),
    title: str(pick(r, ["seo title", "title", "title 1", "meta title"])),
    description: str(pick(r, ["meta description", "description", "meta description 1"])),
    canonical: str(pick(r, ["canonical", "canonical url", "canonical link element 1"])),
    ogTitle: str(pick(r, ["og title", "og:title", "open graph title"])),
    ogDescription: str(pick(r, ["og description", "og:description", "open graph description"])),
    ogImage: str(pick(r, ["og image", "og:image", "open graph image"])),
  };
}

function metaFromWebflowPage(p: WebflowPage): NormalizedMeta | null {
  if (p.collectionId || p.draft || p.archived) return null; // CMS templates, unpublished and archived pages
  if (["401", "404", "password"].includes((p.slug ?? "").toLowerCase())) return null;
  const path = normalizePath(p.publishedPath || `/${p.slug ?? ""}`);
  return {
    ref: p.title ?? p.id,
    path,
    title: p.seo?.title ?? null,
    description: p.seo?.description ?? null,
    canonical: null,
    ogTitle: p.openGraph?.titleCopied ? null : p.openGraph?.title ?? null,
    ogDescription: p.openGraph?.descriptionCopied ? null : p.openGraph?.description ?? null,
    ogImage: null,
  };
}

export async function previewMeta(rows: NormalizedMeta[]) {
  const paths = rows.map((r) => r.path).filter(Boolean) as string[];
  const pages = await prisma.seoPage.findMany({ where: { path: { in: paths } }, select: { id: true, path: true, label: true, status: true, seoTitle: true, metaDescription: true, canonicalUrl: true, ogTitle: true, ogDescription: true, ogImage: true, lastCrawl: true } });
  const byPath = new Map(pages.map((p) => [p.path, p]));
  const out = rows.map((r) => {
    if (!r.path) return { ...r, action: "error" as const, errors: ["No usable path or vistachase.com URL."], changes: {}, pageId: null };
    const page = byPath.get(r.path);
    if (!page) return { ...r, action: "no-page" as const, errors: [], changes: {}, pageId: null, note: "No page at this address on the new site: build it, or add a 301 redirect." };
    const live = (page.lastCrawl ?? {}) as { title?: string | null; description?: string | null; canonical?: string | null; ogTitle?: string | null; ogImage?: string | null };
    const now = {
      seoTitle: page.seoTitle ?? live.title ?? null,
      metaDescription: page.metaDescription ?? live.description ?? null,
      canonicalUrl: page.canonicalUrl ?? live.canonical ?? null,
      ogTitle: page.ogTitle ?? live.ogTitle ?? null,
      ogDescription: page.ogDescription ?? null,
      ogImage: page.ogImage ?? live.ogImage ?? null,
    };
    const incoming: Record<string, string | null> = { seoTitle: r.title, metaDescription: r.description, canonicalUrl: r.canonical, ogTitle: r.ogTitle, ogDescription: r.ogDescription, ogImage: r.ogImage };
    const changes: Record<string, { from: string | null; to: string }> = {};
    for (const [k, v] of Object.entries(incoming)) if (v && v !== now[k as keyof typeof now]) changes[k] = { from: now[k as keyof typeof now], to: v };
    const parsed = pageUpdateSchema.safeParse(Object.fromEntries(Object.entries(changes).map(([k, c]) => [k, c.to])));
    const errors = parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return { ...r, action: errors.length ? ("error" as const) : Object.keys(changes).length ? ("draft" as const) : ("same" as const), errors, changes, pageId: page.id, label: page.label };
  });
  const counts = { draft: 0, same: 0, "no-page": 0, error: 0 } as Record<string, number>;
  for (const r of out) counts[r.action]++;
  return { rows: out, counts };
}

// ---------------------------------------------------------------------------------------------
// Redirects

interface NormalizedRedirect {
  ref: string;
  from: string | null;
  to: string | null;
  status: number;
  rawFrom: string;
  rawTo: string;
}

function redirectFromRecord(r: Record<string, unknown>, i: number): NormalizedRedirect {
  const rawFrom = str(pick(r, ["source", "from", "old path", "old url", "redirect from", "source path"])) ?? "";
  const rawTo = str(pick(r, ["target", "to", "new path", "new url", "redirect to", "target path", "destination"])) ?? "";
  const status = Number(str(pick(r, ["status", "code", "type"])) ?? 301);
  return { ref: `row ${i + 2}`, from: pathFrom(rawFrom), to: pathFrom(rawTo), status: [301, 302, 307, 308].includes(status) ? status : 301, rawFrom, rawTo };
}

export async function previewRedirects(rows: NormalizedRedirect[]) {
  const [active, existing, pages] = await Promise.all([
    prisma.seoRedirect.findMany({ where: { active: true }, select: { fromPath: true, toPath: true } }),
    prisma.seoRedirect.findMany({ select: { fromPath: true, toPath: true, active: true } }),
    prisma.seoPage.findMany({ where: { status: { not: "ARCHIVED" } }, select: { path: true } }),
  ]);
  const existingBy = new Map(existing.map((r) => [r.fromPath, r]));
  const known = new Set([...pages.map((p) => p.path), ...STATIC_ROUTES.map((r) => r.path)]);
  const seen = new Map<string, number>();
  for (const r of rows) if (r.from) seen.set(r.from, (seen.get(r.from) ?? 0) + 1);
  const graph = [...active];
  const out = rows.map((r) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (/[*()%$^]/.test(r.rawFrom)) errors.push("Pattern (wildcard) redirects aren't supported by the redirect table; this needs an nginx rule.");
    if (!r.from) errors.push(`"${r.rawFrom}" isn't a path on this site.`);
    if (!r.to) errors.push(`"${r.rawTo}" isn't a path on this site (off-site targets aren't allowed).`);
    if (r.from && isReservedPath(r.from)) errors.push(`${r.from} belongs to the app or a signed-in area.`);
    if (r.from && (seen.get(r.from) ?? 0) > 1) errors.push("This source appears more than once in the file.");
    if (r.from && r.to && r.from === r.to) errors.push("Source and target are the same.");
    let action: "create" | "skip" | "conflict" | "error" = "create";
    const prior = r.from ? existingBy.get(r.from) : undefined;
    if (prior) {
      if (prior.toPath === r.to) action = "skip";
      else errors.push(`A redirect from ${r.from} already goes to ${prior.toPath}.`);
    }
    if (r.from && known.has(r.from)) errors.push(`${r.from} is a live page on the new site; a redirect would hide it.`);
    if (r.to && !known.has(r.to) && !r.to.startsWith(BLOG_PREFIX)) warnings.push(`${r.to} isn't a known page on the new site yet.`);
    if (r.from && r.to && !errors.length && findRedirectLoop(r.from, r.to, graph)) errors.push("Would create a loop or a long chain with existing redirects.");
    if (r.to && existingBy.get(r.to)?.active) warnings.push(`${r.to} itself redirects to ${existingBy.get(r.to)!.toPath}: point straight at the final address to avoid a chain.`);
    if (errors.length) action = prior && prior.toPath !== r.to ? "conflict" : "error";
    if (action === "create" && r.from && r.to) graph.push({ fromPath: r.from, toPath: r.to });
    return { ...r, action, errors, warnings };
  });
  const counts = { create: 0, skip: 0, conflict: 0, error: 0 } as Record<string, number>;
  for (const r of out) counts[r.action]++;
  return { rows: out, counts };
}

// ---------------------------------------------------------------------------------------------
// Batches

export interface PreviewInput {
  kind: ImportKind;
  source: "WEBFLOW_API" | "CSV" | "JSON" | "BASELINE";
  text?: string;
  fileName?: string | null;
  options?: Partial<PostOptions>;
}

const DEFAULT_POST_OPTIONS: PostOptions = { dateSource: "created", mapLocalImages: true, useBaseline: true };

export async function createPreview(input: PreviewInput, userId: string, fetchImpl?: FetchLike) {
  let raw: unknown;
  let preview: unknown;
  if (input.source === "BASELINE" && input.kind !== "PAGE_METADATA") throw new SeoError(400, "The live-site baseline can only fill page metadata.");
  if (input.source !== "WEBFLOW_API" && input.source !== "BASELINE" && !input.text) throw new SeoError(400, "Choose a file to upload.");
  const records = () => (input.source === "CSV" ? csvRecords(input.text!) : jsonRecords(input.text!));

  if (input.kind === "BLOG_POSTS") {
    const options = { ...DEFAULT_POST_OPTIONS, ...input.options };
    let posts: NormalizedPost[];
    if (input.source === "WEBFLOW_API") {
      const blog = await fetchWebflowBlog(fetchImpl);
      posts = [...blog.live.map((it, i) => postFromItem(it as unknown as Record<string, unknown>, i, blog.changesInDraft)), ...blog.unpublished.map((it, i) => ({ ...postFromItem(it as unknown as Record<string, unknown>, i), state: it.isArchived ? ("archived" as const) : ("draft" as const) }))];
      raw = { collection: blog.collection, live: blog.live, unpublished: blog.unpublished, changesInDraft: [...blog.changesInDraft] };
    } else {
      const list = records();
      posts = list.map((r, i) => (input.source === "JSON" ? postFromItem(r, i) : normalizePost(r, String(pick(r, F.itemId) ?? `row ${i + 2}`))));
      raw = input.source === "CSV" ? { csv: input.text } : { json: list };
    }
    preview = await previewPosts(posts, options);
  } else if (input.kind === "PAGE_METADATA") {
    let rows: NormalizedMeta[];
    if (input.source === "BASELINE") {
      const baseline = await baselineAsMetadata();
      rows = baseline.rows;
      raw = { baselineBatchId: baseline.batchId };
    } else if (input.source === "WEBFLOW_API") {
      const { pages } = await fetchWebflowPages(fetchImpl);
      rows = pages.map(metaFromWebflowPage).filter((m): m is NormalizedMeta => m !== null);
      raw = { pages };
    } else {
      const list = records();
      rows = list.map(metaFromRecord);
      raw = input.source === "CSV" ? { csv: input.text } : { json: list };
    }
    preview = await previewMeta(rows);
  } else {
    if (input.source === "WEBFLOW_API") throw new SeoError(400, "Webflow's API doesn't expose 301 redirects. Copy them from Site settings → Publishing → 301 redirects into a CSV (from, to).");
    const text = input.text!;
    // A bare two-column list without a header is accepted too.
    // A bare two-column list (first cell is already a path or URL) gets a header added.
    const firstCell = (text.split(/\r?\n/)[0] ?? "").split(",")[0].trim().replace(/^"/, "");
    const csvText = input.source === "CSV" && /^(\/|https?:\/\/)/i.test(firstCell) ? `from,to\n${text}` : text;
    const list = input.source === "CSV" ? csvRecords(csvText) : jsonRecords(text);
    raw = input.source === "CSV" ? { csv: text } : { json: list };
    preview = await previewRedirects(list.map(redirectFromRecord));
  }

  const batch = await prisma.seoImportBatch.create({
    data: { kind: input.kind, source: input.source, fileName: input.fileName ?? null, raw: raw as Prisma.InputJsonValue, preview: preview as Prisma.InputJsonValue, createdById: userId },
  });
  await prisma.auditLog.create({ data: { userId, action: "SEO_IMPORT_PREVIEWED", entityType: "SeoImportBatch", entityId: batch.id, details: { kind: input.kind, source: input.source, fileName: input.fileName ?? null, counts: (preview as { counts: unknown }).counts } as Prisma.InputJsonValue } });
  return batch;
}

export interface ApplyOptions {
  /** Blog posts: publish the ones Webflow had published (else they are created as drafts). */
  publish?: boolean;
  /** Redirects: switch them on now (else they are saved off, to switch on after review). */
  activate?: boolean;
  confirm: boolean;
}

type PostRow = Awaited<ReturnType<typeof previewPosts>>["rows"][number];
type MetaRow = Awaited<ReturnType<typeof previewMeta>>["rows"][number];
type RedirectRow = Awaited<ReturnType<typeof previewRedirects>>["rows"][number];

type PostFields = PostRow["fields"];

/** Imported post values, trimmed to the editor's limits and validated like a portal save. */
export function postData(f: PostFields) {
  return pageUpdateSchema.safeParse({
    label: (f.label ?? "").slice(0, 120),
    h1: f.h1?.slice(0, 150) ?? null,
    body: f.body,
    excerpt: f.excerpt?.slice(0, 500) ?? null,
    seoTitle: f.seoTitle?.slice(0, 120) ?? null,
    metaDescription: f.metaDescription?.slice(0, 320) ?? null,
    ogTitle: f.ogTitle?.slice(0, 120) ?? null,
    ogDescription: f.ogDescription?.slice(0, 320) ?? null,
    ogImage: f.ogImage,
    featuredImage: f.featuredImage,
    featuredImageAlt: f.featuredImageAlt?.slice(0, 200) ?? null,
    thumbnailImage: f.thumbnailImage,
    thumbnailAlt: f.thumbnailAlt?.slice(0, 200) ?? null,
    featured: f.featured,
    datePublished: f.datePublished,
    dateModified: f.dateModified,
  });
}

export async function applyBatch(id: string, opts: ApplyOptions, userId: string) {
  if (!opts.confirm) throw new SeoError(400, "Confirm the import first.");
  const batch = await prisma.seoImportBatch.findUnique({ where: { id } });
  if (!batch) throw new SeoError(404, "Import not found.");
  if (batch.status !== "PREVIEWED") throw new SeoError(409, "This import was already applied or discarded. Upload it again for a fresh preview.");
  if (Date.now() - batch.createdAt.getTime() > 24 * 3600_000) throw new SeoError(409, "This preview is more than a day old. Preview again so it reflects the site as it is now.");
  // Claim the batch so two clicks (or two people) can't apply it twice.
  const claimed = await prisma.seoImportBatch.updateMany({ where: { id, status: "PREVIEWED" }, data: { status: "RUNNING" } });
  if (claimed.count === 0) throw new SeoError(409, "This import is already being applied.");
  try {
    return await applyClaimed(batch, opts, userId);
  } catch (error) {
    await prisma.seoImportBatch.update({ where: { id }, data: { status: "FAILED", result: { error: (error as Error).message.slice(0, 300) } } });
    throw error;
  }
}

async function applyClaimed(batch: NonNullable<Awaited<ReturnType<typeof prisma.seoImportBatch.findUnique>>>, opts: ApplyOptions, userId: string) {
  const id = batch.id;

  const result = { created: 0, drafted: 0, skipped: 0, failed: [] as { ref: string; error: string }[], ids: [] as string[] };
  const now = new Date();

  if (batch.kind === "BLOG_POSTS") {
    const rows = (batch.preview as { rows: PostRow[] }).rows;
    for (const row of rows) {
      if (row.action === "skip" || row.action === "error" || !row.path) {
        result.skipped++;
        continue;
      }
      const parsed = postData(row.fields);
      if (!parsed.success) {
        result.failed.push({ ref: row.ref, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
        continue;
      }
      const data = parsed.data;
      try {
        if (row.action === "update-draft" && row.existingId) {
          const page = await prisma.seoPage.findUnique({ where: { id: row.existingId }, select: { draft: true } });
          const draft = { ...((page?.draft as Record<string, unknown>) ?? {}), ...JSON.parse(JSON.stringify(data)) };
          await prisma.$transaction([
            prisma.seoPage.update({ where: { id: row.existingId }, data: { draft, draftUpdatedAt: now, draftUpdatedById: userId } }),
            prisma.seoPageRevision.create({ data: { pageId: row.existingId, userId, action: "DRAFT_FROM_IMPORT", changes: { import: { from: null, to: batch.id } }, note: `Webflow import ${row.ref}` } }),
          ]);
          result.drafted++;
          result.ids.push(row.existingId);
          continue;
        }
        const publish = Boolean(opts.publish) && (row.state === "published" || row.state === "changes-in-draft" || row.state === "unknown");
        const created = await prisma.$transaction(async (tx) => {
          const page = await tx.seoPage.create({
            data: {
              ...(data as Prisma.SeoPageCreateInput),
              label: data.label ?? row.slug!,
              path: row.path!,
              pageType: "GUIDE",
              source: "CMS",
              status: publish ? "PUBLISHED" : "DRAFT",
              publishedAt: publish ? now : null,
              conversionGoal: "BOOKING",
              importSource: batch.source === "WEBFLOW_API" ? "WEBFLOW_API" : batch.source === "CSV" ? "WEBFLOW_CSV" : "JSON",
              originalUrl: `${canonicalOrigin()}${row.path}`,
              createdById: userId,
              updatedById: userId,
            },
          });
          await tx.seoPageRevision.create({ data: { pageId: page.id, userId, action: "IMPORTED", changes: { path: { from: null, to: page.path }, status: { from: null, to: page.status } }, note: `Imported from ${batch.source} (${row.ref}); copied as is, publishing checks not applied.` } });
          return page;
        });
        result.created++;
        result.ids.push(created.id);
      } catch (error) {
        result.failed.push({ ref: row.ref, error: (error as Error).message.slice(0, 200) });
      }
    }
  } else if (batch.kind === "PAGE_METADATA") {
    const rows = (batch.preview as { rows: MetaRow[] }).rows;
    for (const row of rows) {
      if (row.action !== "draft" || !row.pageId) {
        result.skipped++;
        continue;
      }
      const parsed = pageUpdateSchema.safeParse(Object.fromEntries(Object.entries(row.changes).map(([k, c]) => [k, c.to])));
      if (!parsed.success) {
        result.failed.push({ ref: row.ref, error: parsed.error.issues[0]?.message ?? "Invalid" });
        continue;
      }
      const page = await prisma.seoPage.findUnique({ where: { id: row.pageId }, select: { draft: true } });
      const draft = { ...((page?.draft as Record<string, unknown>) ?? {}), ...JSON.parse(JSON.stringify(parsed.data)) };
      await prisma.$transaction([
        prisma.seoPage.update({ where: { id: row.pageId }, data: { draft, draftUpdatedAt: now, draftUpdatedById: userId } }),
        prisma.seoPageRevision.create({ data: { pageId: row.pageId, userId, action: "DRAFT_FROM_IMPORT", changes: row.changes as Prisma.InputJsonValue, note: `Metadata import ${batch.id}` } }),
      ]);
      result.drafted++;
      result.ids.push(row.pageId);
    }
  } else {
    const rows = (batch.preview as { rows: RedirectRow[] }).rows;
    if (opts.activate) {
      // Re-check against the redirects as they are now (the preview may be hours old).
      const fresh = await previewRedirects(rows.map((r) => ({ ref: r.ref, from: r.from, to: r.to, status: r.status, rawFrom: r.rawFrom, rawTo: r.rawTo })));
      const blocked = fresh.rows.filter((r) => r.action === "error" || r.action === "conflict");
      if (blocked.length && blocked.length === fresh.rows.filter((r) => r.action !== "skip").length) throw new SeoError(409, "None of these redirects can be switched on as things stand. Preview again.");
    }
    for (const row of rows) {
      if (row.action !== "create" || !row.from || !row.to) {
        result.skipped++;
        continue;
      }
      try {
        const created = await prisma.$transaction(async (tx) => {
          const r = await tx.seoRedirect.create({ data: { fromPath: row.from!, toPath: row.to!, statusCode: row.status, active: false, source: "IMPORT", note: `Imported (${batch.fileName ?? batch.source}, ${row.ref})`, createdById: userId } });
          await tx.auditLog.create({ data: { userId, action: "SEO_REDIRECT_CREATED", entityType: "SeoRedirect", entityId: r.id, details: { fromPath: r.fromPath, toPath: r.toPath, statusCode: r.statusCode, import: batch.id, active: false } } });
          return r;
        });
        result.created++;
        result.ids.push(created.id);
      } catch (error) {
        result.failed.push({ ref: row.ref, error: (error as Error).message.slice(0, 200) });
      }
    }
    if (opts.activate && result.ids.length) {
      const { activateRedirects } = await import("@/modules/seo/portal/redirect-tools");
      const activation = await activateRedirects(result.ids, userId);
      Object.assign(result, { activated: activation.activated, notActivated: activation.failed });
    }
  }

  const updated = await prisma.seoImportBatch.update({ where: { id }, data: { status: "APPLIED", result: result as unknown as Prisma.InputJsonValue, appliedById: userId, appliedAt: now } });
  await prisma.auditLog.create({ data: { userId, action: "SEO_IMPORT_APPLIED", entityType: "SeoImportBatch", entityId: id, details: { kind: batch.kind, created: result.created, drafted: result.drafted, skipped: result.skipped, failed: result.failed.length, publish: Boolean(opts.publish), activate: Boolean(opts.activate) } } });
  return updated;
}

export async function discardBatch(id: string, userId: string) {
  const batch = await prisma.seoImportBatch.findUnique({ where: { id }, select: { status: true } });
  if (!batch) throw new SeoError(404, "Import not found.");
  if (batch.status !== "PREVIEWED") throw new SeoError(409, "Only a previewed import can be discarded.");
  await prisma.seoImportBatch.update({ where: { id }, data: { status: "DISCARDED" } });
  await prisma.auditLog.create({ data: { userId, action: "SEO_IMPORT_DISCARDED", entityType: "SeoImportBatch", entityId: id, details: {} } });
}

export async function listBatches() {
  return prisma.seoImportBatch.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, kind: true, source: true, status: true, fileName: true, preview: true, result: true, createdAt: true, appliedAt: true, createdById: true } }).then((rows) =>
    rows.map(({ preview, ...r }) => ({ ...r, counts: (preview as { counts?: unknown }).counts ?? null })),
  );
}

export async function getBatch(id: string) {
  const batch = await prisma.seoImportBatch.findUnique({ where: { id }, select: { id: true, kind: true, source: true, status: true, fileName: true, preview: true, result: true, createdAt: true, appliedAt: true } });
  if (!batch) throw new SeoError(404, "Import not found.");
  return batch;
}
