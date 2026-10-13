// SEO pages: the registry of public URLs (synced from code routes, tours and destinations), their
// metadata overrides, publishing and the change log. Overrides only apply while a page is
// PUBLISHED; a page row with empty fields changes nothing on the site.

import type { Prisma, SeoPage, SeoPublishStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { GUIDE_PREFIX, STATIC_ROUTES } from "@/modules/seo/static-routes";
import { checkPage, completeness, type FieldCheck, type PageUpdateInput } from "@/modules/seo/seo.validation";
import { findRedirectLoop } from "@/modules/seo/seo.redirects";
import { SeoError } from "@/modules/seo/seo.errors";

export { SeoError };

type Tx = Prisma.TransactionClient;

export interface LiveCrawl {
  status?: number;
  title?: string | null;
  description?: string | null;
  h1?: string[];
  canonical?: string | null;
  robots?: string | null;
  ogTitle?: string | null;
  ogImage?: string | null;
  wordCount?: number;
  internalLinks?: number;
  error?: string;
}

export const liveOf = (page: Pick<SeoPage, "lastCrawl">): LiveCrawl | null => (page.lastCrawl as LiveCrawl | null) ?? null;

export function checksFor(page: SeoPage): FieldCheck[] {
  return checkPage({ ...page, live: liveOf(page) });
}

// ---------------------------------------------------------------------------------------------
// Registry sync

/** Adds a row for every code route, tour and destination that has none. Never edits or removes rows. */
export async function syncPages(userId?: string) {
  const [existing, tours, destinations] = await Promise.all([
    prisma.seoPage.findMany({ select: { path: true, tourId: true, destinationId: true } }),
    prisma.tour.findMany({ select: { id: true, slug: true, title: true } }),
    prisma.destination.findMany({ select: { id: true, slug: true, name: true } }),
  ]);
  const paths = new Set(existing.map((p) => p.path));
  const tourIds = new Set(existing.map((p) => p.tourId).filter(Boolean));
  const destinationIds = new Set(existing.map((p) => p.destinationId).filter(Boolean));
  const now = new Date();

  const rows: Prisma.SeoPageCreateManyInput[] = [];
  for (const r of STATIC_ROUTES) {
    if (paths.has(r.path)) continue;
    rows.push({
      path: r.path,
      label: r.label,
      pageType: r.pageType,
      source: "STATIC_ROUTE",
      status: "PUBLISHED",
      publishedAt: now,
      important: r.important ?? false,
      conversionGoal: r.conversionGoal ?? "NONE",
      sitemapPriority: r.sitemapPriority ?? null,
      createdById: userId,
    });
    paths.add(r.path);
  }
  for (const t of tours) {
    const path = `/${t.slug}`;
    if (tourIds.has(t.id) || paths.has(path)) continue;
    rows.push({ path, label: t.title, pageType: "TOUR", source: "TOUR", tourId: t.id, status: "PUBLISHED", publishedAt: now, important: true, conversionGoal: "BOOKING", createdById: userId });
    paths.add(path);
  }
  for (const d of destinations) {
    const path = `/destinations/${d.slug}`;
    if (destinationIds.has(d.id) || paths.has(path)) continue;
    rows.push({ path, label: d.name, pageType: "DESTINATION", source: "DESTINATION", destinationId: d.id, status: "PUBLISHED", publishedAt: now, conversionGoal: "BOOKING", createdById: userId });
    paths.add(path);
  }
  if (rows.length > 0) await prisma.seoPage.createMany({ data: rows, skipDuplicates: true });
  return { added: rows.length };
}

// ---------------------------------------------------------------------------------------------
// Reading

export const PAGE_TYPE_FILTERS = ["HOME", "TOUR", "DESTINATION", "LANDING", "GUIDE", "STATIC", "LEGAL"] as const;

export async function listPages(filter: { q?: string; pageType?: string; status?: string; clusterId?: string; missing?: string }) {
  const where: Prisma.SeoPageWhereInput = {};
  if (filter.pageType) where.pageType = filter.pageType as SeoPage["pageType"];
  if (filter.status) where.status = filter.status as SeoPublishStatus;
  if (filter.q) where.OR = [{ path: { contains: filter.q, mode: "insensitive" } }, { label: { contains: filter.q, mode: "insensitive" } }, { focusKeyword: { contains: filter.q, mode: "insensitive" } }];
  if (filter.clusterId) where.mappings = { some: { keyword: { clusterId: filter.clusterId } } };

  const pages = await prisma.seoPage.findMany({
    where,
    orderBy: [{ pageType: "asc" }, { path: "asc" }],
    include: {
      _count: { select: { mappings: true, issues: { where: { status: "OPEN" } } } },
      mappings: { where: { role: "PRIMARY" }, select: { keyword: { select: { keyword: true } } }, take: 3 },
    },
  });

  const rows = pages.map((p) => {
    const live = liveOf(p);
    const checks = checksFor(p);
    return {
      id: p.id,
      path: p.path,
      label: p.label,
      pageType: p.pageType,
      source: p.source,
      status: p.status,
      publishAt: p.publishAt,
      important: p.important,
      robotsIndex: p.robotsIndex,
      focusKeyword: p.focusKeyword,
      primaryKeywords: p.mappings.map((m) => m.keyword.keyword),
      title: p.seoTitle ?? live?.title ?? null,
      titleFromOverride: !!p.seoTitle,
      description: p.metaDescription ?? live?.description ?? null,
      descriptionFromOverride: !!p.metaDescription,
      liveStatus: live?.status ?? null,
      lastCrawledAt: p.lastCrawledAt,
      completeness: completeness({ ...p, live }),
      warnings: checks.filter((c) => c.level !== "info").length,
      errors: checks.filter((c) => c.level === "error").length,
      keywordCount: p._count.mappings,
      openIssues: p._count.issues,
      updatedAt: p.updatedAt,
    };
  });

  if (filter.missing) {
    const field = filter.missing;
    return rows.filter((r) => {
      const page = pages.find((p) => p.id === r.id)!;
      const live = liveOf(page);
      if (field === "title") return !r.title;
      if (field === "description") return !r.description;
      if (field === "h1") return !(page.h1 ?? live?.h1?.[0]);
      if (field === "canonical") return !(page.canonicalUrl ?? live?.canonical);
      if (field === "focusKeyword") return !page.focusKeyword;
      return true;
    });
  }
  return rows;
}

export async function getPage(id: string) {
  const page = await prisma.seoPage.findUnique({
    where: { id },
    include: {
      tour: { select: { title: true, metaTitle: true, metaDescription: true, summary: true, featuredImage: true, faqs: true } },
      destination: { select: { name: true, metaTitle: true, metaDescription: true, description: true, heroImage: true } },
      mappings: { include: { keyword: { select: { id: true, keyword: true, intent: true, funnelStage: true, track: true, searchVolume: true, volumeBasis: true, archivedAt: true } } } },
      revisions: { orderBy: { createdAt: "desc" }, take: 30 },
      issues: { where: { status: "OPEN" }, orderBy: { severity: "asc" } },
    },
  });
  if (!page) return null;
  const live = liveOf(page);
  // What the page shows when a field has no override: the tour / destination record, else the
  // last audit of the live page.
  const defaults = {
    title: page.tour ? page.tour.metaTitle ?? `${page.tour.title} | Vista Chase` : page.destination ? page.destination.metaTitle ?? null : live?.title ?? null,
    description: page.tour ? page.tour.metaDescription ?? page.tour.summary : page.destination ? page.destination.metaDescription ?? page.destination.description.slice(0, 160) : live?.description ?? null,
    h1: live?.h1?.[0] ?? page.tour?.title ?? page.destination?.name ?? null,
    canonical: live?.canonical ?? page.path,
    image: page.tour?.featuredImage ?? page.destination?.heroImage ?? live?.ogImage ?? null,
  };
  const checks = checkPage({ ...page, live: { ...live, title: live?.title ?? defaults.title, description: live?.description ?? defaults.description, h1: live?.h1 ?? (defaults.h1 ? [defaults.h1] : null) } });
  const { tour: _tour, destination: _destination, ...rest } = page;
  return { page: rest, live, defaults, checks, completeness: completeness({ ...page, live }) };
}

// ---------------------------------------------------------------------------------------------
// Writing

const TRACKED_FIELDS = [
  "label", "important", "seoTitle", "metaDescription", "h1", "focusKeyword", "secondaryKeywords", "canonicalUrl", "robotsIndex", "robotsFollow",
  "ogTitle", "ogDescription", "ogImage", "twitterTitle", "twitterDescription", "twitterImage", "breadcrumbLabel", "excerpt", "body",
  "answerSnippet", "citationFact", "faqs", "authorName", "authorBio", "reviewedAt", "featuredImage", "featuredImageAlt", "imageTitle",
  "imageCaption", "imageFileName", "ctaText", "ctaUrl", "conversionGoal", "utmSource", "utmMedium", "utmCampaign", "pillar", "tags",
  "relatedPaths", "sitemapPriority", "path",
] as const;

function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of TRACKED_FIELDS) {
    if (!(key in after)) continue;
    const a = before[key] instanceof Date ? (before[key] as Date).toISOString() : before[key];
    const b = after[key] instanceof Date ? (after[key] as Date).toISOString() : after[key];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
      // Long text: keep the change log readable and small.
      const short = (v: unknown) => (typeof v === "string" && v.length > 400 ? `${v.slice(0, 400)}…` : v);
      changes[key] = { from: short(a ?? null), to: short(b ?? null) };
    }
  }
  return changes;
}

async function audit(tx: Tx, userId: string, action: string, entityId: string, details: object) {
  await tx.auditLog.create({ data: { userId, action, entityType: "SeoPage", entityId, details: details as Prisma.InputJsonValue } });
}

/** Saves metadata. A published page goes live at once, so its blocking checks must pass first. */
export async function updatePage(id: string, input: PageUpdateInput, userId: string) {
  const current = await prisma.seoPage.findUnique({ where: { id } });
  if (!current) throw new SeoError(404, "Page not found.");
  const { slug, confirmNoindex, ...fields } = input;
  const isCms = current.source === "CMS";

  if (fields.body !== undefined && !isCms) throw new SeoError(400, "Body content can only be edited on guide pages; this page's content lives in its code or tour record.");

  let newPath: string | null = null;
  if (slug !== undefined) {
    if (!isCms) throw new SeoError(400, "This page's address comes from the site's code or the tour record, so it can't be changed here.");
    newPath = `${GUIDE_PREFIX}${slug}`;
    if (newPath === current.path) newPath = null;
    else if (await prisma.seoPage.findUnique({ where: { path: newPath } })) throw new SeoError(409, `Another page already uses ${newPath}.`);
  }

  const next = { ...current, ...fields, ...(newPath ? { path: newPath } : {}) } as SeoPage;
  const important = next.important || next.pageType === "HOME" || next.pageType === "TOUR";
  if (current.robotsIndex && next.robotsIndex === false && important && !confirmNoindex) {
    throw new SeoError(409, "This is a key page. Setting it to noindex removes it from search results; confirm to continue.");
  }
  const checks = checksFor(next);
  if ((current.status === "PUBLISHED" || current.status === "SCHEDULED") && checks.some((c) => c.level === "error")) {
    throw new SeoError(422, "This page is live (or scheduled), so these problems must be fixed before saving.", checks.filter((c) => c.level === "error"));
  }

  const changes = diff(current as unknown as Record<string, unknown>, { ...fields, ...(newPath ? { path: newPath } : {}) } as Record<string, unknown>);
  if (Object.keys(changes).length === 0) return { page: current, changed: false };

  const page = await prisma.$transaction(async (tx) => {
    const updated = await tx.seoPage.update({
      where: { id },
      data: { ...(fields as Prisma.SeoPageUpdateInput), ...(newPath ? { path: newPath } : {}), updatedById: userId },
    });
    if (newPath) await moveRedirects(tx, current.path, newPath, current.publishedAt !== null, userId);
    await tx.seoPageRevision.create({ data: { pageId: id, userId, action: "UPDATED", changes: changes as Prisma.InputJsonValue } });
    await audit(tx, userId, "SEO_PAGE_UPDATED", id, { path: updated.path, fields: Object.keys(changes) });
    return updated;
  });
  return { page, changed: true };
}

/**
 * A guide's address changed: the old address 301s to the new one (if it was ever public), existing
 * redirects that pointed at the old address point at the new one (no chains), and a redirect that
 * started at the new address is removed because a page lives there now.
 */
async function moveRedirects(tx: Tx, oldPath: string, newPath: string, wasPublic: boolean, userId: string) {
  await tx.seoRedirect.deleteMany({ where: { fromPath: newPath } });
  await tx.seoRedirect.updateMany({ where: { toPath: oldPath }, data: { toPath: newPath } });
  if (!wasPublic) return;
  const active = await tx.seoRedirect.findMany({ where: { active: true }, select: { fromPath: true, toPath: true } });
  if (findRedirectLoop(oldPath, newPath, active)) throw new SeoError(409, "That address change would create a redirect loop.");
  await tx.seoRedirect.upsert({
    where: { fromPath: oldPath },
    create: { fromPath: oldPath, toPath: newPath, statusCode: 301, source: "SLUG_CHANGE", note: "Guide address changed", createdById: userId },
    update: { toPath: newPath, statusCode: 301, active: true, source: "SLUG_CHANGE" },
  });
}

export async function createGuide(input: { label: string; slug: string; focusKeyword?: string | null }, userId: string) {
  const path = `${GUIDE_PREFIX}${input.slug}`;
  if (await prisma.seoPage.findUnique({ where: { path } })) throw new SeoError(409, `A page already uses ${path}.`);
  if (await prisma.seoRedirect.findFirst({ where: { fromPath: path, active: true } })) throw new SeoError(409, `${path} is the source of an active redirect. Remove the redirect first.`);
  return prisma.$transaction(async (tx) => {
    const page = await tx.seoPage.create({
      data: { path, label: input.label, pageType: "GUIDE", source: "CMS", status: "DRAFT", focusKeyword: input.focusKeyword ?? null, conversionGoal: "ENQUIRY", createdById: userId, updatedById: userId },
    });
    await tx.seoPageRevision.create({ data: { pageId: page.id, userId, action: "CREATED", changes: { path: { from: null, to: path } } } });
    await audit(tx, userId, "SEO_PAGE_CREATED", page.id, { path });
    return page;
  });
}

/** publish / unpublish / schedule / archive, with the same blocking checks as saving. */
export async function changeStatus(id: string, action: "publish" | "unpublish" | "schedule" | "archive", userId: string, opts: { publishAt?: Date; confirmNoindex?: boolean } = {}) {
  const page = await prisma.seoPage.findUnique({ where: { id } });
  if (!page) throw new SeoError(404, "Page not found.");

  let status: SeoPublishStatus;
  let publishAt: Date | null = page.publishAt;
  if (action === "publish" || action === "schedule") {
    const errors = checksFor(page).filter((c) => c.level === "error");
    if (errors.length > 0) throw new SeoError(422, "Fix these before publishing.", errors);
    const important = page.important || page.pageType === "HOME" || page.pageType === "TOUR";
    if (!page.robotsIndex && important && !opts.confirmNoindex) throw new SeoError(409, "This key page is set to noindex. Confirm to publish it that way.");
    if (action === "schedule") {
      if (!opts.publishAt || opts.publishAt.getTime() <= Date.now() + 60_000) throw new SeoError(400, "Pick a publish time in the future.");
      status = "SCHEDULED";
      publishAt = opts.publishAt;
    } else {
      status = "PUBLISHED";
      publishAt = null;
    }
  } else if (action === "unpublish") {
    status = "DRAFT";
    publishAt = null;
  } else {
    status = "ARCHIVED";
    publishAt = null;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.seoPage.update({
      where: { id },
      data: { status, publishAt, ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}), updatedById: userId },
    });
    await tx.seoPageRevision.create({
      data: { pageId: id, userId, action: { publish: "PUBLISHED", unpublish: "UNPUBLISHED", schedule: "SCHEDULED", archive: "ARCHIVED" }[action], changes: { status: { from: page.status, to: status }, ...(publishAt ? { publishAt: { from: null, to: publishAt.toISOString() } } : {}) } },
    });
    await audit(tx, userId, `SEO_PAGE_${action.toUpperCase()}`, id, { path: page.path, from: page.status, to: status });
    return updated;
  });
}

/** Scheduled pages whose time has come go live (worker / in-process job). Blocked ones stay scheduled and show an issue. */
export async function publishDuePages(now = new Date()) {
  const due = await prisma.seoPage.findMany({ where: { status: "SCHEDULED", publishAt: { lte: now } } });
  let published = 0;
  let blocked = 0;
  for (const page of due) {
    if (checksFor(page).some((c) => c.level === "error")) {
      blocked++;
      continue;
    }
    const done = await prisma.seoPage.updateMany({ where: { id: page.id, status: "SCHEDULED" }, data: { status: "PUBLISHED", publishedAt: now, publishAt: null } });
    if (done.count === 1) {
      published++;
      await prisma.seoPageRevision.create({ data: { pageId: page.id, action: "PUBLISHED", changes: { status: { from: "SCHEDULED", to: "PUBLISHED" } }, note: "Scheduled publish" } });
    }
  }
  return { published, blocked };
}
