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

import { airportTransferSummary } from "@/modules/bookings/airport-transfer";
import { activitiesSummary } from "@/modules/bookings/package-activities";
import { cancellationTerms, termsSentence } from "@/modules/bookings/cancellation-policy";
import prisma from "@/lib/db/prisma";
import { getEmailProvider } from "@/lib/email/email.provider";
import { renderMasterEmail } from "@/lib/email/email-template";
import { voucherLink } from "@/lib/security/signed-links";
import { formatDateOnly, formatTimeOfDay, getMountainTimeInstant } from "@/lib/utils/time";
import { itineraryPdf } from "@/modules/bookings/voucher-pdf";
import { DEPOSIT_PERCENT, paidCents } from "@/modules/bookings/deposit";
import { balanceDueLabel } from "@/modules/bookings/booking.repository";
import { tripBookings, tripOf, type TripBooking } from "@/modules/bookings/trip";
import { bookingIcs, googleCalendarLink, icsLink } from "@/modules/bookings/calendar-event";
import { resolveShuttlePickupTime } from "@/modules/shuttles/shuttle-timing";
import { bookingItinerary, experienceTitle, type ItineraryResult } from "@/modules/bookings/tour-itinerary";
import { sendStaffBookingNotice } from "@/modules/bookings/staff-booking-notice";
import { clockRange, shuttleDepartureForTime } from "@site/shuttleSchedule";

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

const SHARED_ICEFIELD_SLUGS = new Set(["shared-tours-icefields-jasper"]);
const MORAINE_SLUGS = new Set(["banff-highlights-tour", "banff-private-tour"]);

function inSummerDate(d: Date) {
  const iso = formatDateOnly(d);
  const md = iso.slice(5, 10);
  return md >= "06-01" && md <= "10-10";
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
  const shuttleDep = isShuttle ? shuttleDepartureForTime(formatTimeOfDay(d.departureTime)) : undefined;
  const departureLabel = shuttleDep ? `Departure ${shuttleDep.number} · ${time}` : time;
  const shuttleSummary = shuttleDep
    ? `Moraine Lake ${clockRange(shuttleDep.moraine)} · Lake Louise ${clockRange(shuttleDep.louise)} · Est. return: Samson Mall ${clock(shuttleDep.returnSamson)}, Banff ${clock(shuttleDep.returnBanff)}, Canmore ${clock(shuttleDep.returnCanmore)}`
    : null;
  const place = b.pickupStop?.name || b.pickupCustomText;
  const pickupTime = resolveShuttlePickupTime({
    departureTime: formatTimeOfDay(d.departureTime),
    town: b.pickupStop?.town,
    stopName: b.pickupStop?.name,
    customText: b.pickupCustomText,
    storedPickupTime: b.pickupTime,
    isShuttle,
  });
  const pickup = pickupTime ? `${clock(pickupTime)} MT${place ? ` at ${place}` : ""}` : (place ?? "Pickup details to follow by email");
  // Only the tours whose published content says so (frontend lib/tourContent.ts): the shared
  // Icefield tour includes Ice Explorer + Skywalk in summer (on private tours they are an extra), and
  // the Banff & Yoho tours include Moraine Lake access in summer. Any other slug gets no line.
  const slug = d.tour?.slug ?? "";
  const seasonal = SHARED_ICEFIELD_SLUGS.has(slug)
    ? (inSummerDate(d.date)
        ? "Includes Columbia Icefield Glacier Adventure (Ice Explorer) & Skywalk"
        : "Winter itinerary: visits Abraham Lake (guests bring packed lunch or request morning food stop)")
    : MORAINE_SLUGS.has(slug)
      ? (inSummerDate(d.date) ? "Includes seasonal Moraine Lake transportation" : "Winter itinerary with alternative stops")
      : null;
  // The website's current itinerary for exactly this booking (tour-itinerary.ts).
  return { title, date: longDate(d.date), time, departureLabel, shuttleSummary, pickup, seasonal, itinerary: bookingItinerary(b) };
}

export const MISSING_ITINERARY_FLAG = "Itinerary missing";

/**
 * A booking whose confirmation went out without an itinerary (none on the website for what was
 * booked): staff get one open flag (Admin → Bookings → Flags) to send the guest the plan by hand.
 */
async function flagMissingItinerary(booking: { id: string; bookingReference: string }, reason: string) {
  const open = await prisma.bookingFlag.findFirst({ where: { bookingId: booking.id, type: "OTHER", status: "OPEN", note: { startsWith: MISSING_ITINERARY_FLAG } } });
  if (open) return;
  const note = `${MISSING_ITINERARY_FLAG}: ${reason} The guest's confirmation says our team will confirm the itinerary by email: please send it before the tour.`;
  console.warn(`[confirmation-email] ${booking.bookingReference}: ${note}`);
  await prisma.bookingFlag.create({ data: { bookingId: booking.id, type: "OTHER", note: note.slice(0, 1000) } });
}

/** The day's plan in the email: the timeline (or the note that the team will confirm it). */
function itineraryHtml(result: ItineraryResult) {
  if (!result.ok) return `<p style="margin: 8px 0 0; color: #5d6168; font-size: 13px;">${escapeHtml(result.guestNote)}</p>`;
  const plan = result.itinerary;
  const rows = plan.steps
    .map((st) => `<tr><td style="padding: 2px 10px 2px 0; vertical-align: top; color: #257780; font-size: 13px; white-space: nowrap;">${escapeHtml(st.time)}</td><td style="padding: 2px 0; font-size: 13px; color: #3f4650;">${escapeHtml(st.text)}</td></tr>`)
    .join("");
  const stops = plan.stops.length ? `<p style="margin: 6px 0 0; font-size: 13px; color: #3f4650;"><strong>Stops:</strong> ${escapeHtml(plan.stops.map((st) => st.name).join(", "))}</p>` : "";
  return `
            ${plan.heading ? `<p style="margin: 8px 0 0; font-size: 13px; font-weight: bold; color: #1c1f23;">${escapeHtml(plan.heading)}</p>` : ""}
            ${plan.duration ? `<p style="margin: 4px 0 0; font-size: 13px; color: #5d6168;">Duration: ${escapeHtml(plan.duration)}</p>` : ""}
            ${rows ? `<table role="presentation" style="border-collapse: collapse; margin-top: 6px;">${rows}</table>` : ""}
            ${stops}
            <p style="margin: 6px 0 0; font-size: 12px; color: #5d6168;">Full stop-by-stop itinerary in the attached PDF.</p>`;
}

function itineraryText(result: ItineraryResult) {
  if (!result.ok) return [`  ${result.guestNote}`];
  const plan = result.itinerary;
  return [
    ...(plan.heading ? [`  ${plan.heading}`] : []),
    ...(plan.duration ? [`  Duration: ${plan.duration}`] : []),
    ...plan.steps.map((st) => `  ${st.time}: ${st.text}`),
    ...(plan.stops.length ? [`  Stops: ${plan.stops.map((st) => st.name).join(", ")}`] : []),
  ];
}

/** Builds and sends the email for a confirmed booking (or its whole trip). */
export async function sendConfirmationEmail(reference: string, options: { force?: boolean; dateChange?: { previous: string } } = {}): Promise<ConfirmationResult> {
  const all = await tripBookings(reference);
  if (all.length === 0) return "not-confirmed";
  const self = all.find((b) => b.bookingReference === reference) ?? all[0];
  if (!CONFIRMED.includes(self.status)) return "not-confirmed";

  // A trip waits until no day is still waiting for payment; days cancelled meanwhile are left out.
  const live = all.filter((b) => !ENDED.includes(b.status));
  if (live.some((b) => !CONFIRMED.includes(b.status))) return "waiting-for-other-days";
  const trip = tripOf(self.priceSnapshot, self.bookingReference);
  const lead = live[0];

  if (!options.force && !options.dateChange) {
    const claimed = await prisma.booking.updateMany({ where: { id: lead.id, confirmationEmailSentAt: null }, data: { confirmationEmailSentAt: new Date() } });
    if (claimed.count === 0) return "already-sent";
    // Staff hear about the booking whether or not the guest's email goes through (sent once).
    await sendStaffBookingNotice(live, trip);
  }

  try {
    const pdf = await itineraryPdf(live, trip ? { title: trip.title, reference: trip.reference } : null, { updated: Boolean(options.dateChange) });
    const tripReference = trip?.reference ?? lead.bookingReference;
    const title = trip?.title ?? dayLines(lead).title;
    const total = live.reduce((n, b) => n + b.totalAmount, 0);
    const paid = Math.min(total, live.reduce((n, b) => n + paidCents(b.payments), 0));
    const currency = lead.currency;
    const days = live.map((b, i) => ({ ...dayLines(b), day: i + 1, reference: b.bookingReference, link: voucherLink(b.bookingReference), google: googleCalendarLink(b) }));
    const multi = live.length > 1;
    // Days with no current website itinerary: the guest is told the team confirms it, staff are flagged.
    const missingItinerary = days.flatMap((d, i) => (d.itinerary.ok ? [] : [{ booking: live[i], day: d.day, reason: d.itinerary.reason }]));
    for (const m of missingItinerary) {
      await flagMissingItinerary(m.booking, m.reason).catch((e) => console.error(`[confirmation-email] itinerary flag failed: ${(e as Error).message}`));
    }
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
            <p style="margin: 4px 0 0; color: #5d6168; font-size: 14px;">${d.departureLabel ? `Departs ${escapeHtml(d.departureLabel)} · ` : ""}Pickup: ${escapeHtml(d.pickup)}</p>
            ${d.shuttleSummary ? `<p style="margin: 4px 0 0; color: #3f4650; font-size: 13px;">${escapeHtml(d.shuttleSummary)}</p>` : ""}
            ${d.seasonal ? `<p style="margin: 4px 0 0; color: #b45309; font-size: 13px; font-weight: 500;">${escapeHtml(d.seasonal)}</p>` : ""}
            ${itineraryHtml(d.itinerary)}
            <p style="margin: 8px 0 0; font-size: 14px;"><a href="${d.link}" style="color: #257780;">${multi ? `Day ${d.day} voucher (${d.reference})` : "Open your voucher"}</a>${multi ? ` · <a href="${escapeHtml(d.google)}" style="color: #257780;">Add day ${d.day} to Google Calendar</a>` : ""}</p>
          </td></tr>`,
      )
      .join("");
    const requestStatus = lead.specialRequests?.trim()
      ? `${lead.specialRequests.trim()} (requires advance confirmation by our team)`
      : "None requested (complimentary child seats/boosters require advance confirmation)";
    const balance = total - paid;
    const totalFare = live.reduce((n, b) => n + (((b.priceSnapshot as { fareCents?: number })?.fareCents) ?? b.totalAmount), 0);
    const totalDiscount = live.reduce((n, b) => n + (((b.priceSnapshot as { discountCents?: number })?.discountCents) ?? 0), 0);

    // Airport transfer (booked with Day 1): type, route and price, e.g. "Round trip (...), 2 x CAD 850.00 = CAD 1,700.00".
    const transfer = live.map((b) => airportTransferSummary(b.priceSnapshot)).find(Boolean) ?? null;
    // Add-on activities (booked with Day 1) and who joins each, e.g. "Banff Gondola for 2 adults (price confirmed by our team)".
    const activities = live.map((b) => activitiesSummary(b.priceSnapshot)).find(Boolean) ?? null;
    const deposit = live.find((b) => b.paymentPlan === "DEPOSIT");
    const dueBy = balance > 0 && deposit ? ` by ${balanceDueLabel(deposit.balanceDueAt)}` : "";

    const terms = cancellationTerms(lead.tourDeparture.tour?.category, multi);
    let startsAt = getMountainTimeInstant(lead.tourDeparture.date, lead.tourDeparture.departureTime);
    if (multi) {
      const instants = live.map((b) => getMountainTimeInstant(b.tourDeparture.date, b.tourDeparture.departureTime).getTime());
      if (instants.length > 0) startsAt = new Date(Math.min(...instants));
    }
    const cutoffInstant = new Date(startsAt.getTime() - terms.cutoffHours * 3600_000);
    const deadlineDateStr = cutoffInstant.toLocaleDateString("en-CA", { timeZone: "America/Edmonton", weekday: "short", month: "short", day: "numeric", year: "numeric" });
    const deadlineTimeStr = new Intl.DateTimeFormat("en-US", { timeZone: "America/Edmonton", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(cutoffInstant);
    const deadlineLabel = `${deadlineDateStr} at ${deadlineTimeStr}`;

    const isSharedPackage = (lead.tourDeparture.tour?.category === "SHARED" || (trip?.title && trip.title.toLowerCase().includes("two-day") && !trip.title.toLowerCase().includes("private"))) && multi;
    const policy = isSharedPackage
      ? `Cancellation deadline: ${deadlineLabel}. Cancel the entire package at least 24 hours before your first scheduled tour for a full refund. This deadline applies to the whole package, not separately to each day. Later guest cancellations and no-shows are non-refundable.`
      : `${termsSentence(terms)} (Cancellation deadline: ${deadlineLabel}).${deposit && balance > 0 ? ` You paid a ${DEPOSIT_PERCENT}% deposit: pay the balance from your voucher.` : ""}`;

    const text = [
      `Your Vista Chase booking ${tripReference} is confirmed.`,
      `${multi ? "Trip" : "Experience"}: ${title}${multi ? ` (${live.length} days)` : ""}`,
      `Guests: ${lead.totalSeats}`,
      `Free cancellation deadline (Alberta local time): ${deadlineLabel}`,
      `Child seat & special requests: ${requestStatus}`,
      ...(transfer ? [`Airport transfer: ${transfer}`] : []),
      ...(activities ? [`Add-on activities: ${activities}`] : []),
      ...(multi && totalDiscount > 0 ? [`Price breakdown: Regular subtotal ${money(totalFare, currency)}, 10% package savings -${money(totalDiscount, currency)}, Total ${money(total, currency)} (taxes, park admission and mandatory fees included).`] : []),
      `Total ${money(total, currency)}, paid ${money(paid, currency)}${balance > 0 ? `, balance due ${money(balance, currency)}${dueBy}` : ""}.`,
      "",
      ...days.flatMap((d) => [
        `${multi ? `Day ${d.day}: ` : ""}${d.date}, ${d.title}${d.departureLabel ? `, ${d.departureLabel}` : ""}. Pickup: ${d.pickup}.${d.shuttleSummary ? ` Schedule: ${d.shuttleSummary}.` : ""}${d.seasonal ? ` (${d.seasonal})` : ""} Voucher: ${d.link}`,
        ...itineraryText(d.itinerary),
      ]),
      "",
      policy,
      `Manage booking (change name or phone, ask for another date, cancel): ${manageLink}`,
      `Add to calendar: iPhone / Apple / Outlook ${calendarFile} · Google Calendar ${days[0].google}`,
      "Your itinerary is attached as a PDF. Questions? Call +1 (825) 734-9456 or write to support@vistachase.com.",
    ].join("\n");

    const customHtml = `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:18px;margin:16px 0;background-color:#f9fafb;">
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;color:#1c1f23;">
          <tr><td style="padding:4px 0;width:140px;color:#6b7280;">Booking reference:</td><td style="padding:4px 0;font-weight:600;color:#14363a;">${escapeHtml(tripReference)}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">${multi ? "Trip" : "Experience"}:</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(title)}${multi ? ` (${live.length} days)` : ""}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">Guests:</td><td style="padding:4px 0;">${lead.totalSeats}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">Cancellation deadline:</td><td style="padding:4px 0;">${escapeHtml(deadlineLabel)}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;vertical-align:top;">Child seat &amp; requests:</td><td style="padding:4px 0;">${escapeHtml(requestStatus)}</td></tr>
          ${transfer ? `<tr><td style="padding:4px 0;color:#6b7280;vertical-align:top;">Airport transfer:</td><td style="padding:4px 0;">${escapeHtml(transfer)}</td></tr>` : ""}
          ${activities ? `<tr><td style="padding:4px 0;color:#6b7280;vertical-align:top;">Add-on activities:</td><td style="padding:4px 0;">${escapeHtml(activities)}</td></tr>` : ""}
          ${multi && totalDiscount > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;vertical-align:top;">Price breakdown:</td><td style="padding:4px 0;">Regular subtotal: ${money(totalFare, currency)}<br />10% package savings: -${money(totalDiscount, currency)}<br /><strong>Total: ${money(total, currency)}</strong> (Taxes and mandatory fees included)</td></tr>` : ""}
          <tr><td style="padding:4px 0;color:#6b7280;">Payment:</td><td style="padding:4px 0;">Total: ${money(total, currency)} · Paid: ${money(paid, currency)}${balance > 0 ? ` · <span style="color:#b91c1c;">Balance due: ${money(balance, currency)}${dueBy}</span>` : ""}</td></tr>
        </table>
        <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:12px;">${dayHtml}</table>
      </div>
      <div style="margin:16px 0 8px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Add to your calendar</p>
        <p style="margin:0;">
          <a href="${escapeHtml(calendarFile)}" style="display:inline-block;border:1px solid #257780;color:#257780;text-decoration:none;padding:8px 14px;font-size:12px;font-weight:600;border-radius:6px;margin:0 4px 6px;">iPhone / Outlook (.ics)</a>
          <a href="${escapeHtml(days[0].google)}" style="display:inline-block;border:1px solid #257780;color:#257780;text-decoration:none;padding:8px 14px;font-size:12px;font-weight:600;border-radius:6px;margin:0 4px 6px;">Google Calendar${multi ? " (Day 1)" : ""}</a>
        </p>
      </div>
      <p style="margin:16px 0 4px;font-size:13px;color:#4b5563;text-align:center;">Be at your pickup point 10 minutes early and show your voucher to your driver or guide, printed or on your phone.</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;text-align:center;">${escapeHtml(policy)}</p>
    `;

    // Staff (or Bókun) moved the booking to another date: same details, "updated" wording, and
    // the updated voucher PDF with the new date (Admin → booking → Change tour date).
    const changed = options.dateChange;
    const previousLabel = changed ? previousDateLabel(changed.previous) : "";
    const newLabel = days.map((d) => `${d.date}${d.time ? ` at ${d.time}` : ""}`).join("; ");
    const rendered = renderMasterEmail({
      subject: changed ? `Your tour date has been updated: ${tripReference}` : `Your Vista Chase booking is confirmed: ${tripReference}`,
      preheader: changed
        ? `Booking ${tripReference} is now on ${newLabel}. Your updated ticket is attached as a PDF.`
        : `Booking reference: ${tripReference}. ${title}. Your itinerary is attached as a PDF.`,
      title: changed ? "Your Tour Date Has Been Updated" : "Your Booking is Confirmed!",
      greeting: `Hi ${escapeHtml(lead.customerName)},`,
      paragraphs: changed
        ? [
            `Your booking has been successfully rescheduled. <strong>New date: ${escapeHtml(newLabel)}</strong>${previousLabel ? ` (was ${escapeHtml(previousLabel)})` : ""}.`,
            "Your updated ticket (voucher) and itinerary are below and attached as a PDF. Please use this one; the earlier ticket is no longer valid.",
          ]
        : [
            "Thank you for booking with Vista Chase. We are excited to welcome you to the Canadian Rockies! Your complete itinerary and voucher details are below and attached as a PDF.",
          ],
      customHtml,
      cta: changed
        ? { label: "Download Updated Ticket", url: voucherLink(lead.bookingReference) }
        : {
            label: "Manage Booking",
            url: manageLink,
          },
      disclaimer: "Questions? Reply to this email, call +1 (825) 734-9456 (6 a.m. – 9 p.m. Mountain Time) or write to support@vistachase.com.",
      plainTextLines: changed
        ? [`Your tour date has been updated: ${tripReference}`, `New date: ${newLabel}${previousLabel ? ` (was ${previousLabel})` : ""}`, "", ...text.split("\n").slice(1)]
        : text.split("\n"),
    });

    const result = await getEmailProvider().sendEmail({
      to: lead.customerEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      attachments: [
        { filename: changed ? `Vista-Chase-updated-ticket-${tripReference}.pdf` : `Vista-Chase-itinerary-${tripReference}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" },
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
            ${transfer ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Airport Transfer:</td><td style="padding: 8px 0;">${escapeHtml(transfer)}</td></tr>` : ""}
            ${activities ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Add-on Activities:</td><td style="padding: 8px 0;">${escapeHtml(activities)}</td></tr>` : ""}
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Total Amount Paid:</td><td style="padding: 8px 0; font-weight: bold;">${money(paid, currency)}${balance > 0 ? ` (Balance due: ${money(balance, currency)})` : ""}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Pickup Location &amp; Time:</td><td style="padding: 8px 0;">${escapeHtml(days.map((d) => d.pickup).join("; "))}</td></tr>
            ${missingItinerary.length ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #b91c1c;">Itinerary missing:</td><td style="padding: 8px 0; color: #b91c1c;">${escapeHtml(missingItinerary.map((m) => `${multi ? `Day ${m.day}: ` : ""}${m.reason}`).join(" "))} The guest was told we will confirm it by email.</td></tr>` : ""}
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
      ...(transfer ? [`Airport Transfer: ${transfer}`] : []),
      ...(activities ? [`Add-on Activities: ${activities}`] : []),
      `Total Amount Paid: ${money(paid, currency)} (Total: ${money(total, currency)})`,
      `Pickup Location & Time: ${days.map((d) => d.pickup).join("; ")}`,
      `Booking Reference: ${tripReference}`,
      `Booking Status: ${lead.status}`,
      ...missingItinerary.map((m) => `ITINERARY MISSING${multi ? ` (Day ${m.day})` : ""}: ${m.reason} The guest was told we will confirm it by email.`),
    ].join("\n");

    getEmailProvider()
      .sendEmail({
        to: ADMIN_NOTIFICATION_RECIPIENTS.to,
        cc: ADMIN_NOTIFICATION_RECIPIENTS.cc,
        subject: changed ? `[Date Changed] ${tripReference} - ${lead.customerName} - ${title} (was ${previousLabel})` : `[New Booking] ${tripReference} - ${lead.customerName} - ${title}`,
        html: adminHtml,
        text: adminText,
      })
      .catch((e) => console.error(`[admin-booking-notification] ${tripReference} error:`, (e as Error).message));

    if (changed) {
      await prisma.auditLog.create({ data: { action: "DATE_CHANGE_EMAIL_SENT", entityType: "Booking", entityId: lead.id, details: { references: live.map((b) => b.bookingReference), previous: changed.previous, note: `Date change email and updated ticket sent to ${lead.customerEmail}.` } } });
      return "sent";
    }
    const ids = live.map((b) => b.id);
    await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { confirmationEmailSentAt: new Date(), confirmationEmailError: null } });
    await prisma.auditLog.create({ data: { action: "CONFIRMATION_EMAIL_SENT", entityType: "Booking", entityId: lead.id, details: { references: live.map((b) => b.bookingReference), forced: Boolean(options.force) } } });
    return "sent";
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    console.error(`[confirmation-email] ${reference} failed: ${message}`);
    if (options.dateChange) {
      await prisma.auditLog.create({ data: { action: "DATE_CHANGE_EMAIL_FAILED", entityType: "Booking", entityId: lead.id, details: { reference, error: message } } }).catch(() => {});
      return "failed";
    }
    await prisma.booking.update({ where: { id: lead.id }, data: { ...(options.force ? {} : { confirmationEmailSentAt: null }), confirmationEmailError: message } }).catch(() => {});
    await prisma.auditLog.create({ data: { action: "CONFIRMATION_EMAIL_FAILED", entityType: "Booking", entityId: lead.id, details: { reference, error: message } } }).catch(() => {});
    return "failed";
  }
}

/** "2026-12-01 08:00" (or "2026-12-01") as "Tuesday, December 1, 2026 at 8:00 AM". */
function previousDateLabel(previous: string) {
  const [day, time] = previous.trim().split(/\s+/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) return previous;
  const label = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return time && /^\d{2}:\d{2}$/.test(time) ? `${label} at ${clock(time)}` : label;
}

/**
 * The date-change email: the confirmation email with "Your Tour Date Has Been Updated" wording and
 * the updated voucher PDF (new date) attached. `previous`: the old "YYYY-MM-DD HH:MM".
 */
export function sendDateChangeEmail(reference: string, change: { previous: string }) {
  return sendConfirmationEmail(reference, { force: true, dateChange: change });
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
