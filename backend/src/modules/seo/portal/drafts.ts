// Drafts of live pages (SEO portal). Editing a published page in the portal saves the changes as a
// draft next to the live values; the live page changes only when someone with publishing rights
// clicks "Publish changes", which goes through updatePage (same checks, revision and audit log).

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { SeoError } from "@/modules/seo/seo.errors";
import { updatePage } from "@/modules/seo/seo.pages";
import { pageUpdateSchema, type PageUpdateInput } from "@/modules/seo/seo.validation";

const jsonSafe = (v: unknown) => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;

/** Live value vs draft value for each drafted field (for the review screen and the change log). */
function draftDiff(page: Record<string, unknown>, draft: Record<string, unknown>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(draft)) {
    if (k === "slug") {
      out.slug = { from: page.path, to: v };
      continue;
    }
    const before = page[k] instanceof Date ? (page[k] as Date).toISOString() : page[k];
    if (JSON.stringify(before ?? null) !== JSON.stringify(v ?? null)) out[k] = { from: before ?? null, to: v ?? null };
  }
  return out;
}

export async function saveDraft(id: string, input: PageUpdateInput, userId: string) {
  const page = await prisma.seoPage.findUnique({ where: { id } });
  if (!page) throw new SeoError(404, "Page not found.");
  const { confirmNoindex: _c, ...fields } = input;
  const merged = { ...((page.draft as Record<string, unknown>) ?? {}), ...jsonSafe(fields) };
  const changes = draftDiff(page as unknown as Record<string, unknown>, merged);
  // Fields that now match the live page aren't a change any more.
  const draft = Object.fromEntries(Object.entries(merged).filter(([k]) => k in changes));
  const empty = Object.keys(draft).length === 0;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.seoPage.update({ where: { id }, data: { draft: empty ? Prisma.DbNull : (draft as Prisma.InputJsonValue), draftUpdatedAt: empty ? null : new Date(), draftUpdatedById: empty ? null : userId } });
    await tx.seoPageRevision.create({ data: { pageId: id, userId, action: "DRAFT_SAVED", changes: changes as Prisma.InputJsonValue } });
    await tx.auditLog.create({ data: { userId, action: "SEO_PAGE_DRAFT_SAVED", entityType: "SeoPage", entityId: id, details: { path: page.path, fields: Object.keys(changes) } } });
    return row;
  });
  return { draft: (updated.draft as Record<string, unknown>) ?? null, changes };
}

export async function getDraft(id: string) {
  const page = await prisma.seoPage.findUnique({ where: { id } });
  if (!page) throw new SeoError(404, "Page not found.");
  const draft = (page.draft as Record<string, unknown>) ?? null;
  return { draft, changes: draft ? draftDiff(page as unknown as Record<string, unknown>, draft) : {}, updatedAt: page.draftUpdatedAt, updatedById: page.draftUpdatedById };
}

/** Applies the draft to the live page (re-validated), then clears it. */
export async function publishDraft(id: string, userId: string, confirmNoindex = false) {
  const page = await prisma.seoPage.findUnique({ where: { id } });
  if (!page) throw new SeoError(404, "Page not found.");
  if (!page.draft) throw new SeoError(400, "There are no draft changes to publish.");
  const parsed = pageUpdateSchema.safeParse({ ...(page.draft as object), ...(confirmNoindex ? { confirmNoindex: true } : {}) });
  if (!parsed.success) throw new SeoError(422, `The draft has a field that is no longer valid: ${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`);
  const result = await updatePage(id, parsed.data, userId);
  await prisma.seoPage.update({ where: { id }, data: { draft: Prisma.DbNull, draftUpdatedAt: null, draftUpdatedById: null } });
  await prisma.auditLog.create({ data: { userId, action: "SEO_PAGE_DRAFT_PUBLISHED", entityType: "SeoPage", entityId: id, details: { path: result.page.path, changed: result.changed } } });
  return result;
}

export async function discardDraft(id: string, userId: string) {
  const page = await prisma.seoPage.findUnique({ where: { id }, select: { path: true, draft: true } });
  if (!page) throw new SeoError(404, "Page not found.");
  await prisma.$transaction([
    prisma.seoPage.update({ where: { id }, data: { draft: Prisma.DbNull, draftUpdatedAt: null, draftUpdatedById: null } }),
    prisma.auditLog.create({ data: { userId, action: "SEO_PAGE_DRAFT_DISCARDED", entityType: "SeoPage", entityId: id, details: { path: page.path, fields: Object.keys((page.draft as object) ?? {}) } } }),
  ]);
}
