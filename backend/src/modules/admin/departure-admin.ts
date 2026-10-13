// Staff departure management (docs/ADMIN.md): list, add (one or many dates at once), edit price and
// seats, take off sale and put back on sale. Departures are never deleted: a cancelled one keeps
// its row, so the deploy's schedule seed (scripts/seed-departures.ts, insert-missing only) doesn't
// add it back. Price changes apply to new bookings only; existing bookings keep their priceSnapshot.

import type { DepartureStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { dateOnly, formatDateOnly, formatTimeOfDay, timeOfDay, todayInMountainTime } from "@/lib/utils/time";

const ACTIVE_BOOKING = ["PENDING_PAYMENT", "CONFIRMED", "PAID_UNSYNCED"] as const;
const cents = (dollars: number) => Math.round(dollars * 100);

function addDays(day: string, days: number) {
  const d = dateOnly(day);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnly(d);
}

export async function listDepartures(filter: { tourSlug?: string; routeSlug?: string; from?: string; to?: string; status?: DepartureStatus }) {
  const from = filter.from ?? todayInMountainTime();
  const to = filter.to ?? addDays(from, 13);
  const departures = await prisma.tourDeparture.findMany({
    where: {
      date: { gte: dateOnly(from), lte: dateOnly(to) },
      ...(filter.tourSlug ? { tour: { slug: filter.tourSlug } } : {}),
      ...(filter.routeSlug ? { shuttleRoute: { slug: filter.routeSlug } } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: [{ date: "asc" }, { departureTime: "asc" }],
    take: 500,
    include: {
      tour: { select: { slug: true, title: true, category: true } },
      shuttleRoute: { select: { slug: true, name: true } },
      _count: { select: { bookings: { where: { status: { in: [...ACTIVE_BOOKING] } } } } },
    },
  });
  return {
    from,
    to,
    departures: departures.map((d) => ({
      id: d.id,
      date: formatDateOnly(d.date),
      departureTime: formatTimeOfDay(d.departureTime),
      returnTime: formatTimeOfDay(d.returnTime),
      experience: d.tour?.title ?? d.shuttleRoute?.name ?? "Departure",
      tourSlug: d.tour?.slug ?? null,
      routeSlug: d.shuttleRoute?.slug ?? null,
      category: d.tour?.category ?? "SHUTTLE",
      capacityTotal: d.capacityTotal,
      capacityBooked: d.capacityBooked,
      capacityHeld: d.capacityHeld,
      activeBookings: d._count.bookings,
      price: d.price / 100,
      childPrice: d.childPrice != null ? d.childPrice / 100 : null,
      currency: d.currency,
      status: d.status,
      inventorySource: d.inventorySource,
    })),
  };
}

/** What staff can sell departures of: bookable tours and shuttle routes. */
export async function departureProducts() {
  const [tours, routes] = await Promise.all([
    prisma.tour.findMany({ orderBy: { title: "asc" }, select: { slug: true, title: true, category: true, bookingMode: true, currency: true } }),
    prisma.shuttleRoute.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  return { tours, routes };
}

export interface NewDepartures {
  tourSlug?: string;
  routeSlug?: string;
  dates: string[];
  times: string[];
  returnTime?: string | null;
  capacityTotal: number;
  price: number; // dollars: per guest, or per vehicle for private tours
  childPrice?: number | null;
}

/** Adds a departure for each date × time. Ones that already exist are skipped, not changed. */
export async function createDepartures(input: NewDepartures) {
  const tour = input.tourSlug ? await prisma.tour.findUnique({ where: { slug: input.tourSlug }, select: { id: true, currency: true, bookingMode: true } }) : null;
  const route = input.routeSlug ? await prisma.shuttleRoute.findUnique({ where: { slug: input.routeSlug }, select: { id: true } }) : null;
  if (!tour && !route) return { status: 404, error: "Tour or shuttle route not found" } as const;
  if (tour?.bookingMode === "ENQUIRY") return { status: 400, error: "This tour is booked on request, so it has no departures to sell." } as const;

  const created: string[] = [];
  let skipped = 0;
  for (const date of Array.from(new Set(input.dates)).sort()) {
    for (const time of Array.from(new Set(input.times)).sort()) {
      const where = { date: dateOnly(date), departureTime: timeOfDay(time), ...(tour ? { tourId: tour.id } : { shuttleRouteId: route!.id }) };
      if (await prisma.tourDeparture.findFirst({ where, select: { id: true } })) {
        skipped++;
        continue;
      }
      const dep = await prisma.tourDeparture.create({
        data: {
          ...where,
          returnTime: input.returnTime ? timeOfDay(input.returnTime) : null,
          capacityTotal: input.capacityTotal,
          price: cents(input.price),
          childPrice: input.childPrice != null ? cents(input.childPrice) : null,
          currency: tour?.currency ?? "CAD",
          status: "ACTIVE",
          inventorySource: "LOCAL",
          inventoryVerifiedAt: new Date(),
        },
      });
      created.push(dep.id);
    }
  }
  return { status: 201, created, skipped } as const;
}

export interface DepartureEdit {
  capacityTotal?: number;
  price?: number;
  childPrice?: number | null;
  returnTime?: string | null;
}

export async function updateDeparture(id: string, edit: DepartureEdit) {
  const dep = await prisma.tourDeparture.findUnique({ where: { id } });
  if (!dep) return { status: 404, error: "Departure not found" } as const;
  if (edit.capacityTotal !== undefined && edit.capacityTotal < dep.capacityBooked + dep.capacityHeld) {
    return { status: 400, error: `Seats can't go below the ${dep.capacityBooked} booked and ${dep.capacityHeld} held.` } as const;
  }
  // The seat check is repeated in the UPDATE so a booking landing meanwhile can't be oversold
  // (the TourDeparture_capacity_check constraint backs this up).
  const updated = await prisma.tourDeparture.updateMany({
    where: { id, ...(edit.capacityTotal !== undefined ? { capacityBooked: { lte: edit.capacityTotal - dep.capacityHeld } } : {}) },
    data: {
      ...(edit.capacityTotal !== undefined ? { capacityTotal: edit.capacityTotal } : {}),
      ...(edit.price !== undefined ? { price: cents(edit.price) } : {}),
      ...(edit.childPrice !== undefined ? { childPrice: edit.childPrice === null ? null : cents(edit.childPrice) } : {}),
      ...(edit.returnTime !== undefined ? { returnTime: edit.returnTime ? timeOfDay(edit.returnTime) : null } : {}),
    },
  });
  if (updated.count === 0) return { status: 409, error: "Seats were booked meanwhile. Reload and try again." } as const;
  return { status: 200, before: { capacityTotal: dep.capacityTotal, price: dep.price, childPrice: dep.childPrice, returnTime: formatTimeOfDay(dep.returnTime) } } as const;
}

/**
 * Takes a departure off sale (CANCELLED) or puts it back (ACTIVE). Only a departure with no
 * active bookings or seat holds can be cancelled: staff cancel or move those bookings first, so
 * no guest is left with a voucher for a trip that isn't running.
 */
export async function setDepartureStatus(id: string, status: "ACTIVE" | "CANCELLED") {
  const dep = await prisma.tourDeparture.findUnique({ where: { id } });
  if (!dep) return { status: 404, error: "Departure not found" } as const;
  if (status === "CANCELLED") {
    const active = await prisma.booking.count({ where: { tourDepartureId: id, status: { in: [...ACTIVE_BOOKING] } } });
    if (active > 0 || dep.capacityHeld > 0) {
      return {
        status: 409,
        error: active > 0 ? `This departure has ${active} active booking${active === 1 ? "" : "s"}. Cancel them first.` : "A guest is checking out on this departure right now. Try again in a few minutes.",
      } as const;
    }
  }
  const moved = await prisma.tourDeparture.updateMany({
    where: { id, ...(status === "CANCELLED" ? { capacityBooked: 0, capacityHeld: 0 } : {}) },
    data: { status },
  });
  if (moved.count === 0) return { status: 409, error: "Seats were taken meanwhile. Reload and try again." } as const;
  return { status: 200, previous: dep.status } as const;
}
