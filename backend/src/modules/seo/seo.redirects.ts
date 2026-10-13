// Redirects served by the frontend middleware (frontend/src/middleware.ts). Same-site paths only,
// never from app internals or signed-in areas, never shadowing a live page, and never a loop.

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { isReservedPath } from "@/modules/seo/paths";
import { SeoError } from "@/modules/seo/seo.errors";

const MAX_CHAIN = 10;

/**
 * True when adding from -> to would loop (following active redirects from `to` gets back to
 * `from`) or would build a chain longer than MAX_CHAIN hops.
 */
export function findRedirectLoop(from: string, to: string, active: { fromPath: string; toPath: string }[]): boolean {
  if (from === to) return true;
  const next = new Map(active.filter((r) => r.fromPath !== from).map((r) => [r.fromPath, r.toPath]));
  let cursor: string | undefined = to;
  const seen = new Set<string>([from]);
  for (let hops = 0; cursor !== undefined; hops++) {
    if (seen.has(cursor) || hops > MAX_CHAIN) return true;
    seen.add(cursor);
    cursor = next.get(cursor);
  }
  return false;
}

/** Every active redirect with the hops it takes to land (for the audit and the dashboard). */
export function resolveChains(active: { fromPath: string; toPath: string }[]) {
  const next = new Map(active.map((r) => [r.fromPath, r.toPath]));
  return active.map((r) => {
    const hops = [r.fromPath];
    let cursor: string | undefined = r.toPath;
    let loop = false;
    while (cursor !== undefined) {
      if (hops.includes(cursor) || hops.length > MAX_CHAIN) {
        loop = true;
        break;
      }
      hops.push(cursor);
      cursor = next.get(cursor);
    }
    return { fromPath: r.fromPath, finalPath: hops[hops.length - 1], hops: hops.length - 1, loop };
  });
}

async function assertAllowed(fromPath: string, toPath: string, ignoreId?: string) {
  if (isReservedPath(fromPath)) throw new SeoError(400, `Redirects can't start from ${fromPath}: it belongs to the app or a signed-in area.`);
  if (toPath.startsWith("/api") || toPath.startsWith("/_next")) throw new SeoError(400, "Redirects can't point into the API.");
  const livePage = await prisma.seoPage.findUnique({ where: { path: fromPath }, select: { status: true, label: true } });
  if (livePage && livePage.status !== "ARCHIVED") {
    throw new SeoError(409, `${fromPath} is a live page (${livePage.label}). Archive it in Pages first, or the redirect would hide it.`);
  }
  const active = await prisma.seoRedirect.findMany({ where: { active: true, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) }, select: { fromPath: true, toPath: true } });
  if (findRedirectLoop(fromPath, toPath, active)) throw new SeoError(409, `That would create a redirect loop (or a chain longer than ${MAX_CHAIN} hops).`);
}

export async function listRedirects() {
  const redirects = await prisma.seoRedirect.findMany({ orderBy: { fromPath: "asc" } });
  const chains = new Map(resolveChains(redirects.filter((r) => r.active)).map((c) => [c.fromPath, c]));
  return redirects.map((r) => ({ ...r, chain: chains.get(r.fromPath) ?? null }));
}

export async function createRedirect(input: { fromPath: string; toPath: string; statusCode: number; active: boolean; note?: string | null }, userId: string) {
  if (await prisma.seoRedirect.findUnique({ where: { fromPath: input.fromPath } })) throw new SeoError(409, `A redirect from ${input.fromPath} already exists.`);
  if (input.active) await assertAllowed(input.fromPath, input.toPath);
  return prisma.$transaction(async (tx) => {
    const created = await tx.seoRedirect.create({ data: { ...input, note: input.note ?? null, createdById: userId } });
    await tx.auditLog.create({ data: { userId, action: "SEO_REDIRECT_CREATED", entityType: "SeoRedirect", entityId: created.id, details: { fromPath: created.fromPath, toPath: created.toPath, statusCode: created.statusCode } } });
    return created;
  });
}

export async function updateRedirect(id: string, input: { toPath?: string; statusCode?: number; active?: boolean; note?: string | null }, userId: string) {
  const current = await prisma.seoRedirect.findUnique({ where: { id } });
  if (!current) throw new SeoError(404, "Redirect not found.");
  const next = { ...current, ...input };
  if (next.active) await assertAllowed(next.fromPath, next.toPath, id);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.seoRedirect.update({ where: { id }, data: input as Prisma.SeoRedirectUpdateInput });
    await tx.auditLog.create({ data: { userId, action: "SEO_REDIRECT_UPDATED", entityType: "SeoRedirect", entityId: id, details: input as object } });
    return updated;
  });
}

export async function deleteRedirect(id: string, userId: string) {
  const current = await prisma.seoRedirect.findUnique({ where: { id } });
  if (!current) throw new SeoError(404, "Redirect not found.");
  await prisma.$transaction(async (tx) => {
    await tx.seoRedirect.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId, action: "SEO_REDIRECT_DELETED", entityType: "SeoRedirect", entityId: id, details: { fromPath: current.fromPath, toPath: current.toPath } } });
  });
}

/** What the middleware needs: active redirects as {from: [to, status]}, loops left out. */
export async function activeRedirectMap() {
  const active = await prisma.seoRedirect.findMany({ where: { active: true }, select: { fromPath: true, toPath: true, statusCode: true } });
  const loops = new Set(resolveChains(active).filter((c) => c.loop).map((c) => c.fromPath));
  const map: Record<string, [string, number]> = {};
  for (const r of active) if (!loops.has(r.fromPath) && !isReservedPath(r.fromPath)) map[r.fromPath] = [r.toPath, r.statusCode];
  return map;
}
