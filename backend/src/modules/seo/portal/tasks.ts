// SEO tasks (SEO portal): a simple to-do list for the SEO team, optionally linked to a page path,
// a keyword or an audit issue. Assignees must be SEO staff (admin, SEO manager, editor or viewer).

import type { Prisma, SeoPriority, SeoTaskStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { SeoError } from "@/modules/seo/seo.errors";
import { SEO_READ } from "@/lib/auth/permissions";

/** People who can be given SEO tasks (and are shown as names in the portal). */
export async function seoTeam() {
  const users = await prisma.user.findMany({ where: { role: { in: SEO_READ } }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: "asc" } });
  return users.map((u) => ({ id: u.id, name: u.name || u.email, role: u.role }));
}

export interface TaskInput {
  title?: string;
  description?: string | null;
  status?: SeoTaskStatus;
  priority?: SeoPriority;
  category?: string | null;
  assigneeId?: string | null;
  dueDate?: Date | null;
  path?: string | null;
  keywordId?: string | null;
  issueId?: string | null;
}

async function checkLinks(input: TaskInput) {
  if (input.assigneeId) {
    const user = await prisma.user.findUnique({ where: { id: input.assigneeId }, select: { role: true } });
    if (!user || !SEO_READ.includes(user.role)) throw new SeoError(400, "Tasks can only be assigned to SEO staff.");
  }
  if (input.keywordId && !(await prisma.seoKeyword.findUnique({ where: { id: input.keywordId }, select: { id: true } }))) throw new SeoError(400, "That keyword doesn't exist.");
  if (input.issueId && !(await prisma.seoIssue.findUnique({ where: { id: input.issueId }, select: { id: true } }))) throw new SeoError(400, "That issue doesn't exist.");
}

export async function listTasks(filter: { status?: SeoTaskStatus; assigneeId?: string; mine?: string } = {}) {
  const where: Prisma.SeoTaskWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.assigneeId) where.assigneeId = filter.assigneeId;
  const [tasks, team] = await Promise.all([
    prisma.seoTask.findMany({ where, orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 500 }),
    seoTeam(),
  ]);
  const names = Object.fromEntries(team.map((t) => [t.id, t.name]));
  const now = Date.now();
  return {
    tasks: tasks.map((t) => ({ ...t, assignee: t.assigneeId ? names[t.assigneeId] ?? "Former staff" : null, createdBy: t.createdById ? names[t.createdById] ?? null : null, overdue: Boolean(t.dueDate && t.status !== "DONE" && t.dueDate.getTime() < now) })),
    team,
    counts: {
      TODO: tasks.filter((t) => t.status === "TODO").length,
      IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      BLOCKED: tasks.filter((t) => t.status === "BLOCKED").length,
      DONE: tasks.filter((t) => t.status === "DONE").length,
    },
  };
}

export async function createTask(input: TaskInput & { title: string }, userId: string) {
  await checkLinks(input);
  return prisma.$transaction(async (tx) => {
    const task = await tx.seoTask.create({ data: { ...input, createdById: userId, completedAt: input.status === "DONE" ? new Date() : null } });
    await tx.auditLog.create({ data: { userId, action: "SEO_TASK_CREATED", entityType: "SeoTask", entityId: task.id, details: { title: task.title, assigneeId: task.assigneeId } } });
    return task;
  });
}

export async function updateTask(id: string, input: TaskInput, userId: string) {
  const before = await prisma.seoTask.findUnique({ where: { id } });
  if (!before) throw new SeoError(404, "Task not found.");
  await checkLinks(input);
  const completedAt = input.status === undefined ? undefined : input.status === "DONE" ? before.completedAt ?? new Date() : null;
  return prisma.$transaction(async (tx) => {
    const task = await tx.seoTask.update({ where: { id }, data: { ...input, ...(completedAt !== undefined ? { completedAt } : {}) } });
    const changed = Object.keys(input).filter((k) => JSON.stringify((before as Record<string, unknown>)[k] ?? null) !== JSON.stringify((input as Record<string, unknown>)[k] ?? null));
    await tx.auditLog.create({ data: { userId, action: "SEO_TASK_UPDATED", entityType: "SeoTask", entityId: id, details: { title: task.title, changed, status: task.status } } });
    return task;
  });
}

/** Tasks are closed rather than deleted, except by the person who created them or an admin. */
export async function deleteTask(id: string, userId: string, isAdmin: boolean) {
  const task = await prisma.seoTask.findUnique({ where: { id } });
  if (!task) throw new SeoError(404, "Task not found.");
  if (!isAdmin && task.createdById !== userId) throw new SeoError(403, "Only the person who created this task or an admin can delete it. Mark it done instead.");
  await prisma.$transaction([
    prisma.seoTask.delete({ where: { id } }),
    prisma.auditLog.create({ data: { userId, action: "SEO_TASK_DELETED", entityType: "SeoTask", entityId: id, details: { title: task.title } } }),
  ]);
}
