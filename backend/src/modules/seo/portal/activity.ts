// Change history and audit comparison (SEO portal). The change log reads the audit log, which every
// SEO write already fills (who, what, when, before/after where recorded); nothing is copied.

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { SeoError } from "@/modules/seo/seo.errors";

const SEO_ENTITIES = ["SeoPage", "SeoKeyword", "SeoKeywordMapping", "SeoKeywordCluster", "SeoRedirect", "SeoIssue", "SeoSiteSettings", "SeoSchemaBlock", "SeoTask", "SeoChecklistItem", "SeoChangeRequest", "SeoImportBatch", "SeoAuditRun"];

export async function changeLog(filter: { entityType?: string; entityId?: string; userId?: string; q?: string; before?: Date; limit?: number } = {}) {
  const where: Prisma.AuditLogWhereInput = {
    OR: [{ entityType: { in: SEO_ENTITIES } }, { action: { startsWith: "SEO_" } }],
    ...(filter.entityType ? { entityType: filter.entityType } : {}),
    ...(filter.entityId ? { entityId: filter.entityId } : {}),
    ...(filter.userId ? { userId: filter.userId } : {}),
    ...(filter.q ? { action: { contains: filter.q.toUpperCase().replace(/[^A-Z_]/g, "") } } : {}),
    ...(filter.before ? { createdAt: { lt: filter.before } } : {}),
  };
  const take = Math.min(filter.limit ?? 100, 200);
  const rows = await prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take, include: { user: { select: { name: true, email: true } } } });
  return {
    entries: rows.map((r) => ({ id: r.id, action: r.action, entityType: r.entityType, entityId: r.entityId, details: r.details, by: r.user ? r.user.name || r.user.email : r.userId ? "Former staff" : "System", at: r.createdAt })),
    next: rows.length === take ? rows[rows.length - 1].createdAt : null,
  };
}

type Snapshot = { f: string; t: string; s: string; p: string | null }[];

/** What changed between two audit runs: new, fixed and still-open findings, by type. */
export async function compareAudits(fromId: string, toId: string) {
  const [a, b] = await Promise.all([prisma.seoAuditRun.findUnique({ where: { id: fromId } }), prisma.seoAuditRun.findUnique({ where: { id: toId } })]);
  if (!a || !b) throw new SeoError(404, "Audit run not found.");
  const sa = ((a.summary as { findings?: Snapshot })?.findings ?? null) as Snapshot | null;
  const sb = ((b.summary as { findings?: Snapshot })?.findings ?? null) as Snapshot | null;
  if (!sa || !sb) throw new SeoError(400, "One of these audits ran before findings were recorded per run, so it can't be compared. Compare two newer runs.");
  const keysA = new Set(sa.map((x) => x.f));
  const keysB = new Set(sb.map((x) => x.f));
  const added = sb.filter((x) => !keysA.has(x.f));
  const fixed = sa.filter((x) => !keysB.has(x.f));
  const byType = new Map<string, { type: string; before: number; after: number }>();
  for (const x of sa) byType.set(x.t, { type: x.t, before: (byType.get(x.t)?.before ?? 0) + 1, after: byType.get(x.t)?.after ?? 0 });
  for (const x of sb) byType.set(x.t, { type: x.t, before: byType.get(x.t)?.before ?? 0, after: (byType.get(x.t)?.after ?? 0) + 1 });
  const strip = (x: Snapshot[number]) => ({ type: x.t, severity: x.s, path: x.p });
  return {
    from: { id: a.id, startedAt: a.startedAt, total: sa.length },
    to: { id: b.id, startedAt: b.startedAt, total: sb.length },
    added: added.slice(0, 500).map(strip),
    fixed: fixed.slice(0, 500).map(strip),
    unchanged: sb.length - added.length,
    byType: [...byType.values()].sort((x, y) => y.after - y.before - (x.after - x.before)),
  };
}

/** Records that someone checked an issue by hand (with a note); it stays open until an audit no longer finds it. */
export async function confirmIssue(id: string, note: string | null, userId: string) {
  const issue = await prisma.seoIssue.findUnique({ where: { id } });
  if (!issue) throw new SeoError(404, "Issue not found.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.seoIssue.update({ where: { id }, data: { confirmedAt: new Date(), confirmedById: userId, note } });
    await tx.auditLog.create({ data: { userId, action: "SEO_ISSUE_CONFIRMED", entityType: "SeoIssue", entityId: id, details: { type: issue.type, path: issue.path, note } } });
    return updated;
  });
}
