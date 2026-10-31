// Booking status changes. Every change goes through transitionBooking: it allows only the moves
// below, applies them with a conditional update (so two racing callers can't both make the same
// move, and the winner is the one that releases seats or sends email), and writes an audit row.
//
//   PENDING_PAYMENT → CONFIRMED     verified payment (Stripe webhook, or an instant/free booking),
//                                   or staff Quick Book (paid offline, or unpaid with a PAYMENT_DUE flag),
//                                   or staff Approve (docs/ADMIN.md)
//   PAID_UNSYNCED   → CONFIRMED     staff Approve (paid under the former Bókun integration)
//   PENDING_PAYMENT → EXPIRED       payment window passed
//   PENDING_PAYMENT → CANCELLED     payment failed, was cancelled or couldn't start
//   CONFIRMED       → CANCELLED     guest cancelled within policy, or staff cancelled (docs/ADMIN.md)
//   CANCELLED       → REFUNDED      refund issued (by the provider, or marked sent by staff)
//   CONFIRMED       → COMPLETED     the day after the trip (review request job)
// A submitted form never confirms a booking by itself.
//
// With Bókun connected, CONFIRMED and CANCELLED also queue the same change for Bókun in the same
// transaction (modules/bokun/bokun-sync.ts), so every booking lands in both systems.

import type { BookingStatus, Prisma } from "@prisma/client";
import { queueBokunSync } from "@/modules/bokun/bokun-sync";

const ALLOWED_FROM: Record<BookingStatus, BookingStatus[]> = {
  PENDING_PAYMENT: [],
  CONFIRMED: ["PENDING_PAYMENT", "PAID_UNSYNCED"],
  EXPIRED: ["PENDING_PAYMENT"],
  CANCELLED: ["PENDING_PAYMENT", "CONFIRMED", "PAID_UNSYNCED"],
  REFUNDED: ["CANCELLED"],
  COMPLETED: ["CONFIRMED"],
  PAID_UNSYNCED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_FROM[to].includes(from);
}

/**
 * Moves a booking from one of `from` to `to`. True when this call made the move; false when the
 * booking was no longer in one of `from` (someone else moved it first). Throws on a move the
 * rules don't allow, which is a programming error.
 */
export async function transitionBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
  from: BookingStatus[],
  to: BookingStatus,
  details: Record<string, unknown> = {},
): Promise<boolean> {
  const illegal = from.filter((f) => !canTransition(f, to));
  if (illegal.length > 0) throw new Error(`Booking status ${illegal.join(", ")} → ${to} is not allowed`);

  const moved = await tx.booking.updateMany({ where: { id: bookingId, status: { in: from } }, data: { status: to } });
  if (moved.count === 0) return false;
  await tx.auditLog.create({
    data: { action: `BOOKING_${to}`, entityType: "Booking", entityId: bookingId, details: { to, ...details } as Prisma.InputJsonValue },
  });
  await queueBokunSync(tx, bookingId, to);
  return true;
}
