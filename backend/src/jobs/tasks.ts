// Scheduled work, run by the worker process (src/worker.ts). Each task is idempotent and safe to
// run more often than scheduled.

import prisma from "@/lib/db/prisma";
import { getEmailProvider } from "@/lib/email/email.provider";
import { expireUnpaidBookings } from "@/modules/bookings/booking.repository";
import { reviewLink } from "@/lib/security/signed-links";
import { dateOnly, todayInMountainTime } from "@/lib/utils/time";

/** Every few minutes: free seats held by expired holds and by bookings never paid for. */
export async function expireHoldsAndUnpaidBookings(now = new Date()) {
  const holds = await prisma.reservationHold.findMany({ where: { status: "ACTIVE", expiresAt: { lt: now } } });
  for (const hold of holds) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.reservationHold.updateMany({ where: { id: hold.id, status: "ACTIVE" }, data: { status: "EXPIRED" } });
      if (claimed.count === 0) return; // another run got it
      const dep = await tx.tourDeparture.findUnique({ where: { id: hold.tourDepartureId }, select: { capacityHeld: true } });
      await tx.tourDeparture.update({
        where: { id: hold.tourDepartureId },
        data: { capacityHeld: { decrement: Math.min(hold.seatsCount, dep?.capacityHeld ?? 0) } },
      });
    });
  }
  const bookings = await expireUnpaidBookings(now);
  return { holds: holds.length, bookings };
}

export interface ReconciliationIssue {
  bookingReference: string;
  problem: string;
}

/**
 * Nightly: lists bookings that need a person. Paid but not in Bókun (PAID_UNSYNCED, or confirmed for
 * a Bókun product without a Bókun booking ID), stuck awaiting payment, or cancelled while a payment
 * is still marked succeeded. Emails the list to OPS_ALERT_EMAIL (or ENQUIRIES_TO) when not empty.
 * It compares our own records; checking each booking against Bókun's API comes with the live
 * Bókun integration.
 */
export async function reconcileBookings() {
  const issues: ReconciliationIssue[] = [];
  const add = (rows: { bookingReference: string }[], problem: string) => rows.forEach((r) => issues.push({ bookingReference: r.bookingReference, problem }));

  add(await prisma.booking.findMany({ where: { status: "PAID_UNSYNCED" }, select: { bookingReference: true } }), "Paid, but the Bókun reservation failed: create it in Bókun");
  add(
    await prisma.booking.findMany({
      where: { status: "CONFIRMED", bokunBookingId: null, tourDeparture: { tour: { bokunId: { not: null } } } },
      select: { bookingReference: true },
    }),
    "Confirmed for a Bókun product but has no Bókun booking ID",
  );
  add(
    await prisma.booking.findMany({
      where: { status: "PENDING_PAYMENT", createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
      select: { bookingReference: true },
    }),
    "Still awaiting payment after an hour",
  );
  add(
    await prisma.booking.findMany({ where: { status: "CANCELLED", payments: { some: { status: "SUCCEEDED" } } }, select: { bookingReference: true } }),
    "Cancelled, but a payment is still marked succeeded (refund not recorded)",
  );

  const to = process.env.OPS_ALERT_EMAIL || process.env.ENQUIRIES_TO;
  if (issues.length > 0 && to) {
    const lines = issues.map((i) => `${i.bookingReference}: ${i.problem}`);
    await getEmailProvider()
      .sendEmail({
        to,
        subject: `Vista Chase: ${issues.length} booking${issues.length === 1 ? "" : "s"} need attention`,
        html: `<p>The nightly booking check found:</p><ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>`,
        text: `The nightly booking check found:\n${lines.join("\n")}`,
      })
      .catch((e) => console.error("Reconciliation alert email failed:", (e as Error).message));
  }
  return issues;
}

/**
 * Daily: the day after a trip, ask each guest once for a review (signed link) and mark the booking
 * completed (reviews are accepted only for completed trips).
 */
export async function sendReviewRequests(now = new Date()) {
  const yesterday = todayInMountainTime(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const bookings = await prisma.booking.findMany({
    where: { status: "CONFIRMED", reviewRequestedAt: null, tourDeparture: { date: dateOnly(yesterday) } },
    include: { tourDeparture: { include: { tour: true, shuttleRoute: true } } },
  });

  let sent = 0;
  for (const booking of bookings) {
    // Claim first so two runs never email the same guest.
    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, reviewRequestedAt: null },
      data: { reviewRequestedAt: now, status: "COMPLETED" },
    });
    if (claimed.count === 0) continue;
    const title = booking.tourDeparture.tour?.title || booking.tourDeparture.shuttleRoute?.name || "your Vista Chase trip";
    const link = reviewLink(booking.bookingReference);
    await getEmailProvider()
      .sendEmail({
        to: booking.customerEmail,
        subject: `How was ${title}?`,
        html: `<p>Hi ${booking.customerName.replace(/[<>&]/g, "")},</p><p>Thank you for travelling with Vista Chase yesterday. If you have a minute, <a href="${link}">tell us how your day went</a>.</p><p style="color:#5d6168;font-size:12px">This is a one-time message about your booking ${booking.bookingReference}. We don't send marketing email without your consent.</p>`,
        text: `Thank you for travelling with Vista Chase. Tell us how your day went: ${link}\nThis is a one-time message about your booking ${booking.bookingReference}.`,
      })
      .then(() => sent++)
      .catch((e) => console.error(`Review request for ${booking.bookingReference} failed:`, (e as Error).message));
  }
  return sent;
}
