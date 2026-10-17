// Bulk actions on the blog list (Webflow's "Select" mode): publish, unpublish, archive, feature or
// unfeature several posts at once. Each post goes through the same single-post code (changeStatus /
// updatePage), so the blocking checks, revisions and audit log are exactly as if it were done one by
// one; a post that fails (for example a publish check) is reported and the others still go ahead.
// There is no bulk delete.

import prisma from "@/lib/db/prisma";
import { changeStatus, updatePage } from "@/modules/seo/seo.pages";
import { SeoError } from "@/modules/seo/seo.errors";
import { BLOG_PREFIX } from "@/modules/seo/static-routes";

export const BULK_ACTIONS = ["publish", "unpublish", "archive", "feature", "unfeature"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];
export const BULK_MAX = 100;

export interface BulkResult {
  id: string;
  label: string | null;
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

const ALREADY: Record<BulkAction, (p: { status: string; featured: boolean }) => boolean> = {
  publish: (p) => p.status === "PUBLISHED",
  unpublish: (p) => p.status === "DRAFT",
  archive: (p) => p.status === "ARCHIVED",
  feature: (p) => p.featured,
  unfeature: (p) => !p.featured,
};

export async function bulkBlogAction(ids: string[], action: BulkAction, userId: string): Promise<{ results: BulkResult[]; done: number; failed: number; skipped: number }> {
  const unique = Array.from(new Set(ids));
  const posts = await prisma.seoPage.findMany({ where: { id: { in: unique } }, select: { id: true, label: true, path: true, status: true, featured: true } });
  const byId = new Map(posts.map((p) => [p.id, p]));
  const results: BulkResult[] = [];

  for (const id of unique) {
    const post = byId.get(id);
    // Only blog posts: the bulk route must not reach tours, static pages or guides.
    if (!post || !post.path.startsWith(BLOG_PREFIX)) {
      results.push({ id, label: null, ok: false, error: "Not a blog post." });
      continue;
    }
    if (ALREADY[action](post)) {
      results.push({ id, label: post.label, ok: true, skipped: true });
      continue;
    }
    try {
      if (action === "feature" || action === "unfeature") await updatePage(id, { featured: action === "feature" }, userId);
      else await changeStatus(id, action, userId);
      results.push({ id, label: post.label, ok: true });
    } catch (error) {
      if (!(error instanceof SeoError)) throw error;
      const detail = error.checks?.length ? ` ${error.checks.map((c) => c.message).join(" ")}` : "";
      results.push({ id, label: post.label, ok: false, error: `${error.message}${detail}` });
    }
  }

  return {
    results,
    done: results.filter((r) => r.ok && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.ok).length,
  };
}
