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
import { checksFor, type LiveCrawl } from "@/modules/seo/seo.pages";
import { LIMITS } from "@/modules/seo/seo.validation";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const MAX_PAGES = 500;
const MAX_LINK_CHECKS = 300;
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
  return {
    title: titleMatch ? decode(titleMatch[1]) : null,
    description: metaContent(html, "name", "description"),
    canonical: canonicalTag ? attr(canonicalTag, "href") : null,
    robots: metaContent(html, "name", "robots"),
    ogTitle: metaContent(html, "property", "og:title"),
    ogImage: metaContent(html, "property", "og:image"),
    h1,
    wordCount: text ? text.split(" ").length : 0,
    internalLinks: links.size,
    links: [...links],
  };
}

async function fetchPage(fetchImpl: FetchLike, url: string): Promise<{ status: number; location: string | null; html: string | null; error?: string }> {
  try {
    const res = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "VistaChaseSEOAudit/1.0", Accept: "text/html" } });
    const type = res.headers.get("content-type") ?? "";
    const html = res.status === 200 && type.includes("text/html") ? await res.text() : null;
    if (html === null) await res.body?.cancel().catch(() => undefined);
    return { status: res.status, location: res.headers.get("location"), html };
  } catch (error) {
    return { status: 0, location: null, html: null, error: (error as Error).message };
  }
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
        live = { ...parseHtml(res.html, `${baseUrl}${page.path}`), status: res.status };
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
    }
    const indexable = withEffective.filter((w) => w.live && !/noindex/i.test(w.live.robots ?? ""));
    findings.push(...duplicates(indexable.map((w) => ({ page: w.page, value: w.eff.title })), "DUPLICATE_TITLE", "title", "MEDIUM"));
    findings.push(...duplicates(indexable.map((w) => ({ page: w.page, value: w.eff.description })), "DUPLICATE_DESCRIPTION", "description", "MEDIUM"));
    findings.push(...duplicates(indexable.map((w) => ({ page: w.page, value: canonicalPath(w.eff.canonical, baseUrl) })), "DUPLICATE_CANONICAL", "canonical URL", "HIGH"));
  }

  // 3. Stored-data checks (no crawl needed).
  for (const { page } of withEffective) {
    if (!page.focusKeyword && page.pageType !== "LEGAL" && page.pageType !== "STATIC") findings.push({ type: "MISSING_FOCUS_KEYWORD", severity: "LOW", path: page.path, pageId: page.id, message: "No focus keyword set." });
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
  return {
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
