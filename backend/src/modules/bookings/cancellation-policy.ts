// Booking & Cancellation Policy (owner's "Vista Chase General Terms Conditions and Privacy Policy",
// October 28, 2026; the public page is /privacy-policy-vista-chase):
//
//   Shared tours and shuttles             at least 24 hours before departure      full refund
//   Private single-day tours              at least 72 hours before departure      full refund
//   Private packages of two or more days  at least 72 hours before the first day  80% refund
//   After the deadline, or a no-show                                              no refund
//
// For a private multi-day package the 20% kept is 20% of the total price, not of an instalment:
// if only a 20% deposit was paid, it is kept and nothing is refunded. A deposit never changes the
// deadline or the amount kept (section 11). Activity tickets follow the operator's rules; online
// they keep the 72-hour full-refund rule. Times are Mountain Time (getMountainTimeInstant).

import prisma from "@/lib/db/prisma";
import { getMountainTimeInstant } from "@/lib/utils/time";
import { tripOf } from "@/modules/bookings/trip";

export interface CancellationTerms {
  /** Cancel at least this many hours before departure (the first day, for a multi-day package). */
  cutoffHours: number;
  /** Share of the booking's total price kept on an eligible cancellation. */
  keepPercent: number;
}

/** The rules for a product category; `multiDay` marks a private booking that is one day of a package. */
export function cancellationTerms(category: string | null | undefined, multiDay = false): CancellationTerms {
  if (category === "SHARED" || category === "SHUTTLE") return { cutoffHours: 24, keepPercent: 0 };
  if (category === "MULTIDAY" || (category === "PRIVATE" && multiDay)) return { cutoffHours: 72, keepPercent: 20 };
  return { cutoffHours: 72, keepPercent: 0 };
}

/** Refund on an eligible cancellation: everything paid less the share of the total kept. */
export const eligibleRefundCents = (paidCents: number, totalCents: number, keepPercent: number) =>
  Math.max(0, paidCents - Math.round((totalCents * keepPercent) / 100));

/** One line for emails and errors, e.g. "Free cancellation up to 24 hours before departure." */
export function termsSentence(terms: CancellationTerms) {
  return terms.keepPercent > 0
    ? `Cancel at least ${terms.cutoffHours} hours before the first tour day for an 80% refund; ${terms.keepPercent}% of the total price is non-refundable. No refund after that.`
    : `Free cancellation up to ${terms.cutoffHours} hours before departure. No refund after that.`;
}

export interface PolicyBooking {
  bookingReference: string;
  totalAmount: number;
  priceSnapshot: unknown;
  payments: { status: string; amount: number }[];
  tourDeparture: { date: Date; departureTime: Date; tour: { category: string } | null; shuttleRouteId?: string | null };
}

export interface PolicyDecision extends CancellationTerms {
  /** The moment the cutoff is measured from: this departure, or Day 1 of a private package. */
  startsAt: Date;
  hoursLeft: number;
  /** Cancelled at `at`, does the booking qualify for a refund at all? */
  eligible: boolean;
  paidCents: number;
  refundCents: number;
}

/** What the policy gives back if the booking is cancelled at `at`. */
export async function policyDecision(booking: PolicyBooking, at = new Date()): Promise<PolicyDecision> {
  // A shuttle route booking has no tour: it is a shuttle.
  const category = booking.tourDeparture.tour?.category ?? (booking.tourDeparture.shuttleRouteId ? "SHUTTLE" : null);
  const trip = tripOf(booking.priceSnapshot, booking.bookingReference);
  const privatePackage = category === "PRIVATE" && !!trip;
  const terms = cancellationTerms(category, privatePackage);

  let startsAt = getMountainTimeInstant(booking.tourDeparture.date, booking.tourDeparture.departureTime);
  // A package's cutoff is the first tour day's; it doesn't restart for each day.
  if (trip && (privatePackage || category === "MULTIDAY") && trip.reference !== booking.bookingReference) {
    const first = await prisma.booking.findUnique({
      where: { bookingReference: trip.reference },
      select: { tourDeparture: { select: { date: true, departureTime: true } } },
    });
    if (first) startsAt = getMountainTimeInstant(first.tourDeparture.date, first.tourDeparture.departureTime);
  }

  const hoursLeft = (startsAt.getTime() - at.getTime()) / 3_600_000;
  const eligible = hoursLeft >= terms.cutoffHours;
  const paidCents = booking.payments.filter((p) => p.status === "SUCCEEDED").reduce((sum, p) => sum + p.amount, 0);
  const refundCents = eligible ? eligibleRefundCents(paidCents, booking.totalAmount, terms.keepPercent) : 0;
  return { ...terms, startsAt, hoursLeft, eligible, paidCents, refundCents };
}
