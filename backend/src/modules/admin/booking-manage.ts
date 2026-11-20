// Admin booking management (Admin → Bookings → open a booking → "Manage booking" page):
// the extra facts the full booking page shows (tour photo, pickup address, source, Bókun state and
// log), and the staff actions it adds on top of the existing ones (cancel, approve, resend,
// notes, which keep their own endpoints):
//
//   - Change tour date: moves the booking to another departure of the same tour (seats moved in
//     one transaction), sends the change to Bókun (bokun-sync.ts queueBokunDateChange) and emails
//     the guest the date-change email with the updated PDF ticket.
//   - Edit guest details: lead guest name, email and phone (audited; Bókun keeps what it was sent).
//
// Docs: docs/ADMIN.md ("Manage booking page").

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { dateOnly, formatDateOnly, formatTimeOfDay, getMountainTimeInstant, todayInMountainTime } from "@/lib/utils/time";
import { releaseBookedSeats, takeBookedSeats } from "@/modules/departures/inventory";
import { seatsToReserve } from "@/modules/pricing/departure-pricing";
import { bokunBusy, bokunProductId, queueBokunDateChange, queueBokunNoteUpdate } from "@/modules/bokun/bokun-sync";
import { bokunSeatsError } from "@/modules/bokun/bokun-seats";
import { bokunConnected, bokunIsTestAccount } from "@/modules/bokun/config";
import { bokunInboundEnabled } from "@/modules/bokun/bokun-inbound";
import { sendDateChangeEmail } from "@/modules/bookings/confirmation-email";
import { BALANCE_DUE_DAYS_BEFORE, depositTerms } from "@/modules/bookings/deposit";
import { staffAudit } from "@/modules/admin/booking-admin";

const MOVABLE = ["CONFIRMED", "PENDING_PAYMENT", "PAID_UNSYNCED"] as const;
const CHANGE_PREFIX = "Change request";

const departureSelect = {
  id: true, date: true, departureTime: true, returnTime: true, price: true, currency: true, capacityTotal: true, capacityBooked: true, capacityHeld: true,
  status: true, inventorySource: true, tourId: true, shuttleRouteId: true,
  tour: { select: { title: true, category: true } },
} satisfies Prisma.TourDepartureSelect;

/** What the Manage booking page shows besides the existing booking detail (GET /bookings/:id). */
export async function bookingOverview(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, bookingReference: true, status: true, createdAt: true, updatedAt: true, bokunBookingId: true, externalSyncStatus: true,
      lastSyncAttemptAt: true, customerId: true, voucherCode: true, paymentPlan: true,
      affiliate: { select: { name: true, code: true } },
      pickupStop: { select: { name: true, town: true, address: true, instructions: true } },
      tourDeparture: {
        select: {
          id: true, date: true, departureTime: true, returnTime: true,
          tour: { select: { title: true, slug: true, featuredImage: true, category: true, bokunId: true } },
          shuttleRoute: { select: { name: true } },
        },
      },
    },
  });
  if (!booking) return null;
  const quickBook = await prisma.auditLog.findFirst({ where: { entityType: "Booking", entityId: booking.id, action: "QUICK_BOOK" }, include: { user: { select: { name: true } } } });
  const source = quickBook
    ? `Staff (Quick Book${quickBook.user?.name ? ` by ${quickBook.user.name}` : ""})`
    : booking.affiliate
      ? `Partner: ${booking.affiliate.name}`
      : "Website";
  const dep = booking.tourDeparture;
  const inBokunScope = bokunProductId(dep.tour) != null;
  const [tasks, lastPull, events] = await Promise.all([
    prisma.bookingSyncTask.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.bokunSyncLog.findFirst({ where: { syncType: "BOOKING_PULL" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, status: true } }),
    prisma.auditLog.findMany({ where: { entityType: "Booking", entityId: booking.id, action: { startsWith: "BOKUN_" } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const synced = tasks.filter((t) => t.status === "SUCCEEDED").map((t) => t.updatedAt);
  const lastSynced = [booking.lastSyncAttemptAt, ...synced, ...(booking.bokunBookingId && lastPull ? [lastPull.createdAt] : [])]
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return {
    id: booking.id,
    reference: booking.bookingReference,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    source,
    tour: {
      title: dep.tour?.title ?? dep.shuttleRoute?.name ?? "Booking",
      slug: dep.tour?.slug ?? null,
      image: dep.tour?.featuredImage || null,
      category: dep.tour?.category ?? "SHUTTLE",
    },
    departure: {
      id: dep.id,
      date: formatDateOnly(dep.date),
      time: formatTimeOfDay(dep.departureTime),
      returnTime: dep.returnTime ? formatTimeOfDay(dep.returnTime) : null,
    },
    pickup: booking.pickupStop,
    bokun: {
      connected: bokunConnected(),
      testAccount: bokunIsTestAccount(),
      inboundSync: bokunInboundEnabled(),
      product: inBokunScope,
      code: booking.bokunBookingId,
      status: booking.externalSyncStatus,
      lastSyncedAt: lastSynced,
      lastCheckedAt: lastPull?.createdAt ?? null,
      tasks: tasks.map((t) => ({
        id: t.id, operation: t.operation, status: t.status, attempts: t.attempts, lastError: t.lastError, externalRef: t.externalRef,
        createdAt: t.createdAt, updatedAt: t.updatedAt, nextAttemptAt: t.nextAttemptAt,
      })),
      events: events.map((e) => ({ id: e.id, action: e.action, details: e.details, createdAt: e.createdAt })),
    },
  };
}

/** Departures of the same tour (or shuttle route) the booking can move to. */
export async function dateOptions(bookingId: string, range: { from?: string; to?: string }) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { totalSeats: true, tourDeparture: { select: { id: true, tourId: true, shuttleRouteId: true } } },
  });
  if (!booking) return { status: 404, error: "Booking not found" } as const;
  const dep = booking.tourDeparture;
  const from = range.from && range.from > todayInMountainTime() ? range.from : todayInMountainTime();
  const departures = await prisma.tourDeparture.findMany({
    where: {
      ...(dep.tourId ? { tourId: dep.tourId } : { shuttleRouteId: dep.shuttleRouteId }),
      id: { not: dep.id },
      status: { not: "CANCELLED" },
      date: { gte: dateOnly(from), ...(range.to ? { lte: dateOnly(range.to) } : {}) },
    },
    orderBy: [{ date: "asc" }, { departureTime: "asc" }],
    take: 120,
    select: departureSelect,
  });
  return {
    status: 200,
    departures: departures.map((d) => {
      const needed = seatsToReserve({ price: d.price, capacityTotal: d.capacityTotal, tour: d.tour }, booking.totalSeats);
      const left = Math.max(0, d.capacityTotal - d.capacityBooked - d.capacityHeld);
      return {
        id: d.id,
        date: formatDateOnly(d.date),
        time: formatTimeOfDay(d.departureTime),
        price: d.price / 100,
        currency: d.currency,
        seatsLeft: left,
        fits: d.status === "ACTIVE" && left >= needed,
        onSale: d.inventorySource === "LOCAL" && d.status === "ACTIVE",
        status: d.status,
      };
    }),
  } as const;
}

export interface ChangeDateInput {
  departureId: string;
  reason: string;
  notifyGuest: boolean;
}

/**
 * Moves a booking to another departure of the same tour: seats taken on the new one and released
 * on the old one in one transaction, Bókun told (create on the new date, then cancel the old),
 * and the guest emailed the updated ticket. The price stays as booked.
 */
export async function changeBookingDate(bookingId: string, input: ChangeDateInput, staffId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { tourDeparture: { include: { tour: { select: { category: true, slug: true, bokunId: true } } } } },
  });
  if (!booking) return { status: 404, error: "Booking not found" } as const;
  if (!(MOVABLE as readonly string[]).includes(booking.status)) {
    return { status: 409, error: `A ${booking.status.toLowerCase().replace("_", " ")} booking can't be moved.` } as const;
  }
  const old = booking.tourDeparture;
  if (input.departureId === old.id) return { status: 400, error: "That is the booking's current departure." } as const;
  const target = await prisma.tourDeparture.findUnique({ where: { id: input.departureId }, include: { tour: { select: { category: true, slug: true, bokunId: true } } } });
  if (!target) return { status: 404, error: "Departure not found" } as const;
  const sameProduct = old.tourId ? target.tourId === old.tourId : target.shuttleRouteId === old.shuttleRouteId;
  if (!sameProduct) return { status: 400, error: "Pick a departure of the same tour." } as const;
  if (target.status !== "ACTIVE") return { status: 409, error: "That departure is full or cancelled." } as const;
  if (formatDateOnly(target.date) < todayInMountainTime()) return { status: 400, error: "That date has passed." } as const;
  if (await bokunBusy(booking.id)) {
    return { status: 409, error: "This booking is being sent to Bókun right now. Try again in a minute." } as const;
  }
  // With Bókun connected, Bókun's own seats on the new start decide too (as for a new booking).
  if (bokunProductId(target.tour)) {
    const refused = await bokunSeatsError(target.id, booking.totalSeats);
    if (refused) return { status: 409, error: `Bókun: ${refused}` } as const;
  }

  const previous = `${formatDateOnly(old.date)} ${formatTimeOfDay(old.departureTime)}`;
  const next = `${formatDateOnly(target.date)} ${formatTimeOfDay(target.departureTime)}`;
  const oldCode = booking.bokunBookingId;
  const moved = await prisma.$transaction(async (tx) => {
    const seats = seatsToReserve(target, booking.totalSeats);
    if (!(await takeBookedSeats(tx, target.id, seats))) return "full" as const;
    const claimed = await tx.booking.updateMany({
      where: { id: booking.id, tourDepartureId: old.id, status: { in: [...MOVABLE] } },
      data: { tourDepartureId: target.id },
    });
    if (claimed.count !== 1) throw new Error("changed");
    await releaseBookedSeats(tx, old.id, seatsToReserve(old, booking.totalSeats));
    // A deposit booking's balance falls due a fixed time before the (new) trip.
    if (booking.paymentPlan === "DEPOSIT" && !booking.balancePaidAt) {
      // Within the deposit window of the new date the balance is due now (the reminders job chases it).
      const due = getMountainTimeInstant(target.date, target.departureTime).getTime() - BALANCE_DUE_DAYS_BEFORE * 86_400_000;
      const balanceDueAt = depositTerms(booking.totalAmount, getMountainTimeInstant(target.date, target.departureTime))?.balanceDueAt ?? new Date(Math.max(Date.now(), due));
      await tx.booking.update({ where: { id: booking.id }, data: { balanceDueAt, balanceReminderStage: 0 } });
    }
    // The guest's own "Change request" (Manage booking on the voucher) is answered by the move.
    await tx.bookingFlag.updateMany({
      where: { bookingId: booking.id, status: "OPEN", type: "OTHER", note: { startsWith: CHANGE_PREFIX } },
      data: { status: "RESOLVED", resolvedById: staffId, resolvedAt: new Date(), resolution: `Moved to ${next}.` },
    });
    await staffAudit(tx, staffId, "CHANGE_DATE", "Booking", booking.id, {
      from: previous, to: next, fromDepartureId: old.id, toDepartureId: target.id, reason: input.reason, notifyGuest: input.notifyGuest,
      priceKept: booking.totalAmount, newDeparturePrice: target.price,
    });
    await queueBokunDateChange(tx, booking.id, oldCode);
    return "moved" as const;
  }).catch((e) => {
    if ((e as Error).message === "changed") return "changed" as const;
    throw e;
  });
  if (moved === "full") return { status: 409, error: "Not enough seats left on that departure." } as const;
  if (moved === "changed") return { status: 409, error: "The booking changed meanwhile. Reload and try again." } as const;

  let email: string = "not-sent";
  if (input.notifyGuest) {
    email = booking.status === "CONFIRMED" ? await sendDateChangeEmail(booking.bookingReference, { previous }) : "not-confirmed";
  }
  return {
    status: 200,
    from: previous,
    to: next,
    email,
    bokun: oldCode || bokunProductId(target.tour) ? (bokunConnected() ? "queued" : "not-connected") : "not-a-bokun-product",
    priceDifference: target.price !== old.price ? (target.price - old.price) / 100 : 0,
  } as const;
}

export interface GuestContactInput {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

/** Edit Booking → lead guest's name, email and phone. Recorded in the booking history. */
export async function updateGuestContact(bookingId: string, input: GuestContactInput, staffId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, customerName: true, customerEmail: true, customerPhone: true } });
  if (!booking) return { status: 404, error: "Booking not found" } as const;
  const changes: Record<string, { from: string; to: string }> = {};
  const data: GuestContactInput = {};
  for (const key of ["customerName", "customerEmail", "customerPhone"] as const) {
    const value = input[key];
    if (value !== undefined && value !== booking[key]) {
      changes[key] = { from: booking[key], to: value };
      data[key] = value;
    }
  }
  if (Object.keys(data).length === 0) return { status: 200, changed: [] } as const;
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: booking.id }, data });
    await staffAudit(tx, staffId, "EDIT_GUEST_DETAILS", "Booking", booking.id, { changes });
  });
  // The guest's phone is in the Bókun booking note: send the new one.
  if (data.customerPhone) await queueBokunNoteUpdate(booking.id);
  return { status: 200, changed: Object.keys(data) } as const;
}
