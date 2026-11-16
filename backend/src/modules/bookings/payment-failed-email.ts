// "Your payment didn't go through" email, sent when Stripe reports a booking's card payment failed
// or was cancelled (webhooks.routes.ts) and the booking was cancelled because of it. A package
// (several bookings, one payment) gets one email from its Day 1 booking. A failed balance payment
// of a deposit booking is not this email: that booking stays confirmed.

import prisma from "@/lib/db/prisma";
import { getEmailProvider } from "@/lib/email/email.provider";
import { renderMasterEmail } from "@/lib/email/email-template";
import { siteUrl } from "@/lib/security/signed-links";
import { formatDateOnly } from "@/lib/utils/time";
import { tripOf } from "@/modules/bookings/trip";
import { experienceTitle } from "@/modules/bookings/tour-itinerary";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Sends the email for a booking whose payment failed. Never throws; returns whether it went out. */
export async function sendPaymentFailedEmail(reference: string): Promise<boolean> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { bookingReference: reference },
      include: { tourDeparture: { include: { tour: true, shuttleRoute: true } } },
    });
    if (!booking) return false;
    const trip = tripOf(booking.priceSnapshot, booking.bookingReference);
    if (trip && trip.reference !== booking.bookingReference) return false; // the package's Day 1 sends it

    const d = booking.tourDeparture;
    const title = trip?.title ?? experienceTitle(d);
    const when = trip ? `starting ${formatDateOnly(d.date)}` : `on ${formatDateOnly(d.date)}`;
    const retry = d.tour?.slug ? `${siteUrl()}/tours/${d.tour.slug}` : `${siteUrl()}/search`;

    const rendered = renderMasterEmail({
      subject: `Your Vista Chase payment didn't go through: ${booking.bookingReference}`,
      preheader: `Payment could not be processed for booking ${booking.bookingReference}. You have not been charged.`,
      title: "Payment Unsuccessful",
      greeting: `Hi ${escapeHtml(booking.customerName)},`,
      paragraphs: [
        `The card payment for <strong>${escapeHtml(title)}</strong> ${when} (reference ${escapeHtml(booking.bookingReference)}) didn't go through, so the booking was not confirmed and you have not been charged.`,
        "Seats are not held automatically. You can book again using another card or payment method:",
      ],
      cta: {
        label: "Choose Your Date & Try Again",
        url: retry,
      },
      disclaimer: "Questions, or prefer to book by phone? Call +1 (825) 734-9456 (6 a.m. – 9 p.m. Mountain Time) or write to support@vistachase.com.",
      plainTextLines: [
        `Your card payment for ${title} ${when} (reference ${booking.bookingReference}) didn't go through, so the booking was not confirmed and you have not been charged.`,
        `Book again with another card: ${retry}`,
        "Questions? Call +1 (825) 734-9456 or write to support@vistachase.com.",
      ],
    });

    const result = await getEmailProvider().sendEmail({
      to: booking.customerEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (!result.success) throw new Error(result.error || "The email provider refused the message.");
    return true;
  } catch (err) {
    console.error(`[payment-failed-email] ${reference} failed: ${(err as Error).message}`);
    return false;
  }
}
