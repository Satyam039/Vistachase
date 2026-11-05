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
import { bookingIcs, googleCalendarLink, icsLink } from "@/modules/bookings/calendar-event";
import { resolveShuttlePickupTime } from "@/modules/shuttles/shuttle-timing";
import { experienceTitle } from "@/modules/bookings/tour-itinerary";
import { sendStaffBookingNotice } from "@/modules/bookings/staff-booking-notice";

export const ADMIN_NOTIFICATION_RECIPIENTS = {
  to: "support@vistachase.com",
  cc: [
    "business@mannosolutions.com",
    "naveensahraay@gmail.com",
    "yourguiderahul@gmail.com",
  ],
};

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
  const isShuttle = Boolean(
    d.shuttleRouteId ||
    d.shuttleRoute ||
    d.tour?.category === "SHUTTLE" ||
    d.tour?.slug?.includes("shuttle"),
  );
  const title = experienceTitle(d);
  const time = clock(formatTimeOfDay(d.departureTime));
  const place = b.pickupStop?.name || b.pickupCustomText;
  const pickupTime = resolveShuttlePickupTime({
    departureTime: formatTimeOfDay(d.departureTime),
    town: b.pickupStop?.town,
    stopName: b.pickupStop?.name,
    customText: b.pickupCustomText,
    storedPickupTime: b.pickupTime,
    isShuttle,
  });
  const pickup = pickupTime ? `${clock(pickupTime)}${place ? ` at ${place}` : ""}` : (place ?? "Pickup details to follow by email");
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
    // Staff hear about the booking whether or not the guest's email goes through (sent once).
    await sendStaffBookingNotice(live, trip);
  }

  try {
    const pdf = await itineraryPdf(live, trip ? { title: trip.title, reference: trip.reference } : null);
    const tripReference = trip?.reference ?? lead.bookingReference;
    const title = trip?.title ?? dayLines(lead).title;
    const total = live.reduce((n, b) => n + b.totalAmount, 0);
    const paid = Math.min(total, live.reduce((n, b) => n + paidCents(b.payments), 0));
    const currency = lead.currency;
    const days = live.map((b, i) => ({ ...dayLines(b), day: i + 1, reference: b.bookingReference, link: voucherLink(b.bookingReference), google: googleCalendarLink(b) }));
    const multi = live.length > 1;
    // Manage booking (manage-booking.ts): the lead day's voucher page, opened at its Manage section.
    const manageLink = `${voucherLink(lead.bookingReference)}#manage`;
    // Add to calendar: the .ics (attached too, so iPhone Mail shows "Add to Calendar") and Google.
    const calendarFile = icsLink(lead.bookingReference);

    const dayHtml = days
      .map(
        (d) => `
          <tr><td style="padding: 12px 0; border-top: 1px solid #e1e1db;">
            <p style="margin: 0; color: #257780; font-size: 13px; font-weight: bold;">${multi ? `Day ${d.day} · ` : ""}${escapeHtml(d.date)}</p>
            <p style="margin: 4px 0 0; font-weight: bold;">${escapeHtml(d.title)}</p>
            <p style="margin: 4px 0 0; color: #5d6168; font-size: 14px;">${d.time ? `Departs ${d.time} · ` : ""}Pickup: ${escapeHtml(d.pickup)}</p>
            <p style="margin: 4px 0 0; font-size: 14px;"><a href="${d.link}" style="color: #257780;">${multi ? `Day ${d.day} voucher (${d.reference})` : "Open your voucher"}</a>${multi ? ` · <a href="${escapeHtml(d.google)}" style="color: #257780;">Add day ${d.day} to Google Calendar</a>` : ""}</p>
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
        <p style="margin: 0 0 6px; font-weight: bold;">Add to your calendar</p>
        <p style="margin: 0 0 20px;">
          <a href="${escapeHtml(calendarFile)}" style="display: inline-block; border: 1px solid #257780; color: #257780; text-decoration: none; padding: 10px 16px; margin: 0 8px 8px 0;">iPhone / Apple / Outlook</a>
          <a href="${escapeHtml(days[0].google)}" style="display: inline-block; border: 1px solid #257780; color: #257780; text-decoration: none; padding: 10px 16px; margin: 0 8px 8px 0;">Android / Google Calendar${multi ? " (Day 1)" : ""}</a>
        </p>
        <p style="margin: 24px 0;"><a href="${manageLink}" style="display: inline-block; background: #257780; color: #ffffff; text-decoration: none; padding: 12px 22px; font-weight: bold;">Manage booking</a></p>
        <p style="color: #5d6168; font-size: 13px; margin-top: -12px;">Change the lead guest's name or phone, ask for a different date, or cancel.</p>
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
      `Manage booking (change name or phone, ask for another date, cancel): ${manageLink}`,
      `Add to calendar: iPhone / Apple / Outlook ${calendarFile} · Google Calendar ${days[0].google}`,
      "Your itinerary is attached as a PDF. Questions? Call +1 (825) 734-9456 or write to support@vistachase.com.",
    ].join("\n");

    const result = await getEmailProvider().sendEmail({
      to: lead.customerEmail,
      subject: `Your Vista Chase booking is confirmed: ${tripReference}`,
      html,
      text,
      attachments: [
        { filename: `Vista-Chase-itinerary-${tripReference}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" },
        { filename: `Vista-Chase-${tripReference}.ics`, content: Buffer.from(bookingIcs(live), "utf8"), contentType: "text/calendar; charset=utf-8; method=PUBLISH" },
      ],
    });
    if (!result.success) throw new Error(result.error || "The email provider refused the message.");

    // Send concise admin/support notification email with essential booking facts and 3 CC addresses
    const adminHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b;">
        <h2 style="color: #0f766e; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #0f766e; padding-bottom: 8px;">
          New Booking Notification · ${escapeHtml(tripReference)}
        </h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold; width: 180px;">Booking Reference:</td><td style="padding: 8px 0; font-weight: bold; color: #0f766e;">${escapeHtml(tripReference)}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Booking Status:</td><td style="padding: 8px 0;"><span style="background-color: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${escapeHtml(lead.status)}</span></td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Customer Name:</td><td style="padding: 8px 0;">${escapeHtml(lead.customerName)}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Customer Email:</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(lead.customerEmail)}" style="color: #0f766e;">${escapeHtml(lead.customerEmail)}</a></td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Customer Phone:</td><td style="padding: 8px 0;">${escapeHtml(lead.customerPhone)}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Tour Name:</td><td style="padding: 8px 0;">${escapeHtml(title)}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Booking Date:</td><td style="padding: 8px 0;">${formatDateOnly(lead.createdAt)}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Departure Date &amp; Time:</td><td style="padding: 8px 0;">${escapeHtml(days.map((d) => `${d.date}${d.time ? ` at ${d.time}` : ""}`).join("; "))}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Number of Guests:</td><td style="padding: 8px 0;">${lead.totalSeats}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Total Amount Paid:</td><td style="padding: 8px 0; font-weight: bold;">${money(paid, currency)}${balance > 0 ? ` (Balance due: ${money(balance, currency)})` : ""}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Pickup Location &amp; Time:</td><td style="padding: 8px 0;">${escapeHtml(days.map((d) => d.pickup).join("; "))}</td></tr>
          </tbody>
        </table>
      </div>`;

    const adminText = [
      `New Booking Notification: ${tripReference}`,
      `Customer Name: ${lead.customerName}`,
      `Customer Email: ${lead.customerEmail}`,
      `Customer Phone: ${lead.customerPhone}`,
      `Tour Name: ${title}`,
      `Booking Date: ${formatDateOnly(lead.createdAt)}`,
      `Departure Date & Time: ${days.map((d) => `${d.date}${d.time ? ` at ${d.time}` : ""}`).join("; ")}`,
      `Number of Guests: ${lead.totalSeats}`,
      `Total Amount Paid: ${money(paid, currency)} (Total: ${money(total, currency)})`,
      `Pickup Location & Time: ${days.map((d) => d.pickup).join("; ")}`,
      `Booking Reference: ${tripReference}`,
      `Booking Status: ${lead.status}`,
    ].join("\n");

    getEmailProvider()
      .sendEmail({
        to: ADMIN_NOTIFICATION_RECIPIENTS.to,
        cc: ADMIN_NOTIFICATION_RECIPIENTS.cc,
        subject: `[New Booking] ${tripReference} - ${lead.customerName} - ${title}`,
        html: adminHtml,
        text: adminText,
      })
      .catch((e) => console.error(`[admin-booking-notification] ${tripReference} error:`, (e as Error).message));

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
