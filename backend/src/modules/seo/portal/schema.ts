// Structured data (JSON-LD) in the SEO portal: what each live page already carries (read from the
// audit crawl), drafts staff write, validation before anything is published, and publishing.
//
// Site-wide blocks render on every page through the root layout and replace the coded block with
// the same @id, so they need an admin (an SEO manager's publish becomes an approval request).
// Page blocks render only on CMS pages (guides, blog posts), which is where the page template is ours.

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { flattenGraph, isWebflowUrl } from "@/modules/seo/seo.audit";
import { liveOf, type CrawledJsonLd } from "@/modules/seo/seo.pages";
import { SeoError } from "@/modules/seo/seo.errors";

export const ORGANIZATION_ID = "https://www.vistachase.com/#organization";
const MAX_BYTES = 50_000;

export interface SchemaCheck {
  level: "error" | "warning" | "info";
  message: string;
}

type Node = Record<string, unknown>;
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);
const typesOf = (n: Node) => (Array.isArray(n["@type"]) ? (n["@type"] as unknown[]).map(String) : n["@type"] ? [String(n["@type"])] : []);
const isAbsoluteHttps = (v: unknown) => typeof v === "string" && /^https:\/\/[^\s]+$/.test(v);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

const BUSINESS_TYPES = new Set(["Organization", "LocalBusiness", "TouristInformationCenter", "TravelAgency", "Corporation"]);
const ARTICLE_TYPES = new Set(["Article", "BlogPosting", "NewsArticle"]);

/** Every string URL in the value (any depth), to catch Webflow CDN links anywhere in the block. */
function allUrls(v: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 10) return out;
  if (typeof v === "string" && /^https?:\/\//i.test(v)) out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allUrls(x, out, depth + 1));
  else if (isNode(v)) Object.values(v).forEach((x) => allUrls(x, out, depth + 1));
  return out;
}

const imageUrl = (v: unknown): string | null => (typeof v === "string" ? v : isNode(v) && typeof v.url === "string" ? v.url : Array.isArray(v) ? imageUrl(v[0]) : null);

/** Parses and checks a JSON-LD block. Errors block publishing; warnings are advice. */
export function validateSchema(text: string, ctx: { scope: "SITE" | "PAGE"; otherIds?: string[] } = { scope: "PAGE" }): { data: unknown | null; checks: SchemaCheck[]; types: string[]; ids: string[] } {
  const checks: SchemaCheck[] = [];
  if (Buffer.byteLength(text) > MAX_BYTES) return { data: null, checks: [{ level: "error", message: `Keep a block under ${MAX_BYTES / 1000} KB.` }], types: [], ids: [] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { data: null, checks: [{ level: "error", message: `Not valid JSON: ${(error as Error).message}` }], types: [], ids: [] };
  }
  if (!isNode(data) && !Array.isArray(data)) return { data: null, checks: [{ level: "error", message: "A JSON-LD block is an object (or a list of objects)." }], types: [], ids: [] };
  if (/<\/script/i.test(text)) checks.push({ level: "error", message: "The block can't contain </script>." });

  const tops = Array.isArray(data) ? data : [data];
  for (const top of tops) {
    if (!isNode(top)) {
      checks.push({ level: "error", message: "Every item must be an object." });
      continue;
    }
    const context = top["@context"];
    if (!(typeof context === "string" && /^https?:\/\/schema\.org\/?$/.test(context))) checks.push({ level: "error", message: '@context must be "https://schema.org".' });
  }
  const nodes = flattenGraph(data);
  if (nodes.length === 0) checks.push({ level: "error", message: "No schema nodes found." });
  const types = nodes.flatMap(typesOf);
  const ids = nodes.map((n) => n["@id"]).filter((v): v is string => typeof v === "string");

  for (const node of nodes) {
    const nodeTypes = typesOf(node);
    const label = nodeTypes.join("/") || "A node";
    if (nodeTypes.length === 0) checks.push({ level: "error", message: "Every node needs an @type." });
    if (node["@id"] !== undefined && !isAbsoluteHttps(node["@id"])) checks.push({ level: "error", message: `${label}: @id must be an absolute https URL.` });

    if (nodeTypes.some((t) => BUSINESS_TYPES.has(t))) {
      if (!node.name) checks.push({ level: "error", message: `${label}: needs a name.` });
      if (!isAbsoluteHttps(node.url)) checks.push({ level: "warning", message: `${label}: url should be the https home page address.` });
      if (ctx.scope === "SITE" && node["@id"] !== ORGANIZATION_ID) checks.push({ level: "error", message: `${label}: keep @id "${ORGANIZATION_ID}" so other schema keeps pointing at the business.` });
      const logo = imageUrl(node.logo);
      if (!logo) checks.push({ level: "info", message: `${label}: no logo. Add the logo hosted on this site (for example /media/brand/...) as a full https URL.` });
      else if (!isAbsoluteHttps(logo)) checks.push({ level: "error", message: `${label}: logo must be a full https URL.` });
      if (isNode(node.address)) {
        const a = node.address;
        for (const k of ["streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"]) if (!a[k]) checks.push({ level: "warning", message: `${label}: address has no ${k}.` });
      }
      if (node.aggregateRating) checks.push({ level: "info", message: `${label}: Google doesn't show star ratings a business publishes about itself; keep aggregateRating only if it matches real, visible reviews.` });
    }
    if (nodeTypes.some((t) => ARTICLE_TYPES.has(t))) {
      if (!node.headline) checks.push({ level: "error", message: `${label}: needs a headline.` });
      else if (String(node.headline).length > 110) checks.push({ level: "warning", message: `${label}: headline is over 110 characters.` });
      if (!(typeof node.datePublished === "string" && ISO_DATE.test(node.datePublished))) checks.push({ level: "error", message: `${label}: datePublished must be an ISO date.` });
      if (node.dateModified !== undefined && !(typeof node.dateModified === "string" && ISO_DATE.test(node.dateModified))) checks.push({ level: "error", message: `${label}: dateModified must be an ISO date.` });
      if (!node.author) checks.push({ level: "warning", message: `${label}: no author.` });
      if (!imageUrl(node.image)) checks.push({ level: "warning", message: `${label}: no image.` });
      const publisherId = isNode(node.publisher) ? node.publisher["@id"] : null;
      if (publisherId !== ORGANIZATION_ID) checks.push({ level: "warning", message: `${label}: publisher should be {"@id": "${ORGANIZATION_ID}"}.` });
    }
    if (nodeTypes.includes("BreadcrumbList")) {
      const items = Array.isArray(node.itemListElement) ? node.itemListElement : [];
      if (items.length === 0) checks.push({ level: "error", message: "BreadcrumbList: needs itemListElement." });
      items.forEach((it, i) => {
        if (!isNode(it) || it.position !== i + 1 || !it.name) checks.push({ level: "error", message: `BreadcrumbList item ${i + 1}: needs position ${i + 1} and a name.` });
      });
    }
    if (nodeTypes.includes("FAQPage")) {
      const qs = Array.isArray(node.mainEntity) ? node.mainEntity : [];
      if (qs.length === 0) checks.push({ level: "error", message: "FAQPage: needs mainEntity questions." });
      checks.push({ level: "info", message: "FAQPage: the questions and answers must be shown on the page." });
    }
  }

  const webflow = allUrls(data).filter(isWebflowUrl);
  if (webflow.length) checks.push({ level: "error", message: `Points at the Webflow CDN, which stops working when the plan ends: ${webflow.slice(0, 3).join(", ")}. Re-host the file on this site first.` });
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupIds.length) checks.push({ level: "error", message: `Defines ${[...new Set(dupIds)].join(", ")} more than once.` });
  const clash = ids.filter((id) => ctx.otherIds?.includes(id));
  if (clash.length) checks.push({ level: "error", message: `Another published block already defines ${clash.join(", ")}.` });
  return { data, checks, types: [...new Set(types)], ids };
}

const blockSelect = { id: true, scope: true, pageId: true, name: true, schemaType: true, json: true, draftJson: true, status: true, validation: true, publishedAt: true, updatedById: true, createdAt: true, updatedAt: true } as const;

/** What the live pages carry (from the last audit) plus the blocks managed here. */
export async function schemaInventory() {
  const [pages, blocks] = await Promise.all([
    prisma.seoPage.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, path: true, label: true, source: true, lastCrawl: true, lastCrawledAt: true }, orderBy: { path: "asc" } }),
    prisma.seoSchemaBlock.findMany({ where: { status: { not: "ARCHIVED" } }, select: blockSelect, orderBy: [{ scope: "asc" }, { updatedAt: "desc" }] }),
  ]);
  const live = pages.map((p) => {
    const blocksOnPage = liveOf(p)?.jsonLd ?? null;
    return {
      pageId: p.id,
      path: p.path,
      label: p.label,
      // Every published page renders its page blocks (frontend PageSeoExtras), not only guides and posts.
      editable: true,
      crawledAt: p.lastCrawledAt,
      blocks: (blocksOnPage ?? []).map((b: CrawledJsonLd) => ({ ok: b.ok, error: b.error ?? null, types: b.types, ids: b.ids, data: b.data ?? null })),
      crawled: blocksOnPage !== null,
    };
  });
  const types = new Map<string, number>();
  for (const p of live) for (const b of p.blocks) for (const t of b.types) types.set(t, (types.get(t) ?? 0) + 1);
  return {
    live,
    managed: blocks,
    summary: {
      pagesCrawled: live.filter((p) => p.crawled).length,
      pagesWithSchema: live.filter((p) => p.blocks.length > 0).length,
      invalidBlocks: live.reduce((n, p) => n + p.blocks.filter((b) => !b.ok).length, 0),
      types: Object.fromEntries([...types].sort((a, b) => b[1] - a[1])),
    },
  };
}

async function otherPublishedIds(excludeId: string | null, scope: "SITE" | "PAGE", pageId: string | null) {
  const others = await prisma.seoSchemaBlock.findMany({
    where: { status: "PUBLISHED", ...(excludeId ? { id: { not: excludeId } } : {}), ...(scope === "SITE" ? { scope: "SITE" } : { OR: [{ scope: "SITE" }, { pageId }] }) },
    select: { json: true },
  });
  return others.flatMap((o) => flattenGraph(o.json).map((n) => n["@id"]).filter((v): v is string => typeof v === "string"));
}

export async function saveSchemaDraft(id: string | null, input: { scope: "SITE" | "PAGE"; pageId?: string | null; name: string; json: string }, userId: string) {
  if (input.scope === "PAGE") {
    if (!input.pageId) throw new SeoError(400, "Choose the page this block belongs to.");
    const page = await prisma.seoPage.findUnique({ where: { id: input.pageId }, select: { status: true } });
    if (!page) throw new SeoError(404, "Page not found.");
    if (page.status === "ARCHIVED") throw new SeoError(400, "This page is archived. Restore it before adding structured data.");
  }
  const existing = id ? await prisma.seoSchemaBlock.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new SeoError(404, "Block not found.");
  const result = validateSchema(input.json, { scope: input.scope, otherIds: await otherPublishedIds(id, input.scope, input.pageId ?? null) });
  if (!result.data) throw new SeoError(422, "Fix the JSON before saving.", result.checks.map((c) => ({ field: "json", level: c.level, message: c.message })));
  const data = {
    scope: input.scope,
    pageId: input.scope === "PAGE" ? input.pageId! : null,
    name: input.name,
    schemaType: result.types.slice(0, 3).join(", ") || "Unknown",
    draftJson: result.data as Prisma.InputJsonValue,
    validation: result.checks as unknown as Prisma.InputJsonValue,
    updatedById: userId,
  };
  return prisma.$transaction(async (tx) => {
    const block = existing ? await tx.seoSchemaBlock.update({ where: { id: existing.id }, data }) : await tx.seoSchemaBlock.create({ data });
    await tx.auditLog.create({ data: { userId, action: existing ? "SEO_SCHEMA_DRAFT_UPDATED" : "SEO_SCHEMA_DRAFT_CREATED", entityType: "SeoSchemaBlock", entityId: block.id, details: { scope: block.scope, pageId: block.pageId, types: result.types } } });
    return { block, checks: result.checks };
  });
}

/** Puts the draft live. Callers check the role: SITE blocks need an admin. */
export async function publishSchema(id: string, userId: string) {
  const block = await prisma.seoSchemaBlock.findUnique({ where: { id } });
  if (!block) throw new SeoError(404, "Block not found.");
  if (!block.draftJson) throw new SeoError(400, "There's no draft to publish.");
  const result = validateSchema(JSON.stringify(block.draftJson), { scope: block.scope, otherIds: await otherPublishedIds(block.id, block.scope, block.pageId) });
  const errors = result.checks.filter((c) => c.level === "error");
  if (errors.length) throw new SeoError(422, "Fix these before publishing.", errors.map((c) => ({ field: "json", level: c.level, message: c.message })));
  return prisma.$transaction(async (tx) => {
    const updated = await tx.seoSchemaBlock.update({ where: { id }, data: { json: block.draftJson as Prisma.InputJsonValue, status: "PUBLISHED", publishedAt: new Date(), validation: result.checks as unknown as Prisma.InputJsonValue, updatedById: userId } });
    await tx.auditLog.create({ data: { userId, action: "SEO_SCHEMA_PUBLISHED", entityType: "SeoSchemaBlock", entityId: id, details: { scope: block.scope, pageId: block.pageId, previous: block.json ?? null } } });
    return updated;
  });
}

/** Takes a block off the site (the coded block comes back for SITE scope). The draft is kept. */
export async function unpublishSchema(id: string, userId: string, archive = false) {
  const block = await prisma.seoSchemaBlock.findUnique({ where: { id } });
  if (!block) throw new SeoError(404, "Block not found.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.seoSchemaBlock.update({ where: { id }, data: { status: archive ? "ARCHIVED" : "DRAFT", draftJson: (block.draftJson ?? block.json ?? undefined) as Prisma.InputJsonValue | undefined, updatedById: userId } });
    await tx.auditLog.create({ data: { userId, action: archive ? "SEO_SCHEMA_ARCHIVED" : "SEO_SCHEMA_UNPUBLISHED", entityType: "SeoSchemaBlock", entityId: id, details: { scope: block.scope, pageId: block.pageId } } });
    return updated;
  });
}

/** Published page blocks for one page (rendered by /guides, /blog-post and PageSeoExtras on every other page). */
export async function publishedPageSchema(pageId: string) {
  const blocks = await prisma.seoSchemaBlock.findMany({ where: { scope: "PAGE", pageId, status: "PUBLISHED" }, select: { json: true }, orderBy: { createdAt: "asc" } });
  return blocks.map((b) => b.json).filter(Boolean);
}
