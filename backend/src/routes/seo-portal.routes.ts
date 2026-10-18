// SEO portal API (/api/seo/portal/*, docs/SEO_PORTAL.md). Used by the /seo workspace, next to the
// existing /api/seo/admin/* routes (which the portal also calls for pages, keywords, redirects,
// audits and settings).
//
// Everyone here is signed in with an SEO role: ADMIN, SEO_MANAGER, EDITOR or VIEWER (read from the
// database on every request). Each write names the roles it needs; nothing is allowed by default.
// None of these routes touch bookings, payments, prices, inventory, customers, partners, staff
// accounts or server settings. Tracking tags, site verification and site-wide structured data are
// admin-only (an SEO manager files a change request).

import express, { Router, type NextFunction, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import { z } from "zod";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import type { UserRole } from "@/lib/auth/auth";
import { can, capabilities, EDITOR_PAGE_FIELDS, SEO_CONTENT, SEO_MANAGE, SEO_READ } from "@/lib/auth/permissions";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import prisma from "@/lib/db/prisma";
import { SeoError } from "@/modules/seo/seo.errors";
import { changeStatus, createGuide, getPage, updatePage } from "@/modules/seo/seo.pages";
import { mapKeyword, unmapKeyword } from "@/modules/seo/seo.keywords";
import { createGuideSchema, pageUpdateSchema } from "@/modules/seo/seo.validation";
import { integrationStatus } from "@/modules/seo/search-console";
import { BLOG_PREFIX } from "@/modules/seo/static-routes";
import { portalOverview } from "@/modules/seo/portal/overview";
import { blogCsv, blogOverview } from "@/modules/seo/portal/blog";
import { BULK_ACTIONS, BULK_MAX, bulkBlogAction } from "@/modules/seo/portal/bulk";
import { AI_FIELDS, generateSeoText, isAiConfigured } from "@/modules/seo/portal/ai-generate";
import { CUSTOM_CODE_MAX, parseCustomCode, saveCustomCode } from "@/modules/seo/portal/custom-code";
import { discardDraft, getDraft, publishDraft, saveDraft } from "@/modules/seo/portal/drafts";
import { getCrawlerRules, getLatestTechnical, runTechnicalChecks, saveCrawlerRules } from "@/modules/seo/portal/technical";
import { publishSchema, saveSchemaDraft, schemaInventory, unpublishSchema, validateSchema } from "@/modules/seo/portal/schema";
import { imageInventory } from "@/modules/seo/portal/images";
import { applyBatch, createPreview, discardBatch, getBatch, listBatches } from "@/modules/seo/portal/imports";
import { webflowStatus } from "@/modules/seo/portal/webflow";
import { syncWebflowBlog, webflowSyncStatus } from "@/modules/seo/portal/webflow-sync";
import { baselineRuns, compareBaseline, startBaselineCrawl, uploadBaseline } from "@/modules/seo/portal/baseline";
import { activateRedirects, redirectHistory, redirectsCsv } from "@/modules/seo/portal/redirect-tools";
import { createTask, deleteTask, listTasks, seoTeam, updateTask } from "@/modules/seo/portal/tasks";
import { listChecklist, refreshAutoChecks, updateChecklistItem } from "@/modules/seo/portal/checklist";
import { adminSettingsState, applyDirect, cancelRequest, createRequest, listRequests, requestSchema, reviewRequest } from "@/modules/seo/portal/requests";
import { changeLog, compareAudits, confirmIssue } from "@/modules/seo/portal/activity";
import { imageLibrary, uploadImage } from "@/modules/seo/portal/media";
import { addPageKeyword, pageKeywords } from "@/modules/seo/portal/page-keywords";

const router = Router();

type Handler = (req: Request, res: Response) => Promise<unknown>;

const wrap = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof SeoError) return res.status(error.status).json({ success: false, error: error.message, checks: error.checks });
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return res.status(400).json({ success: false, error: issue ? `${issue.path.join(".") || "request"}: ${issue.message}` : "Invalid request.", fields: error.flatten().fieldErrors });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return res.status(404).json({ success: false, error: "Not found." });
      if (error.code === "P2002") return res.status(409).json({ success: false, error: "That would duplicate an existing record." });
    }
    next(error);
  }
};

const id = (req: Request, name = "id") => {
  const value = String(req.params[name] ?? "");
  if (!/^[a-z0-9]{10,40}$/i.test(value)) throw new SeoError(404, "Not found.");
  return value;
};

const ADMIN_ONLY: UserRole[] = ["ADMIN"];

/** Route-level role check (the role was read from the database by the guard below). */
const need = (roles: UserRole[], message = "Your role can view this but not change it.") => (_req: Request, res: Response, next: NextFunction) => {
  if (!can(res.locals.staff.role, roles)) return res.status(403).json({ success: false, error: roles === ADMIN_ONLY ? "Only an admin can do this." : message });
  next();
};

router.use(async (req, res, next) => {
  const staff = await getAuthenticatedStaff(req, SEO_READ).catch(() => null);
  if (!staff) return res.status(req.cookies?.vc_token || req.headers.authorization ? 403 : 401).json({ success: false, error: "Sign in with an SEO, editor or admin account." });
  res.locals.staff = staff;
  res.setHeader("Cache-Control", "no-store");
  next();
});

const userId = (res: Response): string => res.locals.staff.userId;
const isAdmin = (res: Response) => res.locals.staff.role === "ADMIN";
const confirmBody = z.object({ confirm: z.boolean().optional() }).strict();

// ---------------------------------------------------------------------------------------------
// Session and overview

router.get("/me", (_req, res) => res.json({ success: true, id: res.locals.staff.userId, name: res.locals.staff.name, ...capabilities(res.locals.staff.role) }));
router.get("/overview", wrap(async (_req, res) => res.json({ success: true, overview: await portalOverview(userId(res)) })));
router.get("/team", wrap(async (_req, res) => res.json({ success: true, team: await seoTeam() })));

// ---------------------------------------------------------------------------------------------
// Page drafts (edit live pages without changing them until published)

/** Editors may draft words and images only, like the direct edit route. */
function editorFieldsOnly(req: Request, res: Response, next: NextFunction) {
  if (can(res.locals.staff.role, SEO_MANAGE)) return next();
  const blocked = Object.keys(req.body ?? {}).filter((key) => !EDITOR_PAGE_FIELDS.has(key));
  if (blocked.length > 0) return res.status(403).json({ success: false, error: `Only an SEO manager or admin can change: ${blocked.join(", ")}.` });
  next();
}

router.get("/pages/:id/draft", wrap(async (req, res) => res.json({ success: true, ...(await getDraft(id(req))) })));

router.put("/pages/:id/draft", need(SEO_CONTENT), editorFieldsOnly, wrap(async (req, res) => {
  const input = pageUpdateSchema.parse(req.body ?? {});
  return res.json({ success: true, ...(await saveDraft(id(req), input, userId(res))) });
}));

router.post("/pages/:id/draft/publish", need(SEO_MANAGE), wrap(async (req, res) => {
  const { confirmNoindex } = z.object({ confirmNoindex: z.boolean().optional() }).strict().parse(req.body ?? {});
  const result = await publishDraft(id(req), userId(res), confirmNoindex);
  return res.json({ success: true, changed: result.changed, ...(await getPage(result.page.id)) });
}));

router.delete("/pages/:id/draft", need(SEO_CONTENT), wrap(async (req, res) => {
  await discardDraft(id(req), userId(res));
  return res.json({ success: true });
}));

// ---------------------------------------------------------------------------------------------
// Blog SEO

const windowSchema = z.enum(["24h", "7d", "30d"]).optional();
const blogQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
  problem: z.string().max(40).optional(),
  featured: z.enum(["yes", "no"]).optional(),
  indexing: z.enum(["yes", "no"]).optional(),
  changes: z.enum(["draft"]).optional(),
  published: windowSchema,
  created: windowSchema,
  modified: windowSchema,
  sort: z.enum(["name", "published", "created", "modified", "status"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(5).max(100).optional(),
});

router.get("/blog", wrap(async (req, res) => res.json({ success: true, ...(await blogOverview(blogQuery.parse(req.query))) })));

router.get("/blog/export.csv", wrap(async (req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="vista-chase-blog-posts-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(await blogCsv(blogQuery.parse(req.query)));
}));

router.post("/blog", need(SEO_MANAGE), wrap(async (req, res) => {
  const input = createGuideSchema.parse(req.body ?? {});
  return res.status(201).json({ success: true, page: await createGuide(input, userId(res), BLOG_PREFIX) });
}));

/** Select mode: publish, unpublish, archive, feature or unfeature several posts. Never deletes. */
const bulkBody = z.object({ ids: z.array(z.string().regex(/^[a-z0-9]{10,40}$/i)).min(1).max(BULK_MAX), action: z.enum(BULK_ACTIONS) }).strict();
router.post("/blog/bulk", need(SEO_MANAGE), wrap(async (req, res) => {
  const { ids, action } = bulkBody.parse(req.body ?? {});
  return res.json({ success: true, ...(await bulkBlogAction(ids, action, userId(res))) });
}));

// ---------------------------------------------------------------------------------------------
// AI Generate (suggestions only; nothing is saved)

router.get("/ai/status", (_req, res) => res.json({ success: true, configured: isAiConfigured() }));

const aiText = (n: number) => z.string().max(n).optional();
const aiBody = z
  .object({
    pageId: z.string().regex(/^[a-z0-9]{10,40}$/i),
    field: z.enum(AI_FIELDS),
    draft: z.object({ label: aiText(200), h1: aiText(200), focusKeyword: aiText(120), excerpt: aiText(2000), body: aiText(100_000), seoTitle: aiText(300), metaDescription: aiText(600) }).strict().optional(),
  })
  .strict();
router.post("/ai/generate", need(SEO_MANAGE), rateLimitMiddleware("seo_ai_generate", { maxRequests: 60, windowSeconds: 3600 }), wrap(async (req, res) => {
  const { pageId, field, draft } = aiBody.parse(req.body ?? {});
  return res.json({ success: true, ...(await generateSeoText(pageId, field, draft)) });
}));

// ---------------------------------------------------------------------------------------------
// Page custom code (admin only; validated tag list, see portal/custom-code.ts)

router.post("/custom-code/check", rateLimitMiddleware("seo_custom_code_check", { maxRequests: 120, windowSeconds: 3600 }), wrap(async (req, res) => {
  const input = z.object({ head: z.string().max(CUSTOM_CODE_MAX * 2).default(""), body: z.string().max(CUSTOM_CODE_MAX * 2).default("") }).strict().parse(req.body ?? {});
  const head = parseCustomCode(input.head.trim(), "head");
  const body = parseCustomCode(input.body.trim(), "body");
  return res.json({ success: true, head: { tags: head.elements.map((e) => e.tag), errors: head.errors }, body: { tags: body.elements.map((e) => e.tag), errors: body.errors } });
}));

router.put("/pages/:id/custom-code", need(ADMIN_ONLY), wrap(async (req, res) => {
  const input = z.object({ head: z.string().max(CUSTOM_CODE_MAX * 2), body: z.string().max(CUSTOM_CODE_MAX * 2) }).strict().parse(req.body ?? {});
  return res.json({ success: true, ...(await saveCustomCode(id(req), input, userId(res))) });
}));

// ---------------------------------------------------------------------------------------------
// Technical SEO

router.get("/technical", wrap(async (_req, res) => res.json({ success: true, result: await getLatestTechnical(), crawlers: await getCrawlerRules() })));

router.post("/technical/run", need(SEO_MANAGE), rateLimitMiddleware("seo_technical", { maxRequests: 20, windowSeconds: 3600 }), wrap(async (_req, res) => {
  return res.json({ success: true, result: await runTechnicalChecks() });
}));

router.put("/crawlers", need(SEO_MANAGE), wrap(async (req, res) => {
  const input = z.object({ rules: z.record(z.string().max(40), z.enum(["allow", "block"])), confirm: z.boolean().optional() }).strict().parse(req.body ?? {});
  return res.json({ success: true, crawlers: await saveCrawlerRules(input.rules, Boolean(input.confirm), userId(res)) });
}));

// ---------------------------------------------------------------------------------------------
// Schema markup

const schemaBody = z.object({ scope: z.enum(["SITE", "PAGE"]), pageId: z.string().max(40).nullable().optional(), name: z.string().trim().min(2).max(120), json: z.string().min(2).max(50_000) }).strict();

router.get("/schema", wrap(async (_req, res) => res.json({ success: true, ...(await schemaInventory()) })));

/** Checks JSON-LD without saving it (any SEO role). */
router.post("/schema/validate", wrap(async (req, res) => {
  const input = z.object({ scope: z.enum(["SITE", "PAGE"]).default("PAGE"), json: z.string().max(50_000) }).strict().parse(req.body ?? {});
  const result = validateSchema(input.json, { scope: input.scope });
  return res.json({ success: true, checks: result.checks, types: result.types, ids: result.ids });
}));

router.post("/schema", need(SEO_MANAGE), wrap(async (req, res) => res.status(201).json({ success: true, ...(await saveSchemaDraft(null, schemaBody.parse(req.body ?? {}), userId(res))) })));
router.put("/schema/:id", need(SEO_MANAGE), wrap(async (req, res) => res.json({ success: true, ...(await saveSchemaDraft(id(req), schemaBody.parse(req.body ?? {}), userId(res))) })));

/** Page blocks: SEO manager. Site-wide blocks reach every page, so only an admin (or an approved request). */
async function schemaScopeGuard(req: Request, res: Response) {
  const block = await prisma.seoSchemaBlock.findUnique({ where: { id: id(req) }, select: { scope: true } });
  if (!block) throw new SeoError(404, "Block not found.");
  if (block.scope === "SITE" && !isAdmin(res)) throw new SeoError(403, "Site-wide structured data is published by an admin. Send it for approval instead.");
}

router.post("/schema/:id/publish", need(SEO_MANAGE), wrap(async (req, res) => {
  await schemaScopeGuard(req, res);
  return res.json({ success: true, block: await publishSchema(id(req), userId(res)) });
}));

router.post("/schema/:id/unpublish", need(SEO_MANAGE), wrap(async (req, res) => {
  await schemaScopeGuard(req, res);
  const { archive } = z.object({ archive: z.boolean().optional() }).strict().parse(req.body ?? {});
  return res.json({ success: true, block: await unpublishSchema(id(req), userId(res), Boolean(archive)) });
}));

// ---------------------------------------------------------------------------------------------
// Images (read-only)

router.get("/images", wrap(async (_req, res) => res.json({ success: true, ...(await imageInventory()) })));

// ---------------------------------------------------------------------------------------------
// Image library and uploads (featured images, Open Graph images)

router.get("/media", wrap(async (req, res) => {
  const { q } = z.object({ q: z.string().trim().max(100).optional() }).parse(req.query);
  return res.json({ success: true, ...(await imageLibrary(q)) });
}));

const uploadSchema = z
  .object({
    data: z.string().min(1, "Choose an image.").max(12_000_000, "The image is larger than 8 MB."),
    fileName: z.string().trim().min(1).max(200),
    alt: z.string().trim().max(300).nullable().optional(),
  })
  .strict();

router.post("/media", need(SEO_CONTENT), rateLimitMiddleware("seo_image_upload", { maxRequests: 60, windowSeconds: 3600 }), wrap(async (req, res) => {
  const input = uploadSchema.parse(req.body ?? {});
  return res.status(201).json({ success: true, image: await uploadImage(input, userId(res)) });
}));

// ---------------------------------------------------------------------------------------------
// Keywords by page (several keywords per page or blog post; typed keywords join the keyword sheet)

const groupSchema = z.enum(["pages", "tours", "destinations", "blog", "guides"]);

router.get("/page-keywords", wrap(async (req, res) => {
  const filter = z.object({ q: z.string().trim().max(100).optional(), group: groupSchema.optional() }).parse(req.query);
  return res.json({ success: true, ...(await pageKeywords(filter)) });
}));

const roleSchema = z.enum(["PRIMARY", "SECONDARY"]);

router.post("/pages/:id/keywords", need(SEO_MANAGE), wrap(async (req, res) => {
  const input = z.object({ keyword: z.string().trim().min(2, "Type a keyword of at least 2 characters.").max(120), role: roleSchema }).strict().parse(req.body ?? {});
  return res.status(201).json({ success: true, ...(await addPageKeyword(id(req), input, userId(res))) });
}));

async function pageMapping(req: Request) {
  const mapping = await prisma.seoKeywordMapping.findUnique({ where: { id: id(req, "mappingId") } });
  if (!mapping || mapping.pageId !== id(req)) throw new SeoError(404, "That keyword isn't on this page.");
  return mapping;
}

router.patch("/pages/:id/keywords/:mappingId", need(SEO_MANAGE), wrap(async (req, res) => {
  const { role } = z.object({ role: roleSchema }).strict().parse(req.body ?? {});
  const mapping = await pageMapping(req);
  return res.json({ success: true, ...(await mapKeyword(mapping.keywordId, mapping.pageId, role, userId(res))) });
}));

router.delete("/pages/:id/keywords/:mappingId", need(SEO_MANAGE), wrap(async (req, res) => {
  const mapping = await pageMapping(req);
  await unmapKeyword(mapping.id, userId(res));
  return res.json({ success: true });
}));

// ---------------------------------------------------------------------------------------------
// Social sharing (Open Graph) image per page. Saves straight to the page; an unpublished page row
// is published when asked, which changes nothing but the fields staff have set.

const socialSchema = z
  .object({
    ogImage: pageUpdateSchema.shape.ogImage,
    publish: z.boolean().optional(),
  })
  .strict();

router.put("/pages/:id/social-image", need(SEO_MANAGE), wrap(async (req, res) => {
  const { ogImage, publish } = socialSchema.parse(req.body ?? {});
  const pageId = id(req);
  await updatePage(pageId, { ogImage: ogImage ?? null }, userId(res));
  const current = await prisma.seoPage.findUniqueOrThrow({ where: { id: pageId }, select: { status: true } });
  if (publish && current.status !== "PUBLISHED") await changeStatus(pageId, "publish", userId(res));
  return res.json({ success: true, ...(await getPage(pageId)) });
}));

// ---------------------------------------------------------------------------------------------
// Imports (Webflow API, CSV or JSON) → preview → apply. Bodies up to 10 MB (app.ts).

const previewBody = z
  .object({
    kind: z.enum(["BLOG_POSTS", "PAGE_METADATA", "REDIRECTS"]),
    source: z.enum(["WEBFLOW_API", "CSV", "JSON", "BASELINE"]),
    text: z.string().max(10_000_000).optional(),
    fileName: z.string().trim().max(200).nullable().optional(),
    options: z.object({ dateSource: z.enum(["created", "published"]).optional(), mapLocalImages: z.boolean().optional(), useBaseline: z.boolean().optional() }).strict().optional(),
  })
  .strict();

router.get("/webflow", (_req, res) => res.json({ success: true, webflow: webflowStatus() }));
// Webflow blog sync (docs/SEO_PORTAL.md, "Webflow sync"): status for everyone, "Sync now" for SEO managers.
router.get("/webflow/sync", wrap(async (_req, res) => res.json({ success: true, sync: await webflowSyncStatus() })));
router.post("/webflow/sync", need(SEO_MANAGE), rateLimitMiddleware("seo_portal_webflow_sync", { maxRequests: 20, windowSeconds: 3600 }), wrap(async (_req, res) => {
  return res.json({ success: true, result: await syncWebflowBlog({ trigger: "MANUAL", userId: userId(res) }) });
}));
router.get("/imports", wrap(async (_req, res) => res.json({ success: true, imports: await listBatches() })));
router.get("/imports/:id", wrap(async (req, res) => res.json({ success: true, batch: await getBatch(id(req)) })));

router.post("/imports/preview", need(SEO_MANAGE), rateLimitMiddleware("seo_portal_import", { maxRequests: 30, windowSeconds: 3600 }), wrap(async (req, res) => {
  const input = previewBody.parse(req.body ?? {});
  const batch = await createPreview(input, userId(res));
  return res.status(201).json({ success: true, batch: { id: batch.id, kind: batch.kind, source: batch.source, status: batch.status, preview: batch.preview, createdAt: batch.createdAt } });
}));

router.post("/imports/:id/apply", need(SEO_MANAGE), wrap(async (req, res) => {
  const input = z.object({ publish: z.boolean().optional(), activate: z.boolean().optional(), confirm: z.boolean() }).strict().parse(req.body ?? {});
  return res.json({ success: true, result: await applyBatch(id(req), input, userId(res)) });
}));

router.post("/imports/:id/discard", need(SEO_MANAGE), wrap(async (req, res) => {
  await discardBatch(id(req), userId(res));
  return res.json({ success: true });
}));

// ---------------------------------------------------------------------------------------------
// Baseline of the live site (before migration) and comparison with the new site

router.get("/baseline", wrap(async (_req, res) => res.json({ success: true, runs: await baselineRuns() })));

router.post("/baseline/crawl", need(SEO_MANAGE), rateLimitMiddleware("seo_baseline", { maxRequests: 6, windowSeconds: 3600 }), wrap(async (req, res) => {
  const { sitemapUrl } = z.object({ sitemapUrl: z.string().url().max(300) }).strict().parse(req.body ?? {});
  return res.status(202).json({ success: true, batch: await startBaselineCrawl(sitemapUrl, userId(res)) });
}));

router.post("/baseline/upload", need(SEO_MANAGE), wrap(async (req, res) => {
  const input = z.object({ csv: z.string().min(1).max(10_000_000), fileName: z.string().trim().max(200).nullable().optional() }).strict().parse(req.body ?? {});
  return res.status(201).json({ success: true, batch: await uploadBaseline(input.csv, input.fileName ?? null, userId(res)) });
}));

router.get("/baseline/compare", rateLimitMiddleware("seo_baseline_compare", { maxRequests: 30, windowSeconds: 3600 }), wrap(async (req, res) => {
  const q = z.object({ batchId: z.string().max(40).optional(), check: z.enum(["true", "false"]).optional() }).parse(req.query);
  return res.json({ success: true, ...(await compareBaseline(q.batchId ?? null, { check: q.check === "true" })) });
}));

// ---------------------------------------------------------------------------------------------
// Redirect tools

router.post("/redirects/activate", need(SEO_MANAGE), wrap(async (req, res) => {
  const { ids, confirm } = z.object({ ids: z.array(z.string().max(40)).min(1).max(2000), confirm: z.boolean() }).strict().parse(req.body ?? {});
  if (!confirm) throw new SeoError(409, "Switching redirects on changes where visitors land. Confirm to continue.");
  return res.json({ success: true, result: await activateRedirects(ids, userId(res)) });
}));

router.get("/redirects/export.csv", wrap(async (_req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="vistachase-redirects-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(await redirectsCsv());
}));

router.get("/redirects/history", wrap(async (_req, res) => res.json({ success: true, history: await redirectHistory() })));

// ---------------------------------------------------------------------------------------------
// Tasks

const taskBody = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    category: z.string().trim().max(60).nullable().optional(),
    assigneeId: z.string().max(40).nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    path: z.string().trim().max(300).nullable().optional(),
    keywordId: z.string().max(40).nullable().optional(),
    issueId: z.string().max(40).nullable().optional(),
  })
  .strict();

router.get("/tasks", wrap(async (req, res) => {
  const q = z.object({ status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(), assigneeId: z.string().max(40).optional() }).parse(req.query);
  return res.json({ success: true, ...(await listTasks(q)) });
}));

router.post("/tasks", need(SEO_CONTENT), wrap(async (req, res) => res.status(201).json({ success: true, task: await createTask(taskBody.parse(req.body ?? {}), userId(res)) })));
router.patch("/tasks/:id", need(SEO_CONTENT), wrap(async (req, res) => res.json({ success: true, task: await updateTask(id(req), taskBody.partial().parse(req.body ?? {}), userId(res)) })));

router.delete("/tasks/:id", need(SEO_CONTENT), wrap(async (req, res) => {
  await deleteTask(id(req), userId(res), isAdmin(res));
  return res.json({ success: true });
}));

// ---------------------------------------------------------------------------------------------
// Migration checklist

router.get("/checklist", wrap(async (_req, res) => res.json({ success: true, ...(await listChecklist()) })));

router.patch("/checklist/:id", need(SEO_MANAGE), wrap(async (req, res) => {
  const input = z
    .object({
      status: z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "DONE", "NOT_APPLICABLE"]).optional(),
      notes: z.string().trim().max(5000).nullable().optional(),
      assigneeName: z.string().trim().max(120).nullable().optional(),
      addEvidence: z.string().trim().min(3).max(1000).optional(),
      removeEvidence: z.string().max(1000).optional(),
      confirm: z.boolean().optional(),
    })
    .strict()
    .parse(req.body ?? {});
  return res.json({ success: true, item: await updateChecklistItem(id(req), input, userId(res)) });
}));

router.post("/checklist/refresh", need(SEO_MANAGE), wrap(async (_req, res) => {
  await refreshAutoChecks();
  return res.json({ success: true, ...(await listChecklist()) });
}));

// ---------------------------------------------------------------------------------------------
// Admin-approved changes: Google tag, site verification, site-wide structured data

router.get("/requests", wrap(async (_req, res) => res.json({ success: true, requests: await listRequests(), state: await adminSettingsState() })));

router.post("/requests", need(SEO_MANAGE), wrap(async (req, res) => res.status(201).json({ success: true, ...(await createRequest(requestSchema.parse(req.body ?? {}), userId(res))) })));

router.post("/requests/apply", need(ADMIN_ONLY), wrap(async (req, res) => {
  const { confirm, ...rest } = (req.body ?? {}) as Record<string, unknown>;
  const input = requestSchema.parse(rest);
  return res.json({ success: true, ...(await applyDirect(input, confirm === true, userId(res))) });
}));

router.post("/requests/:id/review", need(ADMIN_ONLY), wrap(async (req, res) => {
  const input = z.object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(2000).nullable().optional() }).strict().parse(req.body ?? {});
  return res.json({ success: true, request: await reviewRequest(id(req), input.decision, input.note ?? null, userId(res)) });
}));

router.post("/requests/:id/cancel", need(SEO_MANAGE), wrap(async (req, res) => {
  confirmBody.parse(req.body ?? {});
  return res.json({ success: true, request: await cancelRequest(id(req), userId(res), isAdmin(res)) });
}));

// ---------------------------------------------------------------------------------------------
// Analytics and Search Console: connection status only, never estimated figures

router.get("/analytics", wrap(async (_req, res) => {
  const [integrations, state, metrics] = await Promise.all([integrationStatus(), adminSettingsState(), prisma.seoSearchMetric.count()]);
  return res.json({ success: true, integrations, tracking: state.tracking, verification: { set: Boolean(state.verification), matchesHandoff: state.verificationMatchesHandoff }, searchMetricRows: metrics });
}));

// ---------------------------------------------------------------------------------------------
// Change history, audit comparison and issue confirmation

router.get("/activity", wrap(async (req, res) => {
  const q = z
    .object({ entityType: z.string().max(40).regex(/^[A-Za-z]*$/).optional(), entityId: z.string().max(40).optional(), userId: z.string().max(40).optional(), q: z.string().max(60).optional(), before: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(200).optional() })
    .parse(req.query);
  return res.json({ success: true, ...(await changeLog(q)) });
}));

router.get("/audits/compare", wrap(async (req, res) => {
  const q = z.object({ from: z.string().max(40), to: z.string().max(40) }).parse(req.query);
  return res.json({ success: true, comparison: await compareAudits(q.from, q.to) });
}));

router.post("/issues/:id/confirm", need(SEO_MANAGE), wrap(async (req, res) => {
  const { note } = z.object({ note: z.string().trim().max(2000).nullable().optional() }).strict().parse(req.body ?? {});
  return res.json({ success: true, issue: await confirmIssue(id(req), note ?? null, userId(res)) });
}));

/**
 * Large uploads (imports and crawl files) get a 10 MB JSON limit instead of the API's 1 MB, but only
 * for a signed-in SEO manager or admin: anyone else falls through to the normal 1 MB parser (and
 * then the route's own 401/403). Mounted in app.ts before the global JSON parser.
 */
export const LARGE_BODY_PATHS = ["/api/seo/portal/imports/preview", "/api/seo/portal/baseline/upload"];
const largeJson = express.json({ limit: "10mb" });
const parseCookies = cookieParser();
export const largeBodyForSeoManagers = [
  parseCookies,
  async (req: Request, res: Response, next: NextFunction) => {
    const staff = await getAuthenticatedStaff(req, SEO_MANAGE).catch(() => null);
    if (!staff) return next();
    return largeJson(req, res, next);
  },
];

/** Image uploads (an 8 MB image is about 11 MB as base64 JSON): staff who may edit page content only. */
export const IMAGE_UPLOAD_PATH = "/api/seo/portal/media";
const uploadJson = express.json({ limit: "12mb" });
export const largeBodyForImageUploads = [
  parseCookies,
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "POST") return next();
    const staff = await getAuthenticatedStaff(req, SEO_CONTENT).catch(() => null);
    if (!staff) return next();
    return uploadJson(req, res, next);
  },
];

export default router;
