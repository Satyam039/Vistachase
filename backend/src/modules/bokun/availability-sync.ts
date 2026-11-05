// Bókun → website seats. Every few minutes, for each product with a Bókun ID
// (prisma/catalog/product-map.json), reads the next days of availability from Bókun and updates
// the seat counts of our matching departures (same tour, date and start time), so seats sold on
// Bókun's other channels (Viator, GetYourGuide, agents, the Bókun dashboard) can't be sold again here.
//
// The website keeps its own prices and creates its departures from its own schedule
// (scripts/seed-departures.ts, Admin → Departures), but Bókun's live calendar decides which of them
// are on sale: with the live account, a departure Bókun doesn't offer (no start that day at that
// time) is taken off sale (inventorySource UNVERIFIED), and put back on sale (LOCAL) once Bókun
// offers it. To close a date, close it in Bókun. Bookings already made are never touched, and the
// sync never creates, cancels or reprices a departure. With a test account nothing goes off sale.
// Departures Bókun doesn't offer are also listed in the sync log.
//
//   Shared tours and shuttles: total = Bókun's seats left + Bókun's booked; booked = Bókun's booked
//     + our bookings Bókun doesn't have yet. Holds stay on top, so seats left here never exceed
//     Bókun's seats left.
//   Private tours (one vehicle per departure): left alone while we have a booking on it; otherwise
//     sold out here when Bókun has nothing left, open again when Bókun has.

import prisma from "@/lib/db/prisma";
import { PRODUCT_MAP } from "@/modules/tours/product-map";
import { findSlot, slotDate, type BokunAvailability } from "@/modules/bokun/bokun-booking";
import { bokunClient, bokunIsTestAccount, bokunSyncDays, type BokunApi } from "@/modules/bokun/config";
import { dateOnly, formatDateOnly, formatTimeOfDay, todayInMountainTime } from "@/lib/utils/time";

/** Our bookings that hold seats on a departure. */
const SEAT_STATUSES = ["CONFIRMED", "COMPLETED", "PENDING_PAYMENT", "PAID_UNSYNCED"] as const;

export interface SeatSyncResult {
  products: number;
  updated: number;
  unchanged: number;
  /** Our departures (slug date time) that Bókun doesn't offer, first 50. */
  notInBokun: string[];
  /** Departures taken off sale / put back on sale this run because of Bókun's calendar. */
  offSale: number;
  onSale: number;
  errors: string[];
}

/** Reads Bókun's seats for the next `days` days into our departures, and logs the run. */
export async function syncBokunSeats(options: { client?: BokunApi; days?: number; from?: string; now?: Date } = {}): Promise<SeatSyncResult | { skipped: string }> {
  const client = options.client ?? bokunClient();
  if (!client) return { skipped: "Bókun isn't connected (BOKUN_ACCESS_KEY / BOKUN_SECRET_KEY)." };
  const days = options.days ?? bokunSyncDays();
  const start = options.from ?? todayInMountainTime(options.now);
  const end = formatDateOnly(new Date(dateOnly(start).getTime() + (days - 1) * 86_400_000));
  const result: SeatSyncResult = { products: 0, updated: 0, unchanged: 0, notInBokun: [], offSale: 0, onSale: 0, errors: [] };
  const followCalendar = !bokunIsTestAccount();

  for (const product of PRODUCT_MAP.filter((p) => p.bokunId && p.bookingMode === "BOKUN")) {
    const tour = await prisma.tour.findUnique({ where: { slug: product.slug }, select: { id: true, category: true } });
    if (!tour) continue;
    try {
      const fetchedAt = new Date();
      const raw = await client.getAvailabilities(product.bokunId!, start, end);
      const byDay = new Map<string, BokunAvailability[]>();
      for (const a of (Array.isArray(raw) ? raw : []) as BokunAvailability[]) {
        const day = slotDate(a);
        byDay.set(day, [...(byDay.get(day) ?? []), a]);
      }

      const departures = await prisma.tourDeparture.findMany({
        where: { tourId: tour.id, status: { not: "CANCELLED" }, date: { gte: dateOnly(start), lte: dateOnly(end) } },
        select: { id: true, date: true, departureTime: true, inventorySource: true },
        orderBy: [{ date: "asc" }, { departureTime: "asc" }],
      });
      const offSale: string[] = [];
      const onSale: string[] = [];
      for (const dep of departures) {
        const date = formatDateOnly(dep.date);
        const key = `${date} ${formatTimeOfDay(dep.departureTime)}`;
        const slot = findSlot(byDay.get(date) ?? [], date, formatTimeOfDay(dep.departureTime));
        if (!slot) {
          if (result.notInBokun.length < 50) result.notInBokun.push(`${product.slug} ${key}`);
          if (followCalendar && dep.inventorySource === "LOCAL") offSale.push(dep.id);
          continue;
        }
        if (followCalendar && dep.inventorySource === "UNVERIFIED") onSale.push(dep.id);
        (await applySlot(dep.id, tour.category, slot, fetchedAt)) ? result.updated++ : result.unchanged++;
      }
      if (offSale.length > 0) {
        result.offSale += (await prisma.tourDeparture.updateMany({ where: { id: { in: offSale }, inventorySource: "LOCAL" }, data: { inventorySource: "UNVERIFIED", inventoryVerifiedAt: null } })).count;
      }
      if (onSale.length > 0) {
        result.onSale += (await prisma.tourDeparture.updateMany({ where: { id: { in: onSale }, inventorySource: "UNVERIFIED" }, data: { inventorySource: "LOCAL", inventoryVerifiedAt: fetchedAt } })).count;
      }
      result.products++;
    } catch (error) {
      if (bokunIsTestAccount() && (error as any).status === 404) {
        continue;
      }
      result.errors.push(`${product.slug}: ${(error as Error).message.slice(0, 200)}`);
    }
  }

  await prisma.bokunSyncLog.create({
    data: {
      syncType: "POLL",
      recordsSynced: result.updated + result.offSale + result.onSale,
      status: result.errors.length === 0 ? "SUCCESS" : result.products > 0 ? "PARTIAL" : "FAILED",
      details: { ...result, from: start, to: end },
    },
  });
  await prisma.bokunSyncLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } });
  return result;
}

/**
 * Sets one departure's seats from Bókun's slot, under a row lock so a booking made at the same
 * moment is counted. True when something changed.
 */
async function applySlot(departureId: string, category: string, slot: BokunAvailability, fetchedAt: Date) {
  return prisma.$transaction(async (tx) => {
    const [dep] = await tx.$queryRaw<{ capacityTotal: number; capacityBooked: number; capacityHeld: number }[]>`
      SELECT "capacityTotal", "capacityBooked", "capacityHeld" FROM "TourDeparture" WHERE "id" = ${departureId} FOR UPDATE`;
    if (!dep) return false;
    const bokunLeft = slot.unavailable || slot.soldOut ? 0 : Math.max(0, slot.availabilityCount ?? 0);
    const bokunBooked = Math.max(0, slot.bookedParticipants ?? 0);

    let capacityTotal = dep.capacityTotal;
    let capacityBooked = dep.capacityBooked;
    if (category === "PRIVATE") {
      const ours = await tx.booking.count({ where: { tourDepartureId: departureId, status: { in: [...SEAT_STATUSES] } } });
      if (ours > 0) return false;
      capacityBooked = bokunLeft < 1 ? Math.max(0, dep.capacityTotal - dep.capacityHeld) : 0;
    } else {
      // Ours that Bókun doesn't count yet: not sent, or sent after Bókun answered.
      const local = await tx.booking.aggregate({
        where: {
          tourDepartureId: departureId,
          status: { in: [...SEAT_STATUSES] },
          OR: [{ bokunBookingId: null }, { lastSyncAttemptAt: { gte: fetchedAt } }],
        },
        _sum: { totalSeats: true },
      });
      capacityBooked = bokunBooked + (local._sum.totalSeats ?? 0);
      capacityTotal = Math.max(bokunLeft + bokunBooked, capacityBooked + dep.capacityHeld);
    }
    if (capacityTotal === dep.capacityTotal && capacityBooked === dep.capacityBooked) return false;
    await tx.tourDeparture.update({ where: { id: departureId }, data: { capacityTotal, capacityBooked } });
    return true;
  });
}
