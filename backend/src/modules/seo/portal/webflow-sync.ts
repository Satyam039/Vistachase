// Webflow blog sync: keeps /blog and /blog-post/<slug> in step with the posts the SEO team publishes
// in Webflow's CMS. It reads the Webflow API only (never writes to Webflow) and is off until the
// server has WEBFLOW_API_TOKEN and WEBFLOW_SYNC_ENABLED=true; "Sync now" in the portal works with
// just the token. Each run, for the blog collection:
//
//   - a post published in Webflow that isn't here yet is created here, published, at the same
//     address (/blog-post/<Webflow slug>) and linked by its Webflow item id
//   - a linked post whose Webflow values changed is updated, unless someone changed it here since
//     the last sync (or it has unsaved draft changes): then the Webflow values become a draft on it
//     to review, never a silent overwrite
//   - a post that was already here at the same address (an earlier import, or written in the portal)
//     is linked; if Webflow's values differ they become a draft to review
//   - a linked post that Webflow no longer has published goes back to draft here (never deleted),
//     unless it was changed here since the last sync; it comes back when Webflow publishes it again
//
// The address is never changed by the sync (a Webflow slug change is reported, so the team can
// rename here, which adds the 301), the original publish date is kept, and SEO and social fields
// are only filled from Webflow when Webflow has a value. Images stay where Webflow serves them
// unless the media library already has a copy; nothing is downloaded. Drafts and archived Webflow
// items are never created here.

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { SeoError } from "@/modules/seo/seo.errors";
import { canonicalOrigin } from "@/modules/seo/portal/technical";
import { postData, postFromItem, previewPosts } from "@/modules/seo/portal/imports";
import { fetchWebflowBlog } from "@/modules/seo/portal/webflow";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_MINUTES = 15;
/** Seconds of leeway between the sync's own write and the row's updatedAt. */
const OWN_WRITE_SLACK_MS = 5_000;
/** A run that would take more than this many posts offline at once stops and asks for a person. */
const MAX_OFFLINE_PER_RUN = 5;

export const isWebflowSyncEnabled = () => process.env.WEBFLOW_SYNC_ENABLED === "true" && Boolean(process.env.WEBFLOW_API_TOKEN);

export function webflowSyncMinutes() {
  const n = Number(process.env.WEBFLOW_SYNC_MINUTES);
  return Number.isFinite(n) && n >= 5 ? Math.floor(n) : DEFAULT_MINUTES;
}

// Fields Webflow owns on a synced post. SEO and social fields are applied only when Webflow has a
// value, so a title written here is never blanked by an empty Webflow field.
const CONTENT_FIELDS = ["label", "h1", "body", "excerpt", "featuredImage", "featuredImageAlt", "thumbnailImage", "thumbnailAlt", "featured", "dateModified"] as const;
const SEO_FIELDS = ["seoTitle", "metaDescription", "ogTitle", "ogDescription", "ogImage"] as const;

export interface SyncResult {
  trigger: "SCHEDULED" | "MANUAL";
  startedAt: string;
  finishedAt: string;
  webflowPublished: number;
  created: string[];
  updated: string[];
  drafted: string[];
  linked: string[];
  offline: string[];
  unchanged: number;
  skipped: { ref: string; path: string | null; reason: string }[];
  notes: string[];
}

let running = false;

/** Runs one sync. Throws SeoError when Webflow isn't connected or can't be read. */
export async function syncWebflowBlog(opts: { trigger?: "SCHEDULED" | "MANUAL"; userId?: string | null; fetchImpl?: FetchLike } = {}): Promise<SyncResult> {
  if (running) throw new SeoError(409, "A Webflow sync is already running. Try again in a minute.");
  running = true;
  try {
    return await runSync(opts.trigger ?? "MANUAL", opts.userId ?? null, opts.fetchImpl);
  } finally {
    running = false;
  }
}

const hashOf = (fields: Record<string, unknown>) => {
  const { datePublished: _published, ...rest } = fields;
  return createHash("sha256").update(JSON.stringify(rest, Object.keys(rest).sort())).digest("hex");
};

async function runSync(trigger: SyncResult["trigger"], userId: string | null, fetchImpl?: FetchLike): Promise<SyncResult> {
  const started = new Date();
  const blog = await fetchWebflowBlog(fetchImpl);
  const posts = blog.live.map((it, i) => postFromItem(it as unknown as Record<string, unknown>, i, blog.changesInDraft));
  const preview = await previewPosts(posts, { dateSource: "created", mapLocalImages: true, useBaseline: true });

  const result: SyncResult = { trigger, startedAt: started.toISOString(), finishedAt: "", webflowPublished: posts.length, created: [], updated: [], drafted: [], linked: [], offline: [], unchanged: 0, skipped: [], notes: [] };
  const liveIds = new Set(posts.map((p) => p.ref));
  const linked = await prisma.seoPage.findMany({
    where: { webflowItemId: { not: null } },
    select: { id: true, path: true, status: true, webflowItemId: true, webflowSyncedAt: true, webflowHash: true, webflowOfflineAt: true, updatedAt: true, draft: true },
  });
  const byItem = new Map(linked.map((p) => [p.webflowItemId!, p]));
  const changedHere = (p: { updatedAt: Date; webflowSyncedAt: Date | null; draft: unknown }) =>
    p.draft != null || !p.webflowSyncedAt || p.updatedAt.getTime() > p.webflowSyncedAt.getTime() + OWN_WRITE_SLACK_MS;

  for (const row of preview.rows) {
    const itemId = row.ref;
    if (row.action === "error" || !row.path) {
      result.skipped.push({ ref: row.name ?? itemId, path: row.path, reason: row.errors.join(" ") || "Not usable." });
      continue;
    }
    const parsed = postData(row.fields);
    if (!parsed.success) {
      result.skipped.push({ ref: row.name ?? itemId, path: row.path, reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      continue;
    }
    const data = JSON.parse(JSON.stringify(parsed.data)) as Record<string, unknown>;
    const hash = hashOf(data);
    const now = new Date();
    const mine = byItem.get(itemId);

    try {
      if (mine) {
        if (mine.path !== row.path) result.notes.push(`"${row.name}" has the slug ${row.path} in Webflow but lives at ${mine.path} here. The address wasn't changed; rename it in the post editor if the change is intended (that adds the 301).`);
        const comesBack = mine.webflowOfflineAt != null && mine.status === "DRAFT";
        if (mine.webflowHash === hash && !comesBack) {
          result.unchanged++;
          continue;
        }
        if (changedHere(mine)) {
          if (mine.webflowHash === hash) {
            result.unchanged++;
            continue;
          }
          await draftOnto(mine.id, data, hash, now, userId, "Webflow changes arrived after this post was edited here; review them in the draft.");
          result.drafted.push(mine.path);
          continue;
        }
        const update = webflowOwned(data);
        await prisma.$transaction(async (tx) => {
          await tx.seoPage.update({
            where: { id: mine.id },
            data: { ...(update as Prisma.SeoPageUpdateInput), ...(comesBack ? { status: "PUBLISHED", webflowOfflineAt: null } : {}), webflowHash: hash, webflowSyncedAt: now },
          });
          await tx.seoPageRevision.create({ data: { pageId: mine.id, userId, action: comesBack ? "PUBLISHED" : "UPDATED", changes: { webflow: { from: mine.webflowHash, to: hash } } as Prisma.InputJsonValue, note: comesBack ? "Published again in Webflow (Webflow sync)" : "Updated from Webflow (Webflow sync)" } });
        });
        result.updated.push(mine.path);
        continue;
      }

      const atPath = await prisma.seoPage.findUnique({ where: { path: row.path }, select: { id: true, webflowItemId: true, draft: true } });
      if (atPath) {
        if (atPath.webflowItemId) {
          result.skipped.push({ ref: row.name ?? itemId, path: row.path, reason: `${row.path} is already linked to another Webflow item.` });
          continue;
        }
        // An earlier import or a post written here: link it, and put any Webflow differences in a draft.
        const current = await prisma.seoPage.findUnique({ where: { id: atPath.id } });
        const differs = Object.keys(webflowOwned(data)).some((k) => k !== "dateModified" && JSON.stringify(normal((current as Record<string, unknown> | null)?.[k])) !== JSON.stringify(normal(data[k])));
        await prisma.$transaction(async (tx) => {
          await tx.seoPage.update({ where: { id: atPath.id }, data: { webflowItemId: itemId, webflowHash: hash, webflowSyncedAt: now } });
          await tx.seoPageRevision.create({ data: { pageId: atPath.id, userId, action: "UPDATED", changes: { webflowItemId: { from: null, to: itemId } }, note: "Linked to its Webflow item (Webflow sync)" } });
        });
        if (differs) {
          await draftOnto(atPath.id, data, hash, now, userId, "Linked to Webflow; Webflow's values differ from this post's, so they are a draft to review.");
          result.drafted.push(row.path);
        } else result.linked.push(row.path);
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const page = await tx.seoPage.create({
          data: {
            ...(data as Prisma.SeoPageCreateInput),
            label: (data.label as string | undefined) || row.slug!,
            path: row.path!,
            pageType: "GUIDE",
            source: "CMS",
            status: "PUBLISHED",
            publishedAt: now,
            conversionGoal: "BOOKING",
            importSource: "WEBFLOW_API",
            originalUrl: `${canonicalOrigin()}${row.path}`,
            webflowItemId: itemId,
            webflowHash: hash,
            webflowSyncedAt: now,
            createdById: userId,
            updatedById: userId,
          },
        });
        await tx.seoPageRevision.create({ data: { pageId: page.id, userId, action: "IMPORTED", changes: { path: { from: null, to: page.path }, status: { from: null, to: "PUBLISHED" } }, note: `Published in Webflow, added by the Webflow sync (item ${itemId}).` } });
      });
      result.created.push(row.path);
    } catch (error) {
      result.skipped.push({ ref: row.name ?? itemId, path: row.path, reason: (error as Error).message.slice(0, 200) });
    }
  }

  // Linked posts Webflow no longer has published (unpublished, archived, drafted or deleted there).
  const gone = linked.filter((p) => !liveIds.has(p.webflowItemId!) && p.status === "PUBLISHED");
  const toOffline = gone.filter((p) => !changedHere(p));
  for (const p of gone.filter((p) => changedHere(p))) result.notes.push(`${p.path} isn't published in Webflow any more, but it was changed here since the last sync, so it stays live. Unpublish it in the portal if it should go.`);
  if (toOffline.length > MAX_OFFLINE_PER_RUN) {
    result.notes.push(`Webflow no longer lists ${toOffline.length} synced posts as published. That's more than ${MAX_OFFLINE_PER_RUN} at once, so none were taken offline; check Webflow, then unpublish them in the portal if that's intended.`);
  } else {
    for (const p of toOffline) {
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.seoPage.update({ where: { id: p.id }, data: { status: "DRAFT", webflowOfflineAt: now, webflowSyncedAt: now } });
        await tx.seoPageRevision.create({ data: { pageId: p.id, userId, action: "UNPUBLISHED", changes: { status: { from: "PUBLISHED", to: "DRAFT" } }, note: "No longer published in Webflow (Webflow sync). Nothing was deleted." } });
      });
      result.offline.push(p.path);
    }
  }

  result.finishedAt = new Date().toISOString();
  await prisma.auditLog.create({
    data: {
      userId,
      action: "SEO_WEBFLOW_SYNC",
      entityType: "WebflowSync",
      entityId: "blog",
      details: { ...result, skipped: result.skipped.slice(0, 50), notes: result.notes.slice(0, 50) } as unknown as Prisma.InputJsonValue,
    },
  });
  return result;
}

/** The Webflow-owned values to write on a synced post (SEO fields only when Webflow has one). */
function webflowOwned(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of CONTENT_FIELDS) if (k in data) out[k] = data[k];
  for (const k of SEO_FIELDS) if (data[k] != null && data[k] !== "") out[k] = data[k];
  return out;
}

const normal = (v: unknown) => (v instanceof Date ? v.toISOString() : v === undefined ? null : v);

async function draftOnto(id: string, data: Record<string, unknown>, hash: string, now: Date, userId: string | null, note: string) {
  const page = await prisma.seoPage.findUnique({ where: { id }, select: { draft: true } });
  const draft = { ...((page?.draft as Record<string, unknown>) ?? {}), ...webflowOwned(data) };
  // The draft write must not count as a local edit next time, so the sync time moves with it.
  await prisma.$transaction([
    prisma.seoPage.update({ where: { id }, data: { draft: draft as Prisma.InputJsonValue, draftUpdatedAt: now, webflowHash: hash, webflowSyncedAt: now } }),
    prisma.seoPageRevision.create({ data: { pageId: id, userId, action: "DRAFT_FROM_IMPORT", changes: { webflow: { from: null, to: hash } }, note } }),
  ]);
}

/** For the portal: whether the sync is on, how often, and the last few runs. */
export async function webflowSyncStatus() {
  const runs = await prisma.auditLog.findMany({ where: { action: "SEO_WEBFLOW_SYNC" }, orderBy: { createdAt: "desc" }, take: 5, select: { createdAt: true, details: true, userId: true } });
  const failed = await prisma.auditLog.findFirst({ where: { action: "SEO_WEBFLOW_SYNC_FAILED" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, details: true } });
  const linked = await prisma.seoPage.count({ where: { webflowItemId: { not: null } } });
  return {
    configured: Boolean(process.env.WEBFLOW_API_TOKEN),
    scheduled: isWebflowSyncEnabled(),
    everyMinutes: webflowSyncMinutes(),
    linkedPosts: linked,
    running,
    lastRuns: runs.map((r) => ({ at: r.createdAt, ...(r.details as object) })),
    lastFailure: failed && (!runs[0] || failed.createdAt > runs[0].createdAt) ? { at: failed.createdAt, ...(failed.details as object) } : null,
  };
}

/** Scheduled run: does nothing unless switched on; failures are recorded for the portal. */
export async function scheduledWebflowSync() {
  if (!isWebflowSyncEnabled()) return { skipped: "Webflow sync is off (WEBFLOW_SYNC_ENABLED and WEBFLOW_API_TOKEN)." };
  try {
    const r = await syncWebflowBlog({ trigger: "SCHEDULED" });
    return { created: r.created.length, updated: r.updated.length, drafted: r.drafted.length, linked: r.linked.length, offline: r.offline.length, unchanged: r.unchanged, skipped: r.skipped.length };
  } catch (error) {
    await prisma.auditLog.create({ data: { userId: null, action: "SEO_WEBFLOW_SYNC_FAILED", entityType: "WebflowSync", entityId: "blog", details: { error: (error as Error).message.slice(0, 300) } } });
    throw error;
  }
}

