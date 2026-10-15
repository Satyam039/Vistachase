// Changes only an admin may make (SEO portal): the Google tag settings, the site verification meta
// tag and site-wide JSON-LD. A verification token gives whoever owns it Search Console access to the
// domain, and a tag or site-wide block reaches every page, so an SEO manager files a request and an
// admin approves it (which applies it) or rejects it. Admins can also apply a change directly, with
// confirmation. Every step is in the audit log, and each request keeps the value it replaced so it
// can be reverted with a new request.

import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { SeoError } from "@/modules/seo/seo.errors";
import { publishSchema, unpublishSchema } from "@/modules/seo/portal/schema";
import { HANDOFF_VERIFICATION_ID } from "@/modules/seo/portal/technical";

export const REQUEST_KINDS = ["TRACKING", "VERIFICATION", "SITE_SCHEMA"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

const trackingPayload = z
  .object({
    enabled: z.boolean(),
    ga4Id: z.string().trim().regex(/^G-[A-Z0-9]{4,20}$/, "A GA4 ID looks like G-XXXXXXX.").nullable().optional(),
    adsId: z.string().trim().regex(/^AW-\d{6,15}$/, "A Google Ads ID looks like AW-123456789.").nullable().optional(),
    adsConversionLabel: z.string().trim().regex(/^[A-Za-z0-9_-]{4,60}$/).nullable().optional(),
    conversionValue: z.number().min(0).max(100000).nullable().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
    consentDefault: z.enum(["granted", "denied"]).nullable().optional(),
    /** The footer conversion script as supplied, kept for reference only; never rendered. */
    conversionScript: z.string().max(20000).nullable().optional(),
    /** Which buttons trigger a conversion, as confirmed by the site owner (free text). */
    conversionTriggers: z.string().max(2000).nullable().optional(),
  })
  .strict()
  .refine((t) => !t.enabled || t.ga4Id || t.adsId, "Add a GA4 or Google Ads ID before switching the tag on.");

const verificationPayload = z
  .object({ token: z.string().trim().regex(/^[A-Za-z0-9_-]{10,100}$/, "Paste only the content value of the meta tag.").nullable() })
  .strict();

const siteSchemaPayload = z.object({ action: z.enum(["publish", "unpublish"]) }).strict();

export const requestSchema = z
  .object({
    kind: z.enum(REQUEST_KINDS),
    targetId: z.string().max(40).nullable().optional(),
    payload: z.unknown(),
    reason: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

function parsePayload(kind: RequestKind, payload: unknown) {
  if (kind === "TRACKING") return trackingPayload.parse(payload);
  if (kind === "VERIFICATION") return verificationPayload.parse(payload);
  return siteSchemaPayload.parse(payload);
}

async function currentValue(kind: RequestKind, targetId: string | null) {
  if (kind === "SITE_SCHEMA") {
    const block = targetId ? await prisma.seoSchemaBlock.findUnique({ where: { id: targetId }, select: { status: true, json: true, scope: true } }) : null;
    return block ? { status: block.status, json: block.json } : null;
  }
  const settings = await prisma.seoSiteSettings.findUnique({ where: { id: "site" }, select: { tracking: true, googleSiteVerification: true, conversionScript: true } });
  if (kind === "VERIFICATION") return { token: settings?.googleSiteVerification ?? null };
  return { ...((settings?.tracking as object) ?? { enabled: false }), conversionScript: settings?.conversionScript ?? null };
}

function titleFor(kind: RequestKind, payload: Record<string, unknown>) {
  if (kind === "TRACKING") return payload.enabled ? `Switch on the Google tag (${[payload.ga4Id, payload.adsId].filter(Boolean).join(", ")})` : "Update the Google tag settings (tag off)";
  if (kind === "VERIFICATION") return payload.token ? "Add the Google site verification tag" : "Remove the Google site verification tag";
  return payload.action === "publish" ? "Publish a site-wide structured data block" : "Take a site-wide structured data block off the site";
}

/** Warnings shown next to the request (nothing here blocks it). */
function warningsFor(kind: RequestKind, payload: Record<string, unknown>) {
  const warnings: string[] = [];
  if (kind === "VERIFICATION" && payload.token && payload.token !== HANDOFF_VERIFICATION_ID) {
    warnings.push(`This token differs from the one in the migration handoff (${HANDOFF_VERIFICATION_ID}). Check it against the meta tag on the live site before approving.`);
  }
  if (kind === "TRACKING" && payload.enabled && payload.conversionScript) {
    warnings.push("The conversion script is stored for reference only. Wiring it to buttons is a code change once the triggers are confirmed.");
  }
  return warnings;
}

export async function createRequest(input: z.infer<typeof requestSchema>, userId: string) {
  const payload = parsePayload(input.kind, input.payload) as Record<string, unknown>;
  const targetId = input.targetId ?? null;
  if (input.kind === "SITE_SCHEMA") {
    const block = targetId ? await prisma.seoSchemaBlock.findUnique({ where: { id: targetId }, select: { scope: true, draftJson: true } }) : null;
    if (!block || block.scope !== "SITE") throw new SeoError(400, "Choose a site-wide structured data block.");
    if (payload.action === "publish" && !block.draftJson) throw new SeoError(400, "That block has no draft to publish.");
  }
  const pending = await prisma.seoChangeRequest.findFirst({ where: { kind: input.kind, targetId, status: "PENDING" } });
  if (pending) throw new SeoError(409, "There's already a pending request for this. Cancel it or wait for an admin.");
  const before = await currentValue(input.kind, targetId);
  return prisma.$transaction(async (tx) => {
    const request = await tx.seoChangeRequest.create({
      data: { kind: input.kind, targetId, title: titleFor(input.kind, payload), payload: payload as Prisma.InputJsonValue, before: (before ?? Prisma.DbNull) as Prisma.InputJsonValue, reason: input.reason ?? null, requestedById: userId },
    });
    await tx.auditLog.create({ data: { userId, action: "SEO_CHANGE_REQUESTED", entityType: "SeoChangeRequest", entityId: request.id, details: { kind: request.kind, title: request.title } } });
    return { request, warnings: warningsFor(input.kind, payload) };
  });
}

export async function listRequests() {
  const rows = await prisma.seoChangeRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const ids = [...new Set(rows.flatMap((r) => [r.requestedById, r.reviewedById]).filter(Boolean) as string[])];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
  const names = Object.fromEntries(users.map((u) => [u.id, u.name || u.email]));
  return rows.map((r) => ({
    ...r,
    // The conversion script can be long; the list carries whether one is attached.
    payload: redactScript(r.payload),
    requestedBy: r.requestedById ? names[r.requestedById] ?? null : null,
    reviewedBy: r.reviewedById ? names[r.reviewedById] ?? null : null,
    warnings: warningsFor(r.kind as RequestKind, r.payload as Record<string, unknown>),
  }));
}

function redactScript(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload;
  const p = payload as Record<string, unknown>;
  return typeof p.conversionScript === "string" ? { ...p, conversionScript: `(${p.conversionScript.length} characters)` } : p;
}

/** Applies a change. Only called for an admin (approval or direct change). */
async function apply(kind: RequestKind, targetId: string | null, payload: Record<string, unknown>, userId: string) {
  if (kind === "SITE_SCHEMA") {
    if (!targetId) throw new SeoError(400, "Missing block.");
    if (payload.action === "publish") await publishSchema(targetId, userId);
    else await unpublishSchema(targetId, userId);
    return;
  }
  if (kind === "VERIFICATION") {
    const token = (payload.token as string | null) ?? null;
    await prisma.seoSiteSettings.upsert({ where: { id: "site" }, create: { id: "site", googleSiteVerification: token, updatedById: userId }, update: { googleSiteVerification: token, updatedById: userId } });
    return;
  }
  const { conversionScript, ...tracking } = payload;
  const data = { tracking: tracking as Prisma.InputJsonValue, ...(conversionScript !== undefined ? { conversionScript: (conversionScript as string | null) ?? null } : {}), updatedById: userId };
  await prisma.seoSiteSettings.upsert({ where: { id: "site" }, create: { id: "site", ...data }, update: data });
}

export async function reviewRequest(id: string, decision: "approve" | "reject", note: string | null, userId: string) {
  const request = await prisma.seoChangeRequest.findUnique({ where: { id } });
  if (!request) throw new SeoError(404, "Request not found.");
  if (request.status !== "PENDING") throw new SeoError(409, `This request was already ${request.status.toLowerCase()}.`);
  if (decision === "approve") {
    const payload = parsePayload(request.kind as RequestKind, request.payload) as Record<string, unknown>;
    await apply(request.kind as RequestKind, request.targetId, payload, userId);
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.seoChangeRequest.update({ where: { id }, data: { status: decision === "approve" ? "APPROVED" : "REJECTED", reviewedById: userId, reviewNote: note, reviewedAt: new Date() } });
    await tx.auditLog.create({ data: { userId, action: decision === "approve" ? "SEO_CHANGE_APPROVED" : "SEO_CHANGE_REJECTED", entityType: "SeoChangeRequest", entityId: id, details: { kind: request.kind, title: request.title, note } } });
    return updated;
  });
}

export async function cancelRequest(id: string, userId: string, isAdmin: boolean) {
  const request = await prisma.seoChangeRequest.findUnique({ where: { id } });
  if (!request) throw new SeoError(404, "Request not found.");
  if (request.status !== "PENDING") throw new SeoError(409, "Only a pending request can be cancelled.");
  if (!isAdmin && request.requestedById !== userId) throw new SeoError(403, "Only the person who asked, or an admin, can cancel this request.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.seoChangeRequest.update({ where: { id }, data: { status: "CANCELLED", reviewedById: userId, reviewedAt: new Date() } });
    await tx.auditLog.create({ data: { userId, action: "SEO_CHANGE_CANCELLED", entityType: "SeoChangeRequest", entityId: id, details: { kind: request.kind } } });
    return updated;
  });
}

/** An admin applying a change directly: recorded as a request approved by the same person. */
export async function applyDirect(input: z.infer<typeof requestSchema>, confirm: boolean, userId: string) {
  if (!confirm) throw new SeoError(409, "This changes every page of the public site. Confirm to apply it.");
  const { request, warnings } = await createRequest(input, userId);
  const approved = await reviewRequest(request.id, "approve", "Applied directly by an admin.", userId);
  return { request: approved, warnings };
}

/** What the admin-only settings are now (tracking, verification), for the Settings and Analytics screens. */
export async function adminSettingsState() {
  const s = await prisma.seoSiteSettings.findUnique({ where: { id: "site" }, select: { tracking: true, googleSiteVerification: true, conversionScript: true } });
  return {
    tracking: (s?.tracking as Record<string, unknown> | null) ?? { enabled: false },
    verification: s?.googleSiteVerification ?? null,
    handoffVerification: HANDOFF_VERIFICATION_ID,
    verificationMatchesHandoff: s?.googleSiteVerification ? s.googleSiteVerification === HANDOFF_VERIFICATION_ID : null,
    conversionScriptStored: Boolean(s?.conversionScript),
  };
}
