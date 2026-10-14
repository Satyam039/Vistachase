// SEO API (docs/SEO.md).
//
// /api/seo/public/*  read-only, what the public site needs: published overrides, published guides,
//                    sitemap entries, redirects and llms.txt. No drafts, research or audit data.
// /api/seo/admin/*   the SEO workspace. Reads: ADMIN, SEO_MANAGER, EDITOR, VIEWER. Writes: ADMIN and
//                    SEO_MANAGER, except page content (EDITOR may change the words and images of a
//                    page or guide, not its indexing, URL or status). See lib/auth/permissions.ts.
//                    Every write is validated with zod (unknown fields refused) and audited.

import { Router, type NextFunction, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import { capabilities, can, EDITOR_PAGE_FIELDS, SEO_CONTENT, SEO_MANAGE, SEO_READ } from "@/lib/auth/permissions";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { SeoError } from "@/modules/seo/seo.errors";
import { changeStatus, checksFor, createGuide, getPage, listPages, syncPages, updatePage } from "@/modules/seo/seo.pages";
import {
  bulkUpdateKeywords,
  commitImport,
  createKeyword,
  IMPORT_FIELDS,
  exportKeywordsCsv,
  listClusters,
  listKeywords,
  mapKeyword,
  previewImport,
  saveCluster,
  setArchived,
  unmapKeyword,
  updateKeyword,
} from "@/modules/seo/seo.keywords";
import { createRedirect, deleteRedirect, listRedirects, updateRedirect } from "@/modules/seo/seo.redirects";
import { runAudit } from "@/modules/seo/seo.audit";
import { overview } from "@/modules/seo/seo.overview";
import { bootstrapSeo } from "@/modules/seo/seo.bootstrap";
import { getSettings, saveSettings } from "@/modules/seo/seo.settings";
import { integrationStatus } from "@/modules/seo/search-console";
import { activeRedirectMap, llmsTxt, publicGuide, publicGuides, publicMeta, sitemapEntries } from "@/modules/seo/seo.public";
import {
  clusterSchema,
  createGuideSchema,
  keywordBulkSchema,
  keywordCreateSchema,
  keywordListQuery,
  keywordUpdateSchema,
  mappingSchema,
  pageUpdateSchema,
  publishSchema,
  redirectSchema,
  redirectUpdateSchema,
  siteSettingsSchema,
} from "@/modules/seo/seo.validation";

const router = Router();

type Handler = (req: Request, res: Response) => Promise<unknown>;

/** Turns SeoError, validation and Prisma errors into plain-words replies; anything else is a 500. */
const wrap = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof SeoError) return res.status(error.status).json({ success: false, error: error.message, checks: error.checks });
    if (error instanceof z.ZodError) return invalid(res, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return res.status(404).json({ success: false, error: "Not found." });
      if (error.code === "P2002") return res.status(409).json({ success: false, error: "That would duplicate an existing record." });
    }
    next(error);
  }
};

function invalid(res: Response, error: z.ZodError) {
  const issue = error.issues[0];
  return res.status(400).json({
    success: false,
    error: issue ? `${issue.path.join(".") || "request"}: ${issue.message}` : "Invalid request.",
    fields: error.flatten().fieldErrors,
  });
}

const id = (req: Request) => {
  const value = String(req.params.id ?? "");
  if (!/^[a-z0-9]{10,40}$/i.test(value)) throw new SeoError(404, "Not found.");
  return value;
};

// ---------------------------------------------------------------------------------------------
// Public (read-only, cacheable for a minute)

const publicCache = (res: Response) => res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
const publicLimit = rateLimitMiddleware("seo_public", { maxRequests: 600, windowSeconds: 60 });

router.get("/public/meta", publicLimit, wrap(async (req, res) => {
  const path = z.string().max(300).parse(req.query.path ?? "");
  publicCache(res);
  return res.json({ success: true, meta: await publicMeta(path) });
}));

router.get("/public/guides", publicLimit, wrap(async (_req, res) => {
  publicCache(res);
  return res.json({ success: true, guides: await publicGuides() });
}));

router.get("/public/guides/:slug", publicLimit, wrap(async (req, res) => {
  const guide = await publicGuide(String(req.params.slug ?? ""));
  if (!guide) return res.status(404).json({ success: false, error: "Not found." });
  publicCache(res);
  return res.json({ success: true, guide });
}));

router.get("/public/sitemap", publicLimit, wrap(async (_req, res) => {
  publicCache(res);
  return res.json({ success: true, entries: await sitemapEntries() });
}));

router.get("/public/redirects", publicLimit, wrap(async (_req, res) => {
  publicCache(res);
  return res.json({ success: true, redirects: await activeRedirectMap() });
}));

router.get("/public/llms.txt", publicLimit, wrap(async (req, res) => {
  let origin: string;
  try {
    const url = new URL(String(req.query.origin ?? ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    origin = url.origin;
  } catch {
    return res.status(400).type("text/plain").send("origin must be the site's http(s) address");
  }
  const text = await llmsTxt(origin);
  if (!text) return res.status(404).type("text/plain").send("Not found");
  publicCache(res);
  return res.type("text/plain; charset=utf-8").send(text);
}));

// ---------------------------------------------------------------------------------------------
// Admin

// Writes an EDITOR may make (page and guide content). Every other write needs SEO_MANAGE.
const CONTENT_WRITES: [string, RegExp][] = [
  ["POST", /^\/admin\/pages\/?$/],
  ["PATCH", /^\/admin\/pages\/[^/]+\/?$/],
  ["POST", /^\/admin\/pages\/[^/]+\/validate\/?$/],
];

router.use("/admin", async (req, res, next) => {
  const staff = await getAuthenticatedStaff(req, SEO_READ).catch(() => null);
  if (!staff) return res.status(req.cookies?.vc_token || req.headers.authorization ? 403 : 401).json({ success: false, error: "Sign in with an SEO, editor or admin account." });
  if (req.method !== "GET" && req.method !== "HEAD") {
    const path = `/admin${req.path}`;
    const contentWrite = CONTENT_WRITES.some(([method, pattern]) => method === req.method && pattern.test(path));
    if (!can(staff.role, contentWrite ? SEO_CONTENT : SEO_MANAGE)) {
      return res.status(403).json({ success: false, error: "Your role can view this but not change it." });
    }
    // Editors change words and images only, never indexing, canonicals, slugs or schedules.
    if (contentWrite && req.method === "PATCH" && !can(staff.role, SEO_MANAGE)) {
      const blocked = Object.keys(req.body ?? {}).filter((key) => !EDITOR_PAGE_FIELDS.has(key));
      if (blocked.length > 0) return res.status(403).json({ success: false, error: `Only an SEO manager or admin can change: ${blocked.join(", ")}.` });
    }
  }
  res.locals.staff = staff;
  // Admin data is per-user and never cached.
  res.setHeader("Cache-Control", "no-store");
  next();
});

const userId = (res: Response): string => res.locals.staff.userId;

router.get("/admin/me", (_req, res) => res.json({ success: true, name: res.locals.staff.name, ...capabilities(res.locals.staff.role) }));

router.get("/admin/overview", wrap(async (_req, res) => res.json({ success: true, overview: await overview() })));

router.post("/admin/bootstrap", wrap(async (_req, res) => {
  const result = await bootstrapSeo(userId(res));
  await prisma.auditLog.create({ data: { userId: userId(res), action: "SEO_BOOTSTRAPPED", entityType: "SeoPage", entityId: "bootstrap", details: result } });
  return res.json({ success: true, result });
}));

// Pages

router.post("/admin/pages/sync", wrap(async (_req, res) => res.json({ success: true, result: await syncPages(userId(res)) })));

const pageFilter = z.object({
  q: z.string().trim().max(100).optional(),
  pageType: z.enum(["HOME", "TOUR", "DESTINATION", "LANDING", "GUIDE", "STATIC", "LEGAL"]).optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
  clusterId: z.string().max(40).optional(),
  missing: z.enum(["title", "description", "h1", "canonical", "focusKeyword"]).optional(),
});

router.get("/admin/pages", wrap(async (req, res) => res.json({ success: true, pages: await listPages(pageFilter.parse(req.query)) })));

router.post("/admin/pages", wrap(async (req, res) => {
  const input = createGuideSchema.parse(req.body ?? {});
  return res.status(201).json({ success: true, page: await createGuide(input, userId(res)) });
}));

router.get("/admin/pages/:id", wrap(async (req, res) => {
  const page = await getPage(id(req));
  if (!page) return res.status(404).json({ success: false, error: "Page not found." });
  return res.json({ success: true, ...page });
}));

router.patch("/admin/pages/:id", wrap(async (req, res) => {
  const input = pageUpdateSchema.parse(req.body ?? {});
  const result = await updatePage(id(req), input, userId(res));
  const detail = await getPage(result.page.id);
  return res.json({ success: true, changed: result.changed, ...detail });
}));

/** Checks an edit without saving it (the editor's "Check" before publishing). */
router.post("/admin/pages/:id/validate", wrap(async (req, res) => {
  const input = pageUpdateSchema.parse(req.body ?? {});
  const page = await prisma.seoPage.findUnique({ where: { id: id(req) } });
  if (!page) return res.status(404).json({ success: false, error: "Page not found." });
  const { slug: _slug, confirmNoindex: _c, ...fields } = input;
  return res.json({ success: true, checks: checksFor({ ...page, ...fields } as typeof page) });
}));

router.post("/admin/pages/:id/status", wrap(async (req, res) => {
  const input = publishSchema.parse(req.body ?? {});
  await changeStatus(id(req), input.action, userId(res), { publishAt: input.publishAt, confirmNoindex: input.confirmNoindex });
  return res.json({ success: true, ...(await getPage(id(req))) });
}));

// Keywords and clusters

router.get("/admin/keywords", wrap(async (req, res) => res.json({ success: true, ...(await listKeywords(keywordListQuery.parse(req.query))) })));

router.post("/admin/keywords", wrap(async (req, res) => {
  const input = keywordCreateSchema.parse(req.body ?? {});
  return res.status(201).json({ success: true, keyword: await createKeyword(input, userId(res)) });
}));

router.post("/admin/keywords/bulk", wrap(async (req, res) => {
  const input = keywordBulkSchema.parse(req.body ?? {});
  return res.json({ success: true, result: await bulkUpdateKeywords(input, userId(res)) });
}));

router.patch("/admin/keywords/:id", wrap(async (req, res) => {
  const input = keywordUpdateSchema.parse(req.body ?? {});
  return res.json({ success: true, keyword: await updateKeyword(id(req), input, userId(res)) });
}));

router.post("/admin/keywords/:id/archive", wrap(async (req, res) => {
  const { archived } = z.object({ archived: z.boolean() }).strict().parse(req.body ?? {});
  return res.json({ success: true, keyword: await setArchived(id(req), archived, userId(res)) });
}));

router.post("/admin/keywords/:id/mappings", wrap(async (req, res) => {
  const input = mappingSchema.parse(req.body ?? {});
  return res.json({ success: true, ...(await mapKeyword(id(req), input.pageId, input.role, userId(res))) });
}));

router.delete("/admin/mappings/:id", wrap(async (req, res) => {
  await unmapKeyword(id(req), userId(res));
  return res.json({ success: true });
}));

router.get("/admin/keywords/export.csv", wrap(async (req, res) => {
  const csv = await exportKeywordsCsv(req.query.includeArchived === "true");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="vistachase-keywords-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(csv);
}));

const importSchema = z
  .object({
    csv: z.string().min(1, "Choose a CSV file.").max(1_000_000, "The file is larger than 1 MB."),
    mode: z.enum(["skip", "update"]).default("skip"),
    track: z.enum(["TRAFFIC_ACQUISITION", "BOOKING_CONVERSION"]).optional(),
    dataSource: z.string().trim().max(200).optional(),
    columnMap: z
      .record(z.string().max(200), z.enum(["ignore", ...IMPORT_FIELDS] as [string, ...string[]]))
      .refine((m) => Object.keys(m).length <= 100, "Too many columns.")
      .optional(),
  })
  .strict();

const importDefaults = (input: z.infer<typeof importSchema>) => ({ track: input.track, dataSource: input.dataSource, columnMap: input.columnMap });

router.post("/admin/keywords/import/preview", wrap(async (req, res) => {
  const input = importSchema.parse(req.body ?? {});
  const { parsed: _parsed, ...preview } = await previewImport(input.csv, input.mode, importDefaults(input));
  return res.json({ success: true, preview });
}));

router.post("/admin/keywords/import", rateLimitMiddleware("seo_import", { maxRequests: 20, windowSeconds: 3600 }), wrap(async (req, res) => {
  const input = importSchema.parse(req.body ?? {});
  return res.json({ success: true, result: await commitImport(input.csv, input.mode, userId(res), importDefaults(input)) });
}));

router.get("/admin/clusters", wrap(async (_req, res) => res.json({ success: true, clusters: await listClusters() })));

router.post("/admin/clusters", wrap(async (req, res) => {
  const input = clusterSchema.parse(req.body ?? {});
  return res.status(201).json({ success: true, cluster: await saveCluster(null, input, userId(res)) });
}));

router.patch("/admin/clusters/:id", wrap(async (req, res) => {
  const input = clusterSchema.parse(req.body ?? {});
  return res.json({ success: true, cluster: await saveCluster(id(req), input, userId(res)) });
}));

// Redirects

router.get("/admin/redirects", wrap(async (_req, res) => res.json({ success: true, redirects: await listRedirects() })));

router.post("/admin/redirects", wrap(async (req, res) => {
  const input = redirectSchema.parse(req.body ?? {});
  return res.status(201).json({ success: true, redirect: await createRedirect(input, userId(res)) });
}));

router.patch("/admin/redirects/:id", wrap(async (req, res) => {
  const input = redirectUpdateSchema.parse(req.body ?? {});
  return res.json({ success: true, redirect: await updateRedirect(id(req), input, userId(res)) });
}));

router.delete("/admin/redirects/:id", wrap(async (req, res) => {
  await deleteRedirect(id(req), userId(res));
  return res.json({ success: true });
}));

// Audits and issues

const issueQuery = z.object({
  status: z.enum(["OPEN", "IGNORED", "RESOLVED"]).default("OPEN"),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  type: z.string().max(60).regex(/^[A-Z_]*$/).optional(),
  pageId: z.string().max(40).optional(),
});

router.get("/admin/issues", wrap(async (req, res) => {
  const q = issueQuery.parse(req.query);
  const issues = await prisma.seoIssue.findMany({
    where: { status: q.status, ...(q.severity ? { severity: q.severity } : {}), ...(q.type ? { type: q.type } : {}), ...(q.pageId ? { pageId: q.pageId } : {}) },
    orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
    take: 500,
    include: { page: { select: { label: true, important: true } } },
  });
  return res.json({ success: true, issues });
}));

router.patch("/admin/issues/:id", wrap(async (req, res) => {
  const { status } = z.object({ status: z.enum(["OPEN", "IGNORED"]) }).strict().parse(req.body ?? {});
  const issue = await prisma.$transaction(async (tx) => {
    const updated = await tx.seoIssue.update({ where: { id: id(req) }, data: { status } });
    await tx.auditLog.create({ data: { userId: userId(res), action: status === "IGNORED" ? "SEO_ISSUE_IGNORED" : "SEO_ISSUE_REOPENED", entityType: "SeoIssue", entityId: updated.id, details: { type: updated.type, path: updated.path } } });
    return updated;
  });
  return res.json({ success: true, issue });
}));

router.get("/admin/audits", wrap(async (_req, res) => res.json({ success: true, audits: await prisma.seoAuditRun.findMany({ orderBy: { startedAt: "desc" }, take: 30 }) })));

router.post("/admin/audits", rateLimitMiddleware("seo_audit", { maxRequests: 12, windowSeconds: 3600 }), wrap(async (_req, res) => {
  const result = await runAudit({ trigger: "MANUAL", userId: userId(res) });
  return res.status(result.alreadyRunning ? 409 : 200).json({ success: !result.alreadyRunning, run: result.run, ...(result.alreadyRunning ? { error: "An audit is already running." } : {}) });
}));

// Settings, llms.txt and integrations

router.get("/admin/settings", wrap(async (_req, res) => res.json({ success: true, ...(await getSettings()) })));

router.put("/admin/settings", wrap(async (req, res) => {
  const input = siteSettingsSchema.parse(req.body ?? {});
  return res.json({ success: true, ...(await saveSettings(input, userId(res))) });
}));

router.get("/admin/integrations", wrap(async (_req, res) => res.json({ success: true, integrations: await integrationStatus() })));

export default router;
