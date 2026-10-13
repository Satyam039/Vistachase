// Staff pickup-stop editor (docs/ADMIN.md). Stops are never deleted: bookings point at them, and
// the deploy's pickup seed (scripts/seed-pickup-stops.ts) re-adds a seeded stop that is missing.
// Turning a stop off (isActive = false) hides it from the checkout and the AI concierge.

import prisma from "@/lib/db/prisma";

export interface StopInput {
  name: string;
  town: string;
  address: string;
  latitude: number;
  longitude: number;
  instructions: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function listStops() {
  const stops = await prisma.shuttleStop.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { bookings: { where: { status: { in: ["PENDING_PAYMENT", "CONFIRMED", "PAID_UNSYNCED"] } } } } } },
  });
  return stops.map(({ _count, ...s }) => ({ ...s, activeBookings: _count.bookings }));
}

async function nameTaken(name: string, exceptId?: string) {
  const existing = await prisma.shuttleStop.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  return Boolean(existing);
}

export async function createStop(input: StopInput) {
  if (await nameTaken(input.name)) return { status: 409, error: "A pickup stop with this name already exists." } as const;
  const max = await prisma.shuttleStop.aggregate({ _max: { sortOrder: true } });
  const stop = await prisma.shuttleStop.create({ data: { ...input, name: input.name.trim(), sortOrder: input.sortOrder ?? (max._max.sortOrder ?? 0) + 1 } });
  return { status: 201, stop } as const;
}

export async function updateStop(id: string, input: Partial<StopInput>) {
  const stop = await prisma.shuttleStop.findUnique({ where: { id } });
  if (!stop) return { status: 404, error: "Pickup stop not found" } as const;
  if (input.name && (await nameTaken(input.name, id))) return { status: 409, error: "A pickup stop with this name already exists." } as const;
  const updated = await prisma.shuttleStop.update({ where: { id }, data: { ...input, ...(input.name ? { name: input.name.trim() } : {}) } });
  return { status: 200, stop: updated, before: stop } as const;
}
