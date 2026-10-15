// Live-site baseline for the migration: every URL of the current vistachase.com (from its
// sitemap) with its status, title, description, canonical, H1s and robots, saved before launch.
// The comparison then lists which old URLs the new site serves the same, differently, or not at all
// (those need a page or a 301).
//
// Polite by design: only hosts in SEO_BASELINE_HOSTS, two requests at a time with a pause, at most
// 1,000 URLs, and it runs in the background so the request returns at once.

import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { parseCsv } from "@/modules/seo/seo.csv";
import { SeoError } from "@/modules/seo/seo.errors";
import { normalizePath } from "@/modules/seo/paths";
import { auditBaseUrl, parseHtml } from "@/modules/seo/seo.audit";
import { liveOf } from "@/modules/seo/seo.pages";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const MAX_URLS = 1000;
const CONCURRENCY = 2;
const PAUSE_MS = 400;

export function baselineHosts(): string[] {
  return (process.env.SEO_BASELINE_HOSTS || "www.vistachase.com,vistachase.com")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function allowedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SeoError(400, "Enter the full sitemap address, like https://www.vistachase.com/sitemap.xml.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SeoError(400, "Only http(s) addresses.");
  if (!baselineHosts().includes(url.host.toLowerCase())) throw new SeoError(400, `Only ${baselineHosts().join(", ")} can be crawled (SEO_BASELINE_HOSTS).`);
  return url;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(fetchImpl: FetchLike, url: string) {
  const res = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "VistaChaseSEOBaseline/1.0 (+migration audit)", Accept: "text/html,application/xml" } });
  const type = res.headers.get("content-type") ?? "";
  const text = res.status === 200 && /html|xml|text/.test(type) ? (await res.text()).slice(0, 3_000_000) : null;
  if (text === null) await res.body?.cancel().catch(() => undefined);
  return { status: res.status, location: res.headers.get("location"), text };
}

/** Starts a crawl of the live site's sitemap in the background; returns the batch to poll. */
export async function startBaselineCrawl(sitemapUrl: string, userId: string, fetchImpl: FetchLike = (u, i) => fetch(u, i), wait = false) {
  const url = allowedUrl(sitemapUrl);
  const running = await prisma.seoImportBatch.findFirst({ where: { kind: "BASELINE", status: "RUNNING", createdAt: { gt: new Date(Date.now() - 60 * 60_000) } } });
  if (running) throw new SeoError(409, "A baseline crawl is already running.");
  const batch = await prisma.seoImportBatch.create({ data: { kind: "BASELINE", source: "CRAWL", status: "RUNNING", raw: { sitemapUrl: url.toString() }, createdById: userId } });
  await prisma.auditLog.create({ data: { userId, action: "SEO_BASELINE_STARTED", entityType: "SeoImportBatch", entityId: batch.id, details: { sitemapUrl: url.toString() } } });
  const job = crawl(batch.id, url, fetchImpl).catch(async (error) => {
    await prisma.seoImportBatch.update({ where: { id: batch.id }, data: { status: "FAILED", result: { error: (error as Error).message.slice(0, 300) } } });
  });
  if (wait) await job;
  return batch;
}

async function crawl(batchId: string, sitemapUrl: URL, fetchImpl: FetchLike) {
  const locs: string[] = [];
  const readSitemap = async (u: string, depth: number) => {
    const res = await fetchText(fetchImpl, u);
    if (!res.text) throw new Error(`${u} answered ${res.status}.`);
    const found = [...res.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
    if (/<sitemapindex/i.test(res.text) && depth === 0) {
      for (const child of found.slice(0, 20)) {
        if (baselineHosts().includes(new URL(child).host.toLowerCase())) await readSitemap(child, 1);
      }
    } else locs.push(...found);
  };
  await readSitemap(sitemapUrl.toString(), 0);
  const urls = [...new Set(locs)].filter((u) => {
    try {
      return baselineHosts().includes(new URL(u).host.toLowerCase());
    } catch {
      return false;
    }
  }).slice(0, MAX_URLS);

  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < urls.length) {
        const u = urls[next++];
        const path = normalizePath(new URL(u).pathname) ?? new URL(u).pathname;
        let row: Prisma.SeoBaselineUrlCreateManyInput = { batchId, url: u, path, source: "CRAWL" };
        try {
          const res = await fetchText(fetchImpl, u);
          row.statusCode = res.status;
          row.redirectTo = res.location;
          if (res.text) {
            const p = parseHtml(res.text, u);
            row = { ...row, title: p.title ?? null, description: p.description ?? null, canonical: p.canonical ?? null, h1: p.h1 ?? [], robots: p.robots ?? null, ogTitle: p.ogTitle ?? null, ogImage: p.ogImage ?? null };
          }
        } catch (error) {
          row.statusCode = 0;
          row.redirectTo = (error as Error).message.slice(0, 200);
        }
        await prisma.seoBaselineUrl.createMany({ data: [row], skipDuplicates: true });
        done++;
        if (done % 25 === 0) await prisma.seoImportBatch.update({ where: { id: batchId }, data: { preview: { done, total: urls.length } } });
        await sleep(PAUSE_MS);
      }
    }),
  );
  await prisma.seoImportBatch.update({ where: { id: batchId }, data: { status: "APPLIED", appliedAt: new Date(), preview: { done, total: urls.length }, result: { urls: urls.length } } });
}

/** A crawl exported from Screaming Frog (Internal → HTML) or any CSV with an address column. */
export async function uploadBaseline(csv: string, fileName: string | null, userId: string) {
  let rows: string[][];
  try {
    rows = parseCsv(csv);
  } catch (error) {
    throw new SeoError(400, (error as Error).message);
  }
  if (rows.length < 2) throw new SeoError(400, "The file needs a header row and data rows.");
  if (rows.length - 1 > 5000) throw new SeoError(400, "Up to 5,000 rows per file.");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iUrl = col("address", "url", "page", "path");
  if (iUrl < 0) throw new SeoError(400, 'No "Address" or "URL" column.');
  const iStatus = col("status code", "status");
  const iTitle = col("title 1", "title", "seo title");
  const iDesc = col("meta description 1", "meta description", "description");
  const iCanon = col("canonical link element 1", "canonical", "canonical url");
  const iRobots = col("meta robots 1", "robots", "meta robots");
  const iRedirect = col("redirect url", "redirect to", "location");
  const h1Cols = header.map((h, i) => (/^h1(-\d+)?$/.test(h) ? i : -1)).filter((i) => i >= 0);
  const batchId = `c${crypto.randomBytes(12).toString("hex")}`;
  const data: Prisma.SeoBaselineUrlCreateManyInput[] = [];
  for (const r of rows.slice(1)) {
    const raw = (r[iUrl] ?? "").trim();
    let path: string | null = null;
    try {
      path = raw.startsWith("/") ? normalizePath(raw) : normalizePath(new URL(raw).pathname);
    } catch {
      path = null;
    }
    if (!path) continue;
    const cell = (i: number) => (i >= 0 ? (r[i] ?? "").trim() || null : null);
    data.push({ batchId, url: raw, path, statusCode: Number(cell(iStatus)) || null, title: cell(iTitle), description: cell(iDesc), canonical: cell(iCanon), robots: cell(iRobots), redirectTo: cell(iRedirect), h1: h1Cols.map((i) => (r[i] ?? "").trim()).filter(Boolean), source: "UPLOAD" });
  }
  if (!data.length) throw new SeoError(400, "No usable addresses in the file.");
  await prisma.$transaction([
    prisma.seoImportBatch.create({ data: { id: batchId, kind: "BASELINE", source: "CSV", status: "APPLIED", fileName, raw: { csv }, result: { urls: data.length }, createdById: userId, appliedById: userId, appliedAt: new Date() } }),
    prisma.seoBaselineUrl.createMany({ data, skipDuplicates: true }),
    prisma.auditLog.create({ data: { userId, action: "SEO_BASELINE_UPLOADED", entityType: "SeoImportBatch", entityId: batchId, details: { fileName, urls: data.length } } }),
  ]);
  return { batchId, urls: data.length };
}

export async function baselineRuns() {
  return prisma.seoImportBatch.findMany({ where: { kind: "BASELINE" }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, source: true, status: true, fileName: true, raw: true, preview: true, result: true, createdAt: true, appliedAt: true } }).then((rows) =>
    rows.map(({ raw, ...r }) => ({ ...r, sitemapUrl: (raw as { sitemapUrl?: string }).sitemapUrl ?? null })),
  );
}

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").replace(/\s+/g, " ").trim() === (b ?? "").replace(/\s+/g, " ").trim();
const pathOf = (u: string | null | undefined) => {
  if (!u) return null;
  try {
    return normalizePath(new URL(u, "https://x.invalid").pathname);
  } catch {
    return null;
  }
};

/**
 * Old URL by old URL: does the new site keep it (same metadata?), redirect it, or lose it?
 * `check` also asks the new site for addresses it has no page row for (status only).
 */
export async function compareBaseline(batchId: string | null, opts: { check?: boolean; fetchImpl?: FetchLike } = {}) {
  const batch = batchId
    ? await prisma.seoImportBatch.findFirst({ where: { id: batchId, kind: "BASELINE" } })
    : await prisma.seoImportBatch.findFirst({ where: { kind: "BASELINE", status: "APPLIED" }, orderBy: { createdAt: "desc" } });
  if (!batch) return { batch: null, rows: [], counts: {} };
  const [baseline, pages, redirects] = await Promise.all([
    prisma.seoBaselineUrl.findMany({ where: { batchId: batch.id }, orderBy: { path: "asc" } }),
    prisma.seoPage.findMany({ select: { id: true, path: true, status: true, seoTitle: true, metaDescription: true, canonicalUrl: true, h1: true, lastCrawl: true } }),
    prisma.seoRedirect.findMany({ select: { fromPath: true, toPath: true, active: true } }),
  ]);
  const pageBy = new Map(pages.map((p) => [p.path, p]));
  const redirectBy = new Map(redirects.map((r) => [r.fromPath, r]));
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  const base = auditBaseUrl();

  const rows = await Promise.all(
    baseline.map(async (b) => {
      const page = pageBy.get(b.path);
      const redirect = redirectBy.get(b.path);
      const out = { path: b.path, oldStatus: b.statusCode, oldTitle: b.title, oldDescription: b.description, oldCanonical: b.canonical, oldH1: b.h1, pageId: page?.id ?? null, newStatus: null as number | null, state: "", differences: [] as string[], redirect: redirect ? { to: redirect.toPath, active: redirect.active } : null };
      if (b.statusCode && b.statusCode >= 300 && b.statusCode < 400) {
        out.state = "old-redirect";
        out.differences.push(`On the old site this URL redirects to ${b.redirectTo ?? "?"}; copy that redirect.`);
        return out;
      }
      if (b.statusCode !== 200) {
        out.state = "old-error";
        return out;
      }
      if (page && page.status !== "ARCHIVED") {
        const live = liveOf(page);
        out.newStatus = live?.status ?? null;
        const published = page.status === "PUBLISHED";
        const title = (published && page.seoTitle) || live?.title || null;
        const description = (published && page.metaDescription) || live?.description || null;
        const canonical = (published && page.canonicalUrl) || live?.canonical || null;
        if (!live) out.differences.push("Not audited on the new site yet.");
        else {
          if (!same(title, b.title)) out.differences.push("title");
          if (!same(description, b.description)) out.differences.push("description");
          if (b.canonical && pathOf(canonical) !== pathOf(b.canonical)) out.differences.push("canonical");
          if ((b.h1[0] ?? null) && !same(live.h1?.[0] ?? null, b.h1[0])) out.differences.push("h1");
        }
        out.state = page.status !== "PUBLISHED" && page.path.startsWith("/blog-post/") ? "unpublished" : out.differences.length ? "differs" : "same";
        return out;
      }
      if (redirect) {
        out.state = redirect.active ? "redirected" : "redirect-off";
        return out;
      }
      out.state = "missing";
      return out;
    }),
  );

  // Optionally ask the new site about URLs it has no page row for (a coded route might still serve them).
  if (opts.check) {
    const unknown = rows.filter((r) => r.state === "missing").slice(0, 300);
    let i = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (i < unknown.length) {
          const r = unknown[i++];
          try {
            const res = await fetchImpl(`${base}${r.path}`, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10_000) });
            r.newStatus = res.status;
            if (res.status === 200) r.state = "served";
          } catch {
            r.newStatus = 0;
          }
        }
      }),
    );
  }

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.state] = (counts[r.state] ?? 0) + 1;
  return { batch: { id: batch.id, source: batch.source, createdAt: batch.createdAt, fileName: batch.fileName }, rows, counts };
}

/** Latest baseline rows shaped as page-metadata import rows (to copy the live metadata into drafts). */
export async function baselineAsMetadata() {
  const batch = await prisma.seoImportBatch.findFirst({ where: { kind: "BASELINE", status: "APPLIED" }, orderBy: { createdAt: "desc" } });
  if (!batch) throw new SeoError(400, "Crawl the live site (or upload a crawl) first.");
  const rows = await prisma.seoBaselineUrl.findMany({ where: { batchId: batch.id, statusCode: 200 } });
  return { batchId: batch.id, rows: rows.map((r) => ({ ref: r.path, path: r.path, title: r.title, description: r.description, canonical: r.canonical ? (pathOf(r.canonical) ?? null) : null, ogTitle: r.ogTitle, ogDescription: null, ogImage: null })) };
}

