// SEO audit: reads the live pages (the frontend, server to server), compares them with what is
// stored here, and records problems as SeoIssue rows. Everything is calculated locally from our
// own pages and data; nothing here is Google search performance.
//
// Run from the dashboard ("Run audit") or nightly by the worker. A page the crawl can't reach is
// reported, and checks that depend on the crawl are not marked resolved when the crawl failed.

import type { Prisma, SeoIssueSeverity, SeoPage } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { normalizeKeyword, normalizePath } from "@/modules/seo/paths";
import { resolveChains } from "@/modules/seo/seo.redirects";
import { intentMismatch } from "@/modules/seo/seo.keywords";
import { checksFor, type CrawledImage, type CrawledJsonLd, type LiveCrawl } from "@/modules/seo/seo.pages";
import { LIMITS } from "@/modules/seo/seo.validation";
import { BLOG_PREFIX } from "@/modules/seo/static-routes";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const MAX_PAGES = 500;
const MAX_LINK_CHECKS = 300;
const MAX_IMAGE_CHECKS = 200;
const CONCURRENCY = 4;
const TIMEOUT_MS = 15_000;

export function auditBaseUrl(): string {
  return (process.env.SEO_AUDIT_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------------------------
// HTML reading (our own pages, so a small tag reader is enough)

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? "") : null;
}

function metaContent(head: string, key: "name" | "property", value: string): string | null {
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    if ((attr(tag, key) ?? "").toLowerCase() === value) return attr(tag, "content");
  }
  return null;
}

export interface ParsedPage extends LiveCrawl {
  links: string[];
}

/** Title, description, canonical, robots, H1s, OG, word count and same-site links of a page. */
export function parseHtml(html: string, pageUrl: string): ParsedPage {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const canonicalTag = (html.match(/<link\b[^>]*>/gi) ?? []).find((t) => (attr(t, "rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"));
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const h1 = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, " "))).filter(Boolean);
  const text = decode(body.replace(/<[^>]+>/g, " "));
  const base = new URL(pageUrl);
  const links = new Set<string>();
  for (const tag of body.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attr(tag, "href");
    if (!href || /^(mailto:|tel:|javascript:|#|data:)/i.test(href)) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.host !== base.host) continue;
    const path = normalizePath(url.pathname);
    if (!path || /^\/(api|_next|media)(\/|$)/.test(path)) continue;
    links.add(path);
  }
  const head = html.match(/<head\b[\s\S]*?<\/head>/i)?.[0] ?? "";
  const jsonLd = readJsonLd(html);
  const ogImage = metaContent(html, "property", "og:image");
  const images: CrawledImage[] = [];
  for (const tag of body.match(/<img\b[^>]*>/gi) ?? []) {
    const src = imageSrc(attr(tag, "src"), base);
    if (!src) continue;
    const num = (name: string) => {
      const v = Number(attr(tag, name));
      return Number.isFinite(v) && v > 0 ? v : null;
    };
    images.push({ src, alt: attr(tag, "alt"), width: num("width"), height: num("height"), lazy: (attr(tag, "loading") ?? "").toLowerCase() === "lazy", kind: "img" });
  }
  if (ogImage) images.push({ src: imageSrc(ogImage, base) ?? ogImage, alt: metaContent(html, "property", "og:image:alt"), width: null, height: null, lazy: false, kind: "og" });
  for (const url of schemaImageUrls(jsonLd)) images.push({ src: url, alt: null, width: null, height: null, lazy: false, kind: "schema" });
  // Scripts in <head> that block rendering: external, not async/defer/module, not JSON data.
  const blockingScripts = (head.match(/<script\b[^>]*>/gi) ?? []).filter((t) => {
    if (!attr(t, "src")) return false;
    const type = (attr(t, "type") ?? "").toLowerCase();
    if (type === "module" || type.includes("json")) return false;
    return !/\s(async|defer)(\s|=|>|$)/i.test(t);
  }).length;
  const gtagIds = [...html.matchAll(/googletagmanager\.com\/gtag\/js\?id=([A-Z]{1,3}-[A-Z0-9]+)/gi)].map((m) => m[1].toUpperCase());
  return {
    title: titleMatch ? decode(titleMatch[1]) : null,
    description: metaContent(html, "name", "description"),
    canonical: canonicalTag ? attr(canonicalTag, "href") : null,
    robots: metaContent(html, "name", "robots"),
    ogTitle: metaContent(html, "property", "og:title"),
    ogImage,
    ogUrl: metaContent(html, "property", "og:url"),
    ogType: metaContent(html, "property", "og:type"),
    twitterCard: metaContent(html, "name", "twitter:card"),
    viewport: metaContent(html, "name", "viewport") !== null,
    verification: metaContent(html, "name", "google-site-verification"),
    h1,
    wordCount: text ? text.split(" ").length : 0,
    internalLinks: links.size,
    links: [...links],
    images: images.slice(0, 150),
    imageCount: images.filter((i) => i.kind === "img").length,
    jsonLd,
    gtagIds,
    blockingScripts,
    htmlBytes: Buffer.byteLength(html),
  };
}

/** next/image serves /_next/image?url=/media/x.webp: report the real file. Absolute URL otherwise. */
function imageSrc(raw: string | null, base: URL): string | null {
  if (!raw || raw.startsWith("data:")) return null;
  try {
    const url = new URL(raw, base);
    if (url.host === base.host && url.pathname === "/_next/image") {
      const inner = url.searchParams.get("url");
      if (inner) return inner.startsWith("/") ? inner : new URL(inner).toString();
    }
    return url.host === base.host ? url.pathname : url.toString();
  } catch {
    return null;
  }
}

/** Every application/ld+json block, parsed; a block that isn't valid JSON is reported, not dropped. */
export function readJsonLd(html: string): CrawledJsonLd[] {
  const out: CrawledJsonLd[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (out.length >= 20) break;
    const raw = m[1].trim();
    try {
      const data = JSON.parse(raw) as unknown;
      const nodes = flattenGraph(data);
      const types = nodes.flatMap((n) => (Array.isArray(n["@type"]) ? n["@type"] : n["@type"] ? [n["@type"]] : [])).map(String);
      const ids = nodes.map((n) => n["@id"]).filter((v): v is string => typeof v === "string");
      out.push({ ok: true, types, ids, data: raw.length <= 20_000 ? data : undefined });
    } catch (error) {
      out.push({ ok: false, error: (error as Error).message.slice(0, 200), types: [], ids: [] });
    }
  }
  return out;
}

type Node = Record<string, unknown>;
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);

/** Top-level schema nodes: an object, an array of objects, or an @graph. */
export function flattenGraph(data: unknown): Node[] {
  if (Array.isArray(data)) return data.flatMap(flattenGraph);
  if (!isNode(data)) return [];
  if (Array.isArray(data["@graph"])) return (data["@graph"] as unknown[]).flatMap(flattenGraph);
  return [data];
}

/** Image and logo URLs inside JSON-LD (any depth), to find Webflow CDN references. */
function schemaImageUrls(blocks: CrawledJsonLd[]): string[] {
  const urls = new Set<string>();
  const IMAGE_KEYS = new Set(["image", "logo", "thumbnailUrl", "contentUrl", "photo"]);
  // `inImage`: inside an image/logo value, where an ImageObject keeps its address in "url".
  const walk = (v: unknown, key: string, inImage: boolean, depth: number) => {
    if (depth > 8) return;
    if (typeof v === "string") {
      if ((IMAGE_KEYS.has(key) || (inImage && key === "url")) && /^https?:\/\//i.test(v)) urls.add(v);
      return;
    }
    if (Array.isArray(v)) return v.forEach((x) => walk(x, key, inImage, depth + 1));
    if (isNode(v)) for (const [k, x] of Object.entries(v)) walk(x, k, inImage || IMAGE_KEYS.has(key), depth + 1);
  };
  for (const b of blocks) if (b.ok) walk(b.data, "", false, 0);
  return [...urls].slice(0, 20);
}

async function fetchPage(fetchImpl: FetchLike, url: string, method = "GET"): Promise<{ status: number; location: string | null; html: string | null; error?: string; ms: number }> {
  const started = Date.now();
  try {
    const res = await fetchImpl(url, { method, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "VistaChaseSEOAudit/1.0", Accept: method === "HEAD" ? "*/*" : "text/html" } });
    const type = res.headers.get("content-type") ?? "";
    const html = method === "GET" && res.status === 200 && type.includes("text/html") ? await res.text() : null;
    if (html === null) await res.body?.cancel().catch(() => undefined);
    return { status: res.status, location: res.headers.get("location"), html, ms: Date.now() - started };
  } catch (error) {
    return { status: 0, location: null, html: null, error: (error as Error).message, ms: Date.now() - started };
  }
}

/** Old CMS image hosts that stop serving when the Webflow plan ends. */
export const WEBFLOW_HOST = /(^|\.)((website-files\.com)|(webflow\.(com|io)))$/i;
export const isWebflowUrl = (src: string) => {
  try {
    return /^https?:/i.test(src) && WEBFLOW_HOST.test(new URL(src).hostname);
  } catch {
    return false;
  }
};

/** Paths listed in a sitemap.xml (one level of sitemap index followed), or null if it can't be read. */
export async function readSitemapPaths(fetchImpl: FetchLike, sitemapUrl: string, max = 5000): Promise<{ paths: string[]; hosts: string[] } | null> {
  const get = async (url: string) => {
    try {
      const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "VistaChaseSEOAudit/1.0" } });
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  };
  const xml = await get(sitemapUrl);
  if (xml === null) return null;
  const locs = (text: string) => [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decode(m[1]));
  let urls = locs(xml);
  if (/<sitemapindex/i.test(xml)) {
    const nested: string[] = [];
    for (const child of urls.slice(0, 20)) nested.push(...locs((await get(child)) ?? ""));
    urls = nested;
  }
  const paths = new Set<string>();
  const hosts = new Set<string>();
  for (const u of urls.slice(0, max)) {
    try {
      const url = new URL(u);
      hosts.add(url.host);
      paths.add(normalizePath(url.pathname) ?? url.pathname);
    } catch {
      /* skip bad <loc> */
    }
  }
  return { paths: [...paths], hosts: [...hosts] };
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------------------------
// Issues

interface Finding {
  type: string;
  severity: SeoIssueSeverity;
  path?: string | null;
  pageId?: string | null;
  message: string;
  detail?: Record<string, unknown>;
  key?: string; // extra fingerprint part when one page can have several of the same type
}

/** Issue types that need the crawl; they aren't auto-resolved when the crawl didn't run. */
const CRAWL_TYPES = new Set([
  "PAGE_UNREACHABLE", "PAGE_REDIRECTS", "MISSING_TITLE", "TITLE_LENGTH", "MISSING_DESCRIPTION", "DESCRIPTION_LENGTH", "MISSING_H1", "MULTIPLE_H1",
  "MISSING_CANONICAL", "CANONICAL_ELSEWHERE", "NOINDEX_KEY_PAGE", "DUPLICATE_TITLE", "DUPLICATE_DESCRIPTION", "DUPLICATE_CANONICAL",
  "BROKEN_INTERNAL_LINK", "INTERNAL_LINK_REDIRECT", "REDIRECT_TARGET_BROKEN", "THIN_CONTENT",
  // SEO portal checks
  "IMAGE_MISSING_ALT", "WEBFLOW_CDN_REFERENCE", "IMAGE_BROKEN", "JSONLD_INVALID", "JSONLD_DUPLICATE", "MISSING_VIEWPORT", "RENDER_BLOCKING_SCRIPTS",
  "LARGE_HTML", "SLOW_RESPONSE", "DUPLICATE_TRACKING_TAG", "MISSING_SOCIAL_TAGS", "SITEMAP_MISSING_PAGE", "SITEMAP_BAD_URL",
]);

export const SEVERITY_WEIGHT: Record<SeoIssueSeverity, number> = { CRITICAL: 100, HIGH: 40, MEDIUM: 15, LOW: 5 };

function canonicalPath(canonical: string | null | undefined, base: string): string | null {
  if (!canonical) return null;
  try {
    const url = new URL(canonical, base);
    return normalizePath(url.pathname) ?? url.pathname;
  } catch {
    return null;
  }
}

/** Effective metadata: published overrides win, else what the live page shows. */
function effective(page: SeoPage, live: LiveCrawl | null) {
  const useOverrides = page.status === "PUBLISHED";
  return {
    title: (useOverrides && page.seoTitle) || live?.title || null,
    description: (useOverrides && page.metaDescription) || live?.description || null,
    canonical: (useOverrides && page.canonicalUrl) || live?.canonical || null,
  };
}

function duplicates(pages: { page: SeoPage; value: string | null }[], type: string, label: string, severity: SeoIssueSeverity): Finding[] {
  const groups = new Map<string, SeoPage[]>();
  for (const { page, value } of pages) {
    if (!value) continue;
    const key = value.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), page]);
  }
  const out: Finding[] = [];
  for (const [value, group] of groups) {
    if (group.length < 2) continue;
    for (const page of group) {
      out.push({
        type,
        severity,
        path: page.path,
        pageId: page.id,
        message: `Same ${label} as ${group.filter((g) => g.id !== page.id).map((g) => g.path).slice(0, 3).join(", ")}.`,
        detail: { value, paths: group.map((g) => g.path) },
      });
    }
  }
  return out;
}

type PageRef = { path: string; pageId: string };

/** Images, structured data, mobile and weight checks for one crawled page (SEO portal). */
export function pageQualityFindings(ref: PageRef, live: LiveCrawl): Finding[] {
  const out: Finding[] = [];
  const imgs = (live.images ?? []).filter((i) => i.kind === "img");
  const noAlt = imgs.filter((i) => i.alt === null);
  if (noAlt.length) out.push({ ...ref, type: "IMAGE_MISSING_ALT", severity: "MEDIUM", message: `${noAlt.length} image${noAlt.length === 1 ? "" : "s"} without an alt attribute.`, detail: { images: noAlt.slice(0, 20).map((i) => i.src) } });
  const webflow = (live.images ?? []).filter((i) => isWebflowUrl(i.src));
  if (webflow.length) out.push({ ...ref, type: "WEBFLOW_CDN_REFERENCE", severity: "HIGH", message: `${webflow.length} image reference${webflow.length === 1 ? "" : "s"} on the Webflow CDN; they break when the Webflow plan ends.`, detail: { images: webflow.slice(0, 20).map((i) => ({ src: i.src, kind: i.kind })) } });
  const blocks = live.jsonLd ?? [];
  const invalid = blocks.filter((b) => !b.ok);
  if (invalid.length) out.push({ ...ref, type: "JSONLD_INVALID", severity: "HIGH", message: `${invalid.length} structured data block${invalid.length === 1 ? " isn't" : "s aren't"} valid JSON: ${invalid[0].error ?? ""}`.trim() });
  const ids = blocks.flatMap((b) => b.ids);
  const dupIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dupIds.length) out.push({ ...ref, type: "JSONLD_DUPLICATE", severity: "MEDIUM", message: `The same @id is defined more than once: ${dupIds.slice(0, 3).join(", ")}.`, detail: { ids: dupIds } });
  const typeCounts = new Map<string, number>();
  for (const t of blocks.flatMap((b) => b.types)) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  const repeated = [...typeCounts].filter(([t, n]) => n > 1 && ["Organization", "TouristInformationCenter", "LocalBusiness", "BreadcrumbList", "FAQPage", "Article", "BlogPosting", "WebSite"].includes(t)).map(([t]) => t);
  if (repeated.length && !dupIds.length) out.push({ ...ref, type: "JSONLD_DUPLICATE", severity: "LOW", message: `More than one ${repeated.join(", ")} block on the page; check they don't conflict.`, detail: { types: repeated } });
  if (live.viewport === false) out.push({ ...ref, type: "MISSING_VIEWPORT", severity: "MEDIUM", message: "No viewport meta tag, so phones show the desktop layout." });
  if ((live.blockingScripts ?? 0) > 2) out.push({ ...ref, type: "RENDER_BLOCKING_SCRIPTS", severity: "LOW", message: `${live.blockingScripts} scripts in <head> load without async or defer.` });
  if ((live.htmlBytes ?? 0) > 600_000) out.push({ ...ref, type: "LARGE_HTML", severity: "LOW", message: `The HTML is ${Math.round((live.htmlBytes ?? 0) / 1024)} KB (measured from the audit server).` });
  if ((live.responseMs ?? 0) > 3000) out.push({ ...ref, type: "SLOW_RESPONSE", severity: "LOW", message: `The page took ${((live.responseMs ?? 0) / 1000).toFixed(1)} s to load from the audit server.` });
  const gtag = live.gtagIds ?? [];
  const dupTags = [...new Set(gtag.filter((id, i) => gtag.indexOf(id) !== i))];
  if (dupTags.length) out.push({ ...ref, type: "DUPLICATE_TRACKING_TAG", severity: "HIGH", message: `The Google tag for ${dupTags.join(", ")} loads more than once, which double-counts visits and conversions.` });
  if (!/noindex/i.test(live.robots ?? "") && (!live.ogTitle || !live.ogImage)) out.push({ ...ref, type: "MISSING_SOCIAL_TAGS", severity: "LOW", message: `No ${[!live.ogTitle && "og:title", !live.ogImage && "og:image"].filter(Boolean).join(" or ")}, so shares show a plain link.` });
  return out;
}

export interface AuditOptions {
  trigger: "MANUAL" | "SCHEDULED";
  userId?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  /** false = database checks only (no crawl). */
  crawl?: boolean;
}

export async function runAudit(opts: AuditOptions) {
  const running = await prisma.seoAuditRun.findFirst({ where: { status: "RUNNING", startedAt: { gt: new Date(Date.now() - 30 * 60_000) } } });
  if (running) return { run: running, alreadyRunning: true as const };

  const baseUrl = (opts.baseUrl ?? auditBaseUrl()).replace(/\/+$/, "");
  const run = await prisma.seoAuditRun.create({ data: { trigger: opts.trigger, startedById: opts.userId ?? null, baseUrl: opts.crawl === false ? null : baseUrl } });
  try {
    const summary = await audit(run.id, baseUrl, opts);
    const done = await prisma.seoAuditRun.update({ where: { id: run.id }, data: { status: "COMPLETED", finishedAt: new Date(), summary: summary as Prisma.InputJsonValue } });
    return { run: done, alreadyRunning: false as const };
  } catch (error) {
    const failed = await prisma.seoAuditRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), error: (error as Error).message.slice(0, 500) } });
    return { run: failed, alreadyRunning: false as const };
  }
}

async function audit(runId: string, baseUrl: string, opts: AuditOptions) {
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const findings: Finding[] = [];
  const pages = (await prisma.seoPage.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { path: "asc" }, take: MAX_PAGES })).filter(
    // Unpublished guides aren't on the site yet.
    (p) => p.source !== "CMS" || p.status === "PUBLISHED",
  );

  // 1. Crawl the pages.
  const crawled = new Map<string, ParsedPage | null>();
  let crawlOk = false;
  let reachable = 0;
  if (opts.crawl !== false && pages.length > 0) {
    const results = await pool(pages, CONCURRENCY, async (page) => ({ page, res: await fetchPage(fetchImpl, `${baseUrl}${page.path}`) }));
    for (const { page, res } of results) {
      let live: ParsedPage | null = null;
      if (res.html) {
        live = { ...parseHtml(res.html, `${baseUrl}${page.path}`), status: res.status, responseMs: res.ms };
        reachable++;
      } else if (res.status >= 300 && res.status < 400) {
        reachable++;
        findings.push({ type: "PAGE_REDIRECTS", severity: "MEDIUM", path: page.path, pageId: page.id, message: `The page redirects to ${res.location ?? "another address"}; list the final address instead.`, detail: { status: res.status, location: res.location } });
      } else {
        if (res.status > 0) reachable++;
        findings.push({ type: "PAGE_UNREACHABLE", severity: page.important ? "CRITICAL" : "HIGH", path: page.path, pageId: page.id, message: res.status ? `The page answered ${res.status}.` : `The page couldn't be loaded (${res.error ?? "no response"}).`, detail: { status: res.status } });
      }
      crawled.set(page.path, live);
      const { links: _links, ...stored } = live ?? { links: [] };
      await prisma.seoPage.update({
        where: { id: page.id },
        data: { lastCrawl: (live ? stored : { status: res.status, error: res.error ?? null }) as Prisma.InputJsonValue, lastCrawledAt: new Date() },
      });
    }
    crawlOk = reachable > 0;
  }

  // 2. Per-page metadata checks on what visitors actually get.
  const withEffective = pages.map((page) => {
    const live = crawlOk ? crawled.get(page.path) ?? null : (page.lastCrawl as LiveCrawl | null);
    return { page, live, eff: effective(page, live) };
  });
  if (crawlOk) {
    for (const { page, live, eff } of withEffective) {
      if (!live) continue;
      const ref = { path: page.path, pageId: page.id };
      if (!eff.title) findings.push({ ...ref, type: "MISSING_TITLE", severity: "HIGH", message: "No <title>." });
      else if (eff.title.length < LIMITS.title.min - 20 || eff.title.length > LIMITS.title.max + 10)
        findings.push({ ...ref, type: "TITLE_LENGTH", severity: "LOW", message: `Title is ${eff.title.length} characters (aim for ${LIMITS.title.min}–${LIMITS.title.max}).`, detail: { title: eff.title } });
      if (!eff.description) findings.push({ ...ref, type: "MISSING_DESCRIPTION", severity: "HIGH", message: "No meta description." });
      else if (eff.description.length < 70 || eff.description.length > LIMITS.description.max + 10)
        findings.push({ ...ref, type: "DESCRIPTION_LENGTH", severity: "LOW", message: `Description is ${eff.description.length} characters (aim for ${LIMITS.description.min}–${LIMITS.description.max}).` });
      const h1s = live.h1 ?? [];
      if (h1s.length === 0) findings.push({ ...ref, type: "MISSING_H1", severity: "MEDIUM", message: "No H1 heading on the page." });
      else if (h1s.length > 1) findings.push({ ...ref, type: "MULTIPLE_H1", severity: "LOW", message: `${h1s.length} H1 headings; one is clearer.`, detail: { h1: h1s.slice(0, 5) } });
      if (!eff.canonical) findings.push({ ...ref, type: "MISSING_CANONICAL", severity: "MEDIUM", message: "No canonical URL." });
      else {
        const cp = canonicalPath(eff.canonical, baseUrl);
        if (cp && cp !== page.path) findings.push({ ...ref, type: "CANONICAL_ELSEWHERE", severity: "MEDIUM", message: `Canonical points to ${cp}, so this page is left out of the sitemap.`, detail: { canonical: eff.canonical } });
      }
      const noindex = /noindex/i.test(live.robots ?? "");
      if (noindex && (page.important || page.pageType === "TOUR" || page.pageType === "HOME"))
        findings.push({ ...ref, type: "NOINDEX_KEY_PAGE", severity: "CRITICAL", message: "A key page tells search engines not to index it." });
      if (page.source === "CMS" && (live.wordCount ?? 0) < 300) findings.push({ ...ref, type: "THIN_CONTENT", severity: "MEDIUM", message: `Only about ${live.wordCount} words on the page.` });
      findings.push(...pageQualityFindings(ref, live));
    }
    const indexable = withEffective.filter((w) => w.live && !/noindex/i.test(w.live.robots ?? ""));
    findings.push(...duplicates(indexable.map((w) => ({ page: w.page, value: w.eff.title })), "DUPLICATE_TITLE", "title", "MEDIUM"));
    findings.push(...duplicates(indexable.map((w) => ({ page: w.page, value: w.eff.description })), "DUPLICATE_DESCRIPTION", "description", "MEDIUM"));
    findings.push(...duplicates(indexable.map((w) => ({ page: w.page, value: canonicalPath(w.eff.canonical, baseUrl) })), "DUPLICATE_CANONICAL", "canonical URL", "HIGH"));
  }

  // 3. Stored-data checks (no crawl needed).
  for (const { page } of withEffective) {
    if (!page.focusKeyword && page.pageType !== "LEGAL" && page.pageType !== "STATIC") findings.push({ type: "MISSING_FOCUS_KEYWORD", severity: "LOW", path: page.path, pageId: page.id, message: "No focus keyword set." });
    if (page.source === "CMS" && page.path.startsWith(BLOG_PREFIX)) {
      const missing = [!page.seoTitle && "SEO title", !page.metaDescription && "meta description", !(page.ogImage || page.featuredImage) && "social image", !page.datePublished && !page.publishedAt && "published date"].filter(Boolean);
      if (missing.length) findings.push({ type: "BLOG_MISSING_METADATA", severity: missing.length > 2 ? "HIGH" : "MEDIUM", path: page.path, pageId: page.id, message: `Blog post has no ${missing.join(", ")}.`, detail: { missing } });
    }
  }
  findings.push(...duplicates(withEffective.map((w) => ({ page: w.page, value: w.page.focusKeyword ? normalizeKeyword(w.page.focusKeyword) : null })), "KEYWORD_CANNIBALISATION", "focus keyword", "MEDIUM"));
  const pathGroups = new Map<string, SeoPage[]>();
  for (const page of pages) pathGroups.set(page.path.toLowerCase(), [...(pathGroups.get(page.path.toLowerCase()) ?? []), page]);
  for (const group of pathGroups.values()) {
    if (group.length > 1) for (const page of group) findings.push({ type: "DUPLICATE_SLUG", severity: "HIGH", path: page.path, pageId: page.id, message: `Address differs only by letter case from ${group.filter((g) => g.id !== page.id).map((g) => g.path).join(", ")}.` });
  }
  const scheduledLate = await prisma.seoPage.findMany({ where: { status: "SCHEDULED", publishAt: { lt: new Date(Date.now() - 15 * 60_000) } } });
  for (const page of scheduledLate) {
    const errors = checksFor(page).filter((c) => c.level === "error");
    findings.push({ type: "SCHEDULED_PUBLISH_BLOCKED", severity: "HIGH", path: page.path, pageId: page.id, message: errors.length ? `Scheduled to publish but blocked: ${errors.map((e) => e.message).join(" ")}` : "Scheduled time has passed but the page hasn't published (is the job running?)." });
  }

  // Keywords: cannibalisation, intent, unmapped high-priority keywords.
  const keywords = await prisma.seoKeyword.findMany({ where: { archivedAt: null }, include: { mappings: { include: { page: { select: { id: true, path: true, pageType: true } } } } } });
  for (const k of keywords) {
    const primary = k.mappings.filter((m) => m.role === "PRIMARY");
    if (primary.length > 1)
      findings.push({ type: "KEYWORD_CANNIBALISATION", severity: "MEDIUM", key: k.id, path: primary[0].page.path, pageId: primary[0].page.id, message: `"${k.keyword}" is the primary keyword of ${primary.map((m) => m.page.path).join(", ")}.`, detail: { keyword: k.keyword } });
    for (const m of primary) {
      const mismatch = intentMismatch(k, m.page.pageType);
      if (mismatch) findings.push({ type: "KEYWORD_INTENT_MISMATCH", severity: "LOW", key: k.id, path: m.page.path, pageId: m.page.id, message: `"${k.keyword}": ${mismatch}`, detail: { keyword: k.keyword } });
    }
    if (k.priority === "HIGH" && k.mappings.length === 0 && !k.targetPath)
      findings.push({ type: "KEYWORD_UNMAPPED", severity: "LOW", key: k.id, message: `High-priority keyword "${k.keyword}" has no target page.`, detail: { keyword: k.keyword } });
  }

  // 4. Redirects and internal links.
  const redirects = await prisma.seoRedirect.findMany({ where: { active: true } });
  for (const chain of resolveChains(redirects)) {
    if (chain.loop) findings.push({ type: "REDIRECT_LOOP", severity: "CRITICAL", path: chain.fromPath, message: `Redirect from ${chain.fromPath} loops; it is not served until fixed.` });
    else if (chain.hops > 1) findings.push({ type: "REDIRECT_CHAIN", severity: "MEDIUM", path: chain.fromPath, message: `Redirect from ${chain.fromPath} takes ${chain.hops} hops; point it straight at ${chain.finalPath}.` });
  }

  let linksChecked = 0;
  let brokenLinks = 0;
  if (crawlOk) {
    const knownGood = new Set(pages.filter((p) => crawled.get(p.path)).map((p) => p.path));
    const sources = new Map<string, string[]>();
    for (const [path, live] of crawled) for (const link of live?.links ?? []) if (!knownGood.has(link)) sources.set(link, [...(sources.get(link) ?? []), path]);
    const targets = [...sources.keys()];
    for (const chain of resolveChains(redirects)) if (!chain.loop && !knownGood.has(chain.finalPath)) targets.push(chain.finalPath);
    const unique = [...new Set(targets)].slice(0, MAX_LINK_CHECKS);
    const results = await pool(unique, CONCURRENCY, async (target) => ({ target, res: await fetchPage(fetchImpl, `${baseUrl}${target}`) }));
    linksChecked = results.length;
    const redirectTargets = new Set(resolveChains(redirects).map((c) => c.finalPath));
    for (const { target, res } of results) {
      const from = sources.get(target) ?? [];
      const broken = res.status === 404 || res.status === 410 || res.status >= 500;
      if (broken && from.length) {
        brokenLinks++;
        findings.push({ type: "BROKEN_INTERNAL_LINK", severity: "HIGH", key: target, path: from[0], pageId: pages.find((p) => p.path === from[0])?.id, message: `Links to ${target}, which answers ${res.status}.`, detail: { target, from: from.slice(0, 10) } });
      } else if (res.status >= 300 && res.status < 400 && from.length) {
        findings.push({ type: "INTERNAL_LINK_REDIRECT", severity: "LOW", key: target, path: from[0], message: `Links to ${target}, which redirects to ${res.location ?? "another address"}.`, detail: { target, from: from.slice(0, 10) } });
      }
      if (broken && redirectTargets.has(target)) findings.push({ type: "REDIRECT_TARGET_BROKEN", severity: "HIGH", key: target, path: target, message: `A redirect lands on ${target}, which answers ${res.status}.` });
    }
  }

  // 4b. Sitemap against the crawl, and images (portal checks).
  let sitemapUrls: number | null = null;
  let imagesChecked = 0;
  if (crawlOk) {
    const sitemap = await readSitemapPaths(fetchImpl, `${baseUrl}/sitemap.xml`);
    if (sitemap) {
      sitemapUrls = sitemap.paths.length;
      const listed = new Set(sitemap.paths);
      for (const { page, live, eff } of withEffective) {
        if (!live) continue;
        const ref = { path: page.path, pageId: page.id };
        const noindex = /noindex/i.test(live.robots ?? "");
        const cp = canonicalPath(eff.canonical, baseUrl);
        const selfCanonical = !cp || cp === page.path;
        if (listed.has(page.path) && (noindex || !selfCanonical))
          findings.push({ ...ref, type: "SITEMAP_BAD_URL", severity: "MEDIUM", message: noindex ? "Listed in sitemap.xml but the page says noindex." : `Listed in sitemap.xml but its canonical is ${cp}.` });
        else if (!listed.has(page.path) && !noindex && selfCanonical && page.status === "PUBLISHED" && page.robotsIndex && page.sitemapInclude)
          findings.push({ ...ref, type: "SITEMAP_MISSING_PAGE", severity: "LOW", message: "An indexable page that sitemap.xml doesn't list." });
      }
    }
    // Same-site images: does each one load? HEAD only, shared pool, capped.
    const imageSources = new Map<string, string[]>();
    for (const [path, live] of crawled) for (const img of live?.images ?? []) if (img.src.startsWith("/")) imageSources.set(img.src, [...(imageSources.get(img.src) ?? []), path]);
    const imageTargets = [...imageSources.keys()].slice(0, MAX_IMAGE_CHECKS);
    const imageResults = await pool(imageTargets, CONCURRENCY, async (src) => ({ src, res: await fetchPage(fetchImpl, `${baseUrl}${src}`, "HEAD") }));
    imagesChecked = imageResults.length;
    for (const { src, res } of imageResults) {
      if (res.status === 404 || res.status === 410 || res.status >= 500) {
        const from = imageSources.get(src) ?? [];
        findings.push({ type: "IMAGE_BROKEN", severity: "HIGH", key: src, path: from[0], pageId: pages.find((p) => p.path === from[0])?.id, message: `Image ${src} answers ${res.status}.`, detail: { src, from: from.slice(0, 10) } });
      }
    }
  }

  // 5. Save: one row per fingerprint; problems no longer found are resolved.
  const now = new Date();
  const seen = new Set<string>();
  for (const f of findings) {
    const fingerprint = [f.type, f.path ?? "-", f.key ?? ""].join("|").slice(0, 500);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    await prisma.seoIssue.upsert({
      where: { fingerprint },
      create: { fingerprint, type: f.type, severity: f.severity, path: f.path ?? null, pageId: f.pageId ?? null, message: f.message, detail: (f.detail ?? {}) as Prisma.InputJsonValue, lastRunId: runId, firstSeenAt: now, lastSeenAt: now },
      update: {
        severity: f.severity,
        message: f.message,
        detail: (f.detail ?? {}) as Prisma.InputJsonValue,
        lastRunId: runId,
        lastSeenAt: now,
        pageId: f.pageId ?? null,
        // A resolved problem that comes back reopens; an ignored one stays ignored.
        status: undefined,
        resolvedAt: null,
      },
    });
  }
  await prisma.seoIssue.updateMany({ where: { status: "RESOLVED", fingerprint: { in: [...seen] } }, data: { status: "OPEN", resolvedAt: null } });
  const stale = await prisma.seoIssue.findMany({ where: { status: "OPEN", fingerprint: { notIn: [...seen] } }, select: { id: true, type: true } });
  const resolvable = stale.filter((i) => crawlOk || !CRAWL_TYPES.has(i.type)).map((i) => i.id);
  if (resolvable.length) await prisma.seoIssue.updateMany({ where: { id: { in: resolvable } }, data: { status: "RESOLVED", resolvedAt: now } });

  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<SeoIssueSeverity, number>;
  for (const f of findings) bySeverity[f.severity]++;
  // What this run found, so two runs can be compared later (SEO portal → Website audit).
  const snapshot: { f: string; t: string; s: SeoIssueSeverity; p: string | null }[] = [];
  const snapSeen = new Set<string>();
  for (const f of findings) {
    const fingerprint = [f.type, f.path ?? "-", f.key ?? ""].join("|").slice(0, 500);
    if (snapSeen.has(fingerprint) || snapshot.length >= 3000) continue;
    snapSeen.add(fingerprint);
    snapshot.push({ f: fingerprint, t: f.type, s: f.severity, p: f.path ?? null });
  }
  return {
    sitemapUrls,
    imagesChecked,
    findings: snapshot,
    pagesChecked: pages.length,
    pagesReachable: reachable,
    crawled: crawlOk,
    crawlNote: opts.crawl === false ? "Database checks only." : crawlOk ? null : `The site at ${baseUrl} couldn't be reached, so page checks were skipped. Set SEO_AUDIT_BASE_URL.`,
    linksChecked,
    brokenLinks,
    issues: seen.size,
    bySeverity,
    resolved: resolvable.length,
  };
}
