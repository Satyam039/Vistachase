// The booking confirmation email, with the PDF itinerary attached (voucher-pdf.ts itineraryPdf).
//
// Sent only for bookings the booking workflow has confirmed (status CONFIRMED or COMPLETED): by
// confirmPaidBooking once payment is verified, and by staff Approve / Quick Book when they choose
// to notify the guest. A multi-day trip (trip.ts) gets ONE email once every day is confirmed,
// listing all days, sent when the last day confirms.
//
// Exactly once: before sending, the trip's Day 1 booking claims confirmationEmailSentAt with a
// conditional update, so webhook retries and concurrent confirmations can't send it twice. A
// failed send clears the claim, records the error on the booking and in the audit log, and the
// jobs runner retries it (retryFailedConfirmationEmails). Staff "Resend voucher" sends it again
// on purpose (force).

import { cancellationTerms, termsSentence } from "@/modules/bookings/cancellation-policy";
import prisma from "@/lib/db/prisma";
import { getEmailProvider } from "@/lib/email/email.provider";
import { voucherLink } from "@/lib/security/signed-links";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";
import { itineraryPdf } from "@/modules/bookings/voucher-pdf";
import { DEPOSIT_PERCENT, paidCents } from "@/modules/bookings/deposit";
import { balanceDueLabel } from "@/modules/bookings/booking.repository";
import { tripBookings, tripOf, type TripBooking } from "@/modules/bookings/trip";

export type ConfirmationResult = "sent" | "already-sent" | "not-confirmed" | "waiting-for-other-days" | "failed";

const CONFIRMED = ["CONFIRMED", "COMPLETED"];
const ENDED = ["CANCELLED", "EXPIRED", "REFUNDED"];

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (cents: number, currency: string) => `$${(cents / 100).toFixed(2)} ${currency}`;

function longDate(d: Date) {
  return new Date(`${formatDateOnly(d)}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function clock(hhmm: string | null) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function dayLines(b: TripBooking) {
  const d = b.tourDeparture;
  const title = d.tour?.title || d.shuttleRoute?.name || "Vista Chase experience";
  const time = clock(formatTimeOfDay(d.departureTime));
  const place = b.pickupStop?.name || b.pickupCustomText;
  const pickup = b.pickupTime ? `${clock(b.pickupTime)}${place ? ` at ${place}` : ""}` : (place ?? "Pickup details to follow by email");
  return { title, date: longDate(d.date), time, pickup };
}

/** Builds and sends the email for a confirmed booking (or its whole trip). */
export async function sendConfirmationEmail(reference: string, options: { force?: boolean } = {}): Promise<ConfirmationResult> {
  const all = await tripBookings(reference);
  if (all.length === 0) return "not-confirmed";
  const self = all.find((b) => b.bookingReference === reference) ?? all[0];
  if (!CONFIRMED.includes(self.status)) return "not-confirmed";

  // A trip waits until no day is still waiting for payment; days cancelled meanwhile are left out.
  const live = all.filter((b) => !ENDED.includes(b.status));
  if (live.some((b) => !CONFIRMED.includes(b.status))) return "waiting-for-other-days";
  const trip = tripOf(self.priceSnapshot, self.bookingReference);
  const lead = live[0];

  if (!options.force) {
    const claimed = await prisma.booking.updateMany({ where: { id: lead.id, confirmationEmailSentAt: null }, data: { confirmationEmailSentAt: new Date() } });
    if (claimed.count === 0) return "already-sent";
  }

  try {
    const pdf = await itineraryPdf(live, trip ? { title: trip.title, reference: trip.reference } : null);
    const tripReference = trip?.reference ?? lead.bookingReference;
    const title = trip?.title ?? dayLines(lead).title;
    const total = live.reduce((n, b) => n + b.totalAmount, 0);
    const paid = Math.min(total, live.reduce((n, b) => n + paidCents(b.payments), 0));
    const currency = lead.currency;
    const days = live.map((b, i) => ({ ...dayLines(b), day: i + 1, reference: b.bookingReference, link: voucherLink(b.bookingReference) }));
    const multi = live.length > 1;

    const dayHtml = days
      .map(
        (d) => `
          <tr><td style="padding: 12px 0; border-top: 1px solid #e1e1db;">
            <p style="margin: 0; color: #257780; font-size: 13px; font-weight: bold;">${multi ? `Day ${d.day} · ` : ""}${escapeHtml(d.date)}</p>
            <p style="margin: 4px 0 0; font-weight: bold;">${escapeHtml(d.title)}</p>
            <p style="margin: 4px 0 0; color: #5d6168; font-size: 14px;">${d.time ? `Departs ${d.time} · ` : ""}Pickup: ${escapeHtml(d.pickup)}</p>
            <p style="margin: 4px 0 0; font-size: 14px;"><a href="${d.link}" style="color: #257780;">${multi ? `Day ${d.day} voucher (${d.reference})` : "Open your voucher"}</a></p>
          </td></tr>`,
      )
      .join("");
    const balance = total - paid;
    const deposit = live.find((b) => b.paymentPlan === "DEPOSIT");
    const dueBy = balance > 0 && deposit ? ` by ${balanceDueLabel(deposit.balanceDueAt)}` : "";
    // Booking & Cancellation Policy for this product (cancellation-policy.ts); a deposit doesn't change it.
    const policy = `${termsSentence(cancellationTerms(lead.tourDeparture.tour?.category, multi))}${deposit && balance > 0 ? ` You paid a ${DEPOSIT_PERCENT}% deposit: pay the balance from your voucher.` : ""}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1c1f23;">
        <h2 style="font-weight: normal;">Your booking is confirmed</h2>
        <p>Hi ${escapeHtml(lead.customerName)}, thank you for booking with Vista Chase. Your itinerary is attached as a PDF.</p>
        <div style="border: 1px solid #e1e1db; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 6px;"><strong>Booking reference:</strong> ${tripReference}</p>
          <p style="margin: 0 0 6px;"><strong>${multi ? "Trip" : "Experience"}:</strong> ${escapeHtml(title)}${multi ? ` (${live.length} days)` : ""}</p>
          <p style="margin: 0 0 6px;"><strong>Guests:</strong> ${lead.totalSeats}</p>
          <p style="margin: 0 0 6px;"><strong>Total:</strong> ${money(total, currency)} · <strong>Paid:</strong> ${money(paid, currency)}${balance > 0 ? ` · <strong>Balance due:</strong> ${money(balance, currency)}${dueBy}` : ""}</p>
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 8px;">${dayHtml}</table>
        </div>
        <p>Be at your pickup 10 minutes early and show your voucher to your guide, printed or on your phone.</p>
        <p style="color: #5d6168; font-size: 13px;">${policy} Questions? Reply to this email, call +1 (825) 734-9456 (6 a.m. – 9 p.m. Mountain Time) or write to support@vistachase.com.</p>
      </div>`;
    const text = [
      `Your Vista Chase booking ${tripReference} is confirmed.`,
      `${multi ? "Trip" : "Experience"}: ${title}${multi ? ` (${live.length} days)` : ""}`,
      `Guests: ${lead.totalSeats}`,
      `Total ${money(total, currency)}, paid ${money(paid, currency)}${balance > 0 ? `, balance due ${money(balance, currency)}${dueBy}` : ""}.`,
      "",
      ...days.map((d) => `${multi ? `Day ${d.day}: ` : ""}${d.date}, ${d.title}${d.time ? `, departs ${d.time}` : ""}. Pickup: ${d.pickup}. Voucher: ${d.link}`),
      "",
      policy,
      "Your itinerary is attached as a PDF. Questions? Call +1 (825) 734-9456 or write to support@vistachase.com.",
    ].join("\n");

    const result = await getEmailProvider().sendEmail({
      to: lead.customerEmail,
      subject: `Your Vista Chase booking is confirmed: ${tripReference}`,
      html,
      text,
      attachments: [{ filename: `Vista-Chase-itinerary-${tripReference}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }],
    });
    if (!result.success) throw new Error(result.error || "The email provider refused the message.");

    const ids = live.map((b) => b.id);
    await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { confirmationEmailSentAt: new Date(), confirmationEmailError: null } });
    await prisma.auditLog.create({ data: { action: "CONFIRMATION_EMAIL_SENT", entityType: "Booking", entityId: lead.id, details: { references: live.map((b) => b.bookingReference), forced: Boolean(options.force) } } });
    return "sent";
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    console.error(`[confirmation-email] ${reference} failed: ${message}`);
    await prisma.booking.update({ where: { id: lead.id }, data: { ...(options.force ? {} : { confirmationEmailSentAt: null }), confirmationEmailError: message } }).catch(() => {});
    await prisma.auditLog.create({ data: { action: "CONFIRMATION_EMAIL_FAILED", entityType: "Booking", entityId: lead.id, details: { reference, error: message } } }).catch(() => {});
    return "failed";
  }
}

/** Jobs runner: retries confirmation emails that failed in the last 7 days. Returns how many went out. */
export async function retryFailedConfirmationEmails(now = new Date()) {
  const due = await prisma.booking.findMany({
    where: { confirmationEmailError: { not: null }, confirmationEmailSentAt: null, status: { in: ["CONFIRMED", "COMPLETED"] }, updatedAt: { gte: new Date(now.getTime() - 7 * 86400_000) } },
    select: { bookingReference: true },
    take: 20,
  });
  let sent = 0;
  for (const b of due) if ((await sendConfirmationEmail(b.bookingReference)) === "sent") sent++;
  return sent;
}
