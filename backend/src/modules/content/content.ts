// Tour and destination copy, edited from Admin → Content. Only words and images: prices, booking
// mode, category, capacity, group sizes, slugs and departures stay with the booking engine and are
// refused here (the schemas are strict, so an unknown or excluded field is a 400, not ignored).
// Every save records what changed, before and after, in the audit log; that is the revision
// history the editor shows. Search titles and descriptions live in the SEO workspace.

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { z } from "@/lib/security/validate";
import { checkImageRef } from "@/modules/seo/paths";

export class ContentError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------------------------
// Validation

const line = (max: number) => z.string().trim().min(1, "Can't be empty.").max(max, `Keep it under ${max} characters.`);
const optionalLine = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`);
const list = (maxItems: number, maxLen: number) =>
  z
    .array(line(maxLen))
    .max(maxItems, `Up to ${maxItems} items.`)
    .refine((items) => new Set(items.map((i) => i.toLowerCase())).size === items.length, "Remove the repeated item.");

const image = z.string().transform((value, ctx) => {
  const check = checkImageRef(value);
  if (!check.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.error });
    return z.NEVER;
  }
  return check.value;
});

const section = z
  .object({
    heading: optionalLine(160),
    body: z.array(line(4000)).max(20).default([]),
    items: z.array(line(400)).max(40).default([]),
    steps: z.array(z.object({ time: optionalLine(40), text: line(600) }).strict()).max(40).default([]),
    stops: z.array(z.object({ name: line(160), text: optionalLine(1000) }).strict()).max(30).default([]),
    note: optionalLine(1000).nullable().default(null),
  })
  .strict();

const tab = z.object({ label: line(40), sections: z.array(section).max(20) }).strict();

export const tourContentSchema = z
  .object({
    title: line(150),
    summary: line(400),
    description: line(20_000),
    durationHours: z.number().min(0.25).max(24 * 30),
    isFeatured: z.boolean(),
    sortOrder: z.number().int().min(0).max(10_000),
    highlights: list(30, 300),
    inclusions: list(40, 300),
    exclusions: list(40, 300),
    whatToBring: list(40, 300),
    facts: z.array(z.object({ label: line(60), value: line(160) }).strict()).max(8),
    faqs: z.array(z.object({ question: line(300), answer: line(4000) }).strict()).max(40),
    tabs: z.array(tab).max(10),
    featuredImage: image,
    galleryImages: z.array(image).max(40),
    crossSells: z.array(z.string().regex(/^[a-z0-9-]{2,120}$/, "Not a tour slug.")).max(12),
  })
  .partial()
  .strict();

export const destinationContentSchema = z
  .object({
    name: line(80),
    province: line(60),
    region: line(80),
    description: line(20_000),
    heroImage: image,
    isFeatured: z.boolean(),
  })
  .partial()
  .strict();

/** The edit plus the version the editor started from, so two people can't overwrite each other. */
export const saveSchema = <T extends z.ZodTypeAny>(fields: T) =>
  z.object({ fields, expectedUpdatedAt: z.coerce.date().optional() }).strict();

type TourFields = z.infer<typeof tourContentSchema>;
type DestinationFields = z.infer<typeof destinationContentSchema>;

// ---------------------------------------------------------------------------------------------
// Reads

const TOUR_FIELDS = {
  id: true,
  slug: true,
  title: true,
  category: true,
  bookingMode: true,
  summary: true,
  description: true,
  durationHours: true,
  isFeatured: true,
  sortOrder: true,
  highlights: true,
  inclusions: true,
  exclusions: true,
  whatToBring: true,
  facts: true,
  faqs: true,
  tabs: true,
  featuredImage: true,
  galleryImages: true,
  crossSells: true,
  updatedAt: true,
  destination: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.TourSelect;

export async function listContent() {
  const [tours, destinations] = await Promise.all([
    prisma.tour.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, slug: true, title: true, category: true, isFeatured: true, featuredImage: true, updatedAt: true, destination: { select: { name: true } } },
    }),
    prisma.destination.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true, isFeatured: true, heroImage: true } }),
  ]);
  return { tours, destinations };
}

async function history(entityType: "Tour" | "Destination", entityId: string) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId, action: { startsWith: "CONTENT_" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, action: true, details: true, createdAt: true, user: { select: { name: true, email: true } } },
  });
}

export async function getTourContent(id: string) {
  const tour = await prisma.tour.findUnique({ where: { id }, select: TOUR_FIELDS });
  if (!tour) return null;
  const otherTours = await prisma.tour.findMany({ where: { NOT: { id } }, orderBy: { title: "asc" }, select: { slug: true, title: true } });
  return { tour, otherTours, history: await history("Tour", id) };
}

export async function getDestinationContent(id: string) {
  const destination = await prisma.destination.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true, province: true, region: true, description: true, heroImage: true, isFeatured: true },
  });
  if (!destination) return null;
  return { destination, history: await history("Destination", id) };
}

// ---------------------------------------------------------------------------------------------
// Writes

/** Field-by-field changes; unchanged fields are dropped so the history shows only real edits. */
function diff(current: Record<string, unknown>, next: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(next)) {
    if (JSON.stringify(current[key]) !== JSON.stringify(value)) changes[key] = { from: current[key] ?? null, to: value };
  }
  return changes;
}

function assertFresh(updatedAt: Date, expected?: Date) {
  if (expected && Math.abs(updatedAt.getTime() - expected.getTime()) > 0) {
    throw new ContentError(409, "Someone else saved this since you opened it. Reload to see their changes, then make yours again.");
  }
}

export async function saveTourContent(id: string, fields: TourFields, userId: string, expectedUpdatedAt?: Date) {
  const current = await prisma.tour.findUnique({ where: { id }, select: TOUR_FIELDS });
  if (!current) throw new ContentError(404, "Tour not found.");
  assertFresh(current.updatedAt, expectedUpdatedAt);
  if (fields.crossSells?.length) {
    if (fields.crossSells.includes(current.slug)) throw new ContentError(400, "A tour can't recommend itself.");
    const known = await prisma.tour.count({ where: { slug: { in: fields.crossSells } } });
    if (known !== new Set(fields.crossSells).size) throw new ContentError(400, "One of the related tours doesn't exist.");
  }
  const changes = diff(current as unknown as Record<string, unknown>, fields);
  if (Object.keys(changes).length === 0) return { changed: [] as string[], ...(await getTourContent(id))! };
  await prisma.$transaction(async (tx) => {
    await tx.tour.update({ where: { id }, data: fields as Prisma.TourUpdateInput });
    await tx.auditLog.create({
      data: { userId, action: "CONTENT_TOUR_UPDATED", entityType: "Tour", entityId: id, details: { slug: current.slug, changes } as Prisma.InputJsonValue },
    });
  });
  return { changed: Object.keys(changes), ...(await getTourContent(id))! };
}

export async function saveDestinationContent(id: string, fields: DestinationFields, userId: string, expectedUpdatedAt?: Date) {
  const current = await prisma.destination.findUnique({ where: { id } });
  if (!current) throw new ContentError(404, "Destination not found.");
  // Destinations have no updatedAt column; the latest content edit stands in for it.
  const last = await prisma.auditLog.findFirst({ where: { entityType: "Destination", entityId: id, action: { startsWith: "CONTENT_" } }, orderBy: { createdAt: "desc" } });
  if (expectedUpdatedAt && last && last.createdAt.getTime() > expectedUpdatedAt.getTime()) {
    throw new ContentError(409, "Someone else saved this since you opened it. Reload to see their changes, then make yours again.");
  }
  const changes = diff(current as unknown as Record<string, unknown>, fields);
  if (Object.keys(changes).length === 0) return { changed: [] as string[], ...(await getDestinationContent(id))! };
  await prisma.$transaction(async (tx) => {
    await tx.destination.update({ where: { id }, data: fields });
    await tx.auditLog.create({
      data: { userId, action: "CONTENT_DESTINATION_UPDATED", entityType: "Destination", entityId: id, details: { slug: current.slug, changes } as Prisma.InputJsonValue },
    });
  });
  return { changed: Object.keys(changes), ...(await getDestinationContent(id))! };
}
