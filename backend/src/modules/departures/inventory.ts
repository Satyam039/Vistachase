// Seats on a departure: who may sell them, and the only code that changes the seat counters.
//
// Every change is one conditional UPDATE, so two guests racing for the last seats can't both get
// them: Postgres locks the row, re-checks the WHERE clause after the first commit, and the
// second update matches nothing. The TourDeparture_capacity_check constraint backs this up.
// Releases run only after the hold or booking has been claimed with a conditional status update
// (see booking-status.ts), so each seat is released once.
//
// Inventory source: only LOCAL departures (entered or confirmed by staff) are sold. EXTERNAL is
// for a future provider sync and UNVERIFIED for seeded or unknown schedules; neither is listed
// publicly or accepted for a hold or booking.

import type { InventorySource, Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { transitionBooking } from "@/modules/bookings/booking-status";
import { seatsToReserve } from "@/modules/pricing/departure-pricing";

type Tx = Prisma.TransactionClient;

export const SELLABLE_SOURCES: InventorySource[] = ["LOCAL"];

/** Prisma filter for departures the public may see and book. */
export const sellableInventoryWhere = { inventorySource: { in: SELLABLE_SOURCES } } satisfies Prisma.TourDepartureWhereInput;

export function isSellableInventory(departure: { inventorySource: InventorySource }): boolean {
  return SELLABLE_SOURCES.includes(departure.inventorySource);
}

/** The customer-facing reason a departure's seats can't be sold online, or null when they can. */
export function inventoryError(departure: { inventorySource: InventorySource }): string | null {
  if (isSellableInventory(departure)) return null;
  return departure.inventorySource === "EXTERNAL"
    ? "Live availability for this date can't be confirmed right now. Please send us an enquiry and we'll check it for you."
    : "This date isn't confirmed for online booking yet. Please send us an enquiry and we'll check it for you.";
}

/** Holds `seats` if that many are free. False (nothing changed) when they aren't. */
export async function takeHeldSeats(tx: Tx, departureId: string, seats: number): Promise<boolean> {
  const updated = await tx.$executeRaw`
    UPDATE "TourDeparture"
    SET "capacityHeld" = "capacityHeld" + ${seats}, "updatedAt" = ${new Date()}
    WHERE "id" = ${departureId} AND "status" = 'ACTIVE'
      AND "capacityTotal" - "capacityBooked" - "capacityHeld" >= ${seats}`;
  return updated === 1;
}

/**
 * Books `seats`, first returning `fromHeld` seats of the guest's own hold. False (nothing
 * changed) when the seats aren't free.
 */
export async function takeBookedSeats(tx: Tx, departureId: string, seats: number, fromHeld = 0): Promise<boolean> {
  const updated = await tx.$executeRaw`
    UPDATE "TourDeparture"
    SET "capacityBooked" = "capacityBooked" + ${seats},
        "capacityHeld" = GREATEST("capacityHeld" - ${fromHeld}, 0),
        "updatedAt" = ${new Date()}
    WHERE "id" = ${departureId} AND "status" = 'ACTIVE'
      AND "capacityTotal" - "capacityBooked" - GREATEST("capacityHeld" - ${fromHeld}, 0) >= ${seats}`;
  return updated === 1;
}

export async function releaseHeldSeats(tx: Tx, departureId: string, seats: number) {
  await tx.$executeRaw`
    UPDATE "TourDeparture" SET "capacityHeld" = GREATEST("capacityHeld" - ${seats}, 0), "updatedAt" = ${new Date()}
    WHERE "id" = ${departureId}`;
}

export async function releaseBookedSeats(tx: Tx, departureId: string, seats: number) {
  await tx.$executeRaw`
    UPDATE "TourDeparture" SET "capacityBooked" = GREATEST("capacityBooked" - ${seats}, 0), "updatedAt" = ${new Date()}
    WHERE "id" = ${departureId}`;
}

/** Holds no longer carry the guest's details once they can't become a booking. */
const clearedHoldContact = { customerName: "", customerEmail: "", customerPhone: null };

/**
 * Ends one hold (EXPIRED or RELEASED) and frees its seats, once. False when it was not ACTIVE
 * (already converted, released or expired by someone else).
 */
export async function endHold(tx: Tx, hold: { id: string; tourDepartureId: string; seatsCount: number }, status: "EXPIRED" | "RELEASED") {
  const claimed = await tx.reservationHold.updateMany({ where: { id: hold.id, status: "ACTIVE" }, data: { status, ...clearedHoldContact } });
  if (claimed.count === 0) return false;
  await releaseHeldSeats(tx, hold.tourDepartureId, hold.seatsCount);
  return true;
}

/**
 * Ends one unpaid or cancelled booking and frees its seats, once: the status move is the claim.
 * Pending payments are marked failed. False when the booking was not in one of `from`.
 */
export async function endBooking(
  tx: Tx,
  booking: { id: string; tourDepartureId: string; totalSeats: number },
  from: Parameters<typeof transitionBooking>[2],
  to: "CANCELLED" | "EXPIRED",
  reason: string,
) {
  const moved = await transitionBooking(tx, booking.id, from, to, { reason });
  if (!moved) return false;
  await tx.payment.updateMany({ where: { bookingId: booking.id, status: "PENDING" }, data: { status: "FAILED" } });
  const departure = await tx.tourDeparture.findUnique({
    where: { id: booking.tourDepartureId },
    select: { price: true, capacityTotal: true, tour: { select: { category: true } } },
  });
  if (departure) await releaseBookedSeats(tx, booking.tourDepartureId, seatsToReserve(departure, booking.totalSeats));
  return true;
}

/** Unpaid bookings created before payment deadlines were stored expire this long after creation. */
export const PENDING_PAYMENT_MINUTES = 30;

/**
 * Frees seats held by expired holds and by bookings whose payment window passed: for one
 * departure (called before every hold and booking, so seats come back even with no job runner)
 * or for all of them (the scheduled job). Each record is claimed in its own small transaction.
 */
export async function freeExpiredSeats(options: { departureId?: string; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const scope = options.departureId ? { tourDepartureId: options.departureId } : {};

  const holds = await prisma.reservationHold.findMany({
    where: { ...scope, status: "ACTIVE", expiresAt: { lt: now } },
    select: { id: true, tourDepartureId: true, seatsCount: true },
  });
  let expiredHolds = 0;
  for (const hold of holds) if (await prisma.$transaction((tx) => endHold(tx, hold, "EXPIRED"))) expiredHolds++;

  const legacyCutoff = new Date(now.getTime() - PENDING_PAYMENT_MINUTES * 60_000);
  const bookings = await prisma.booking.findMany({
    where: {
      ...scope,
      status: "PENDING_PAYMENT",
      OR: [{ paymentExpiresAt: { lt: now } }, { paymentExpiresAt: null, createdAt: { lt: legacyCutoff } }],
    },
    select: { id: true, tourDepartureId: true, totalSeats: true, bookingReference: true, payments: { where: { status: "PENDING", provider: "stripe" }, select: { id: true } } },
  });
  let expiredBookings = 0;
  for (const booking of bookings) {
    // Paid at Stripe but the webhook never came: confirm it instead of releasing the seats. Loaded
    // lazily because payment-sync imports the booking code, which imports this file.
    if (booking.payments.length > 0) {
      const { syncPendingPayments } = await import("@/modules/bookings/payment-sync");
      if (await syncPendingPayments(booking.bookingReference)) continue;
    }
    if (await prisma.$transaction((tx) => endBooking(tx, booking, ["PENDING_PAYMENT"], "EXPIRED", "payment window expired"))) expiredBookings++;
  }

  return { holds: expiredHolds, bookings: expiredBookings };
}
