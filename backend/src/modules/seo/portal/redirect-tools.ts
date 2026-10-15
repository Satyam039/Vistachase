// Redirect helpers for the SEO portal: switching reviewed (imported) redirects on in one step, and
// the CSV export. Each activation goes through updateRedirect, so the same loop, chain, reserved-path
// and live-page checks apply; switching one off again is the rollback.

import prisma from "@/lib/db/prisma";
import { toCsv } from "@/modules/seo/seo.csv";
import { listRedirects, updateRedirect } from "@/modules/seo/seo.redirects";

export async function activateRedirects(ids: string[], userId: string) {
  const activated: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const id of ids.slice(0, 2000)) {
    try {
      await updateRedirect(id, { active: true }, userId);
      activated.push(id);
    } catch (error) {
      failed.push({ id, error: (error as Error).message });
    }
  }
  return { activated: activated.length, failed };
}

export async function redirectsCsv() {
  const rows = await listRedirects();
  return toCsv(
    ["from", "to", "status", "active", "source", "note", "hops", "created"],
    rows.map((r) => [r.fromPath, r.toPath, r.statusCode, r.active ? "yes" : "no", r.source, r.note ?? "", r.chain?.hops ?? "", r.createdAt]),
  );
}

/** Redirect history from the audit log (created, changed, switched on/off, deleted). */
export async function redirectHistory(limit = 100) {
  const rows = await prisma.auditLog.findMany({
    where: { entityType: "SeoRedirect" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, action: r.action, redirectId: r.entityId, details: r.details, by: r.user?.name ?? null, at: r.createdAt }));
}
