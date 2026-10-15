// The SEO portal's Overview: the existing SEO dashboard numbers plus the migration work (checklist,
// blog, tasks, approvals, imports, technical checks). Every figure is counted from this site's own
// records; search data appears only from a connected provider, otherwise "Not connected".

import prisma from "@/lib/db/prisma";
import { overview as seoOverview } from "@/modules/seo/seo.overview";
import { BLOG_PREFIX } from "@/modules/seo/static-routes";
import { HANDOFF_BLOG_POSTS } from "@/modules/seo/portal/blog";
import { listChecklist } from "@/modules/seo/portal/checklist";
import { getLatestTechnical } from "@/modules/seo/portal/technical";
import { webflowStatus } from "@/modules/seo/portal/webflow";

export async function portalOverview(userId: string) {
  const [base, checklist, blogPosts, tasks, myTasks, pendingRequests, lastImport, baseline, technical, webflowRefs, missingAlt] = await Promise.all([
    seoOverview(),
    listChecklist(),
    prisma.seoPage.groupBy({ by: ["status"], where: { source: "CMS", path: { startsWith: BLOG_PREFIX } }, _count: true }),
    prisma.seoTask.groupBy({ by: ["status"], _count: true }),
    prisma.seoTask.findMany({ where: { assigneeId: userId, status: { not: "DONE" } }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }], take: 8, select: { id: true, title: true, status: true, priority: true, dueDate: true, path: true } }),
    prisma.seoChangeRequest.count({ where: { status: "PENDING" } }),
    prisma.seoImportBatch.findFirst({ where: { kind: { not: "BASELINE" } }, orderBy: { createdAt: "desc" }, select: { id: true, kind: true, source: true, status: true, createdAt: true } }),
    prisma.seoImportBatch.findFirst({ where: { kind: "BASELINE", status: "APPLIED" }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, result: true } }),
    getLatestTechnical(),
    prisma.seoIssue.count({ where: { status: "OPEN", type: "WEBFLOW_CDN_REFERENCE" } }),
    prisma.seoIssue.count({ where: { status: "OPEN", type: "IMAGE_MISSING_ALT" } }),
  ]);
  const blog = { expected: HANDOFF_BLOG_POSTS, PUBLISHED: 0, DRAFT: 0, SCHEDULED: 0, ARCHIVED: 0 } as Record<string, number>;
  for (const g of blogPosts) blog[g.status] = g._count;
  const taskCounts = { TODO: 0, IN_PROGRESS: 0, BLOCKED: 0, DONE: 0 } as Record<string, number>;
  for (const g of tasks) taskCounts[g.status] = g._count;
  return {
    ...base,
    migration: {
      checklist: checklist.progress,
      blog,
      pendingRequests,
      lastImport,
      baseline: baseline ? { id: baseline.id, capturedAt: baseline.createdAt, urls: (baseline.result as { urls?: number } | null)?.urls ?? null } : null,
      webflow: webflowStatus(),
      technical: technical ? { checkedAt: technical.checkedAt, counts: technical.counts } : null,
      images: { webflowReferences: webflowRefs, missingAlt },
    },
    tasks: { counts: taskCounts, mine: myTasks },
  };
}
