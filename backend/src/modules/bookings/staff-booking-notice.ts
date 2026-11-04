// Staff summary of every new booking (owner, 2026-11-03): support@vistachase.com (BOOKING_COPY_TO)
// gets who booked what, when, the pickup, the party and what was paid, instead of a copy of the
// guest's email. Sent once per booking or trip, when it confirms, even if the guest's own email
// fails; the audit log entry STAFF_BOOKING_NOTICE_SENT keeps retries from sending it twice.

import prisma from "@/lib/db/prisma";
import { getEmailProvider } from "@/lib/email/email.provider";
import { siteUrl } from "@/lib/security/signed-links";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";
import { paidCents } from "@/modules/bookings/deposit";
import { experienceTitle } from "@/modules/bookings/tour-itinerary";
import type { TripBooking } from "@/modules/bookings/trip";

/**
 * Who gets the staff booking summary (staff-booking-notice.ts): BOOKING_COPY_TO (comma-separated),
 * default support@vistachase.com; BOOKING_COPY_TO=off sends none.
 */
export function bookingCopyRecipients(): string[] {
  const raw = (process.env.BOOKING_COPY_TO ?? "support@vistachase.com").trim();
  if (!raw || raw.toLowerCase() === "off") return [];
  return raw.split(",").map((s) => s.trim()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

const ACTION = "STAFF_BOOKING_NOTICE_SENT";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (cents: number, currency: string) => `$${(cents / 100).toFixed(2)} ${currency}`;

function party(b: TripBooking) {
  const parts = [`${b.adultsCount} adult${b.adultsCount === 1 ? "" : "s"}`];
  if (b.childrenCount) parts.push(`${b.childrenCount} youth`);
  if (b.infantsCount) parts.push(`${b.infantsCount} infant${b.infantsCount === 1 ? "" : "s"}`);
  return parts.join(", ");
}

function pickup(b: TripBooking) {
  const stop = b.pickupStop;
  const place = stop ? [stop.name, stop.address].filter(Boolean).join(", ") : b.pickupCustomText;
  return [b.pickupTime, place].filter(Boolean).join(" at ") || "Not chosen yet";
}

/** Sends the summary for a confirmed booking or trip. Never throws. */
export async function sendStaffBookingNotice(live: TripBooking[], trip: { title: string; reference: string } | null): Promise<void> {
  const to = bookingCopyRecipients();
  const lead = live[0];
  if (!lead || to.length === 0) return;
  try {
    const done = await prisma.auditLog.findFirst({ where: { action: ACTION, entityType: "Booking", entityId: lead.id }, select: { id: true } });
    if (done) return;

    const currency = lead.currency;
    const total = live.reduce((n, b) => n + b.totalAmount, 0);
    const paid = Math.min(total, live.reduce((n, b) => n + paidCents(b.payments), 0));
    const reference = trip?.reference ?? lead.bookingReference;
    const title = trip?.title ?? experienceTitle(lead.tourDeparture);
    const admin = `${siteUrl()}/admin/bookings`;

    const rows: [string, string][] = [
      ["Reference", reference],
      ["Experience", title],
      ...live.map((b, i): [string, string] => {
        const d = b.tourDeparture;
        const time = formatTimeOfDay(d.departureTime);
        return [live.length > 1 ? `Day ${i + 1}` : "Date", `${formatDateOnly(d.date)}${time ? ` at ${time}` : ""}${live.length > 1 ? ` · ${experienceTitle(d)} (${b.bookingReference})` : ""}`];
      }),
      ["Guest", lead.customerName],
      ["Email", lead.customerEmail],
      ["Phone", lead.customerPhone],
      ["Party", `${party(lead)} (${lead.totalSeats} seat${lead.totalSeats === 1 ? "" : "s"})`],
      ["Pickup", pickup(lead)],
      ["Total", money(total, currency)],
      ["Paid", `${money(paid, currency)}${total > paid ? ` · balance ${money(total - paid, currency)} still due` : ""}`],
      ...(lead.specialRequests ? ([["Requests", lead.specialRequests]] as [string, string][]) : []),
    ];

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; color: #1c1f23;">
        <h2 style="font-weight: normal; margin: 0 0 12px;">New booking: ${escapeHtml(reference)}</h2>
        <table role="presentation" style="border-collapse: collapse; font-size: 14px;">
          ${rows.map(([k, v]) => `<tr><td style="padding: 4px 16px 4px 0; color: #5d6168; vertical-align: top;">${k}</td><td style="padding: 4px 0;">${escapeHtml(v)}</td></tr>`).join("")}
        </table>
        <p style="font-size: 14px;"><a href="${admin}" style="color: #257780;">Open Admin → Bookings</a> and search ${escapeHtml(reference)}.</p>
      </div>`;
    const text = [...rows.map(([k, v]) => `${k}: ${v}`), "", `Admin: ${admin}`].join("\n");

    const result = await getEmailProvider().sendEmail({
      to,
      replyTo: lead.customerEmail,
      subject: `New booking ${reference}: ${title}, ${formatDateOnly(lead.tourDeparture.date)}, ${lead.customerName}`,
      html,
      text,
    });
    if (!result.success) throw new Error(result.error || "The email provider refused the message.");
    await prisma.auditLog.create({ data: { action: ACTION, entityType: "Booking", entityId: lead.id, details: { reference, to } } });
  } catch (err) {
    console.error(`[staff-booking-notice] ${lead.bookingReference} failed: ${(err as Error).message}`);
  }
}
