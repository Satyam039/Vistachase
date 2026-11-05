// The voucher as a real PDF file (GET /api/bookings/voucher.pdf). The voucher page's Print button
// relies on the browser's print dialog, which in-app browsers (Gmail, WhatsApp, Instagram) don't
// have, so guests got nothing they could open. This file is built on the server with pdf-lib's
// standard fonts: one A4 page, the QR code staff scan at check-in, and the facts the guide needs.

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { MEDIA_DIR } from "@/modules/media/media.repository";
import QRCode from "qrcode";
import { checkinLink } from "@/lib/security/signed-links";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";
import { paidCents, paymentSummary } from "@/modules/bookings/deposit";
import type { getBookingByReference } from "@/modules/bookings/booking.repository";
import { tourItinerary } from "@/modules/bookings/tour-itinerary";
import { resolveShuttlePickupTime } from "@/modules/shuttles/shuttle-timing";

type VoucherBooking = NonNullable<Awaited<ReturnType<typeof getBookingByReference>>>;

const INK = rgb(0.11, 0.12, 0.14);
const MUTED = rgb(0.4, 0.43, 0.47);
const OCEAN = rgb(0.145, 0.467, 0.502);
const RULE = rgb(0.86, 0.87, 0.88);
const RED = rgb(0.7, 0.11, 0.11);

// Characters the standard (WinAnsi) fonts can draw beyond Latin-1; anything else becomes "?".
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const safe = (text: string) =>
  Array.from(text.replace(/[\r\n\t]+/g, " "))
    .map((c) => (c.charCodeAt(0) <= 0xff && c.charCodeAt(0) >= 0x20 ? c : WIN_ANSI_EXTRA.has(c) ? c : c === "→" ? "->" : "?"))
    .join("");

const money = (cents: number, currency: string) =>
  `$${(cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

// The gold horse emblem drawn on the right of the header band (backend/media/brand).
let emblemBytes: Buffer | null | undefined;
function emblemPng(): Buffer | null {
  if (emblemBytes !== undefined) return emblemBytes;
  emblemBytes = null;
  for (const dir of [path.join(MEDIA_DIR, "brand"), path.resolve(process.cwd(), "media", "brand")]) {
    try {
      emblemBytes = fs.readFileSync(path.join(dir, "horse-emblem-gold.png"));
      break;
    } catch {
      // try the next folder; without the file the band simply has no emblem
    }
  }
  return emblemBytes;
}

const emblems = new WeakMap<PDFDocument, PDFImage | null>();
async function emblemFor(pdf: PDFDocument): Promise<PDFImage | null> {
  if (!emblems.has(pdf)) {
    const bytes = emblemPng();
    emblems.set(pdf, bytes ? await pdf.embedPng(bytes) : null);
  }
  return emblems.get(pdf) ?? null;
}

const BAND = 92;
/** The dark header band: VISTA CHASE and a subtitle on the left, the gold horse on the right. */
function drawBand(page: PDFPage, emblem: PDFImage | null, bold: PDFFont, regular: PDFFont, subtitle: string, margin: number) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - BAND, width, height: BAND, color: rgb(0.047, 0.122, 0.129) });
  page.drawText("VISTA CHASE", { x: margin, y: height - 50, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText(safe(subtitle), { x: margin, y: height - 70, size: 10, font: regular, color: rgb(0.8, 0.84, 0.85) });
  if (emblem) {
    const h = 58;
    const w = (emblem.width / emblem.height) * h;
    page.drawImage(emblem, { x: width - margin - w, y: height - BAND + (BAND - h) / 2, width: w, height: h });
  }
}

/** Stored time of day, or "08:30" (a booking's pickup time), → "8:30 AM" */
function clock(value: Date | string | null | undefined) {
  const hhmm = typeof value === "string" ? value : formatTimeOfDay(value);
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Stored date → "Tuesday, June 1, 2027" (the stored value is the local Rockies date). */
function longDate(value: Date) {
  return new Date(`${formatDateOnly(value)}T12:00:00Z`).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Splits text into lines no wider than `width` points. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of safe(text).split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function qrPng(booking: VoucherBooking): Promise<Uint8Array> {
  const stored = booking.qrCodeUrl?.match(/^data:image\/png;base64,(.+)$/)?.[1];
  if (stored) return Buffer.from(stored, "base64");
  return QRCode.toBuffer(checkinLink(booking.bookingReference), { margin: 1, width: 300 });
}

export async function voucherPdf(booking: VoucherBooking): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Vista Chase voucher ${booking.bookingReference}`);
  pdf.setAuthor("Vista Chase");
  pdf.setCreator("vistachase.com");
  await addVoucherPage(pdf, booking);
  return pdf.save();
}

/**
 * One A4 voucher page for a booking; `dayLabel` ("Day 2 of 3 · Two-Day Rockies Explorer") for trips.
 * With the tour's itinerary (tour-itinerary.ts), on a second page when it doesn't fit.
 */
export async function addVoucherPage(pdf: PDFDocument, booking: VoucherBooking, dayLabel?: string, options: { itinerary?: boolean } = {}) {
  const departure = booking.tourDeparture;
  const title = departure.tour?.title || departure.shuttleRoute?.name || "Vista Chase experience";
  const page: PDFPage = pdf.addPage([595.28, 841.89]); // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 48;
  const inner = width - margin * 2;

  const text = (value: string, x: number, y: number, size: number, font = regular, color = INK) =>
    page.drawText(safe(value), { x, y, size, font, color });

  // Header band
  drawBand(page, await emblemFor(pdf), bold, regular, "Canadian Rockies tours & shuttles - booking voucher", margin);

  let y = height - 130;
  const cancelled = booking.status === "CANCELLED" || booking.status === "EXPIRED" || booking.status === "REFUNDED";
  const status = cancelled
    ? "CANCELLED - this voucher is no longer valid"
    : booking.status === "PENDING_PAYMENT"
      ? "AWAITING PAYMENT - not valid until payment is confirmed"
      : "CONFIRMED";
  text(status, margin, y, 11, bold, cancelled || booking.status === "PENDING_PAYMENT" ? RED : OCEAN);
  y -= 26;
  if (dayLabel) {
    text(dayLabel.toUpperCase(), margin, y, 9, bold, MUTED);
    y -= 20;
  }

  // Title (wrapped beside the QR code)
  const qrSize = 132;
  const textWidth = inner - qrSize - 24;
  const qrTop = y + 14;
  for (const line of wrap(title, bold, 20, textWidth)) {
    text(line, margin, y, 20, bold);
    y -= 25;
  }
  y -= 4;
  text("Booking reference", margin, y, 9, regular, MUTED);
  y -= 16;
  text(booking.bookingReference, margin, y, 16, bold);
  y -= 20;
  if (booking.voucherCode) {
    text(`Voucher code  ${booking.voucherCode}`, margin, y, 10, regular, MUTED);
    y -= 14;
  }

  const qr = await pdf.embedPng(await qrPng(booking));
  page.drawImage(qr, { x: width - margin - qrSize, y: qrTop - qrSize, width: qrSize, height: qrSize });
  const scan = "Staff scan at check-in";
  text(scan, width - margin - qrSize / 2 - regular.widthOfTextAtSize(scan, 8) / 2, qrTop - qrSize - 12, 8, regular, MUTED);
  y = Math.min(y, qrTop - qrSize - 28);

  const rule = () => {
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.8, color: RULE });
    y -= 20;
  };
  const row = (name: string, value: string | null | undefined) => {
    if (!value) return;
    text(name.toUpperCase(), margin, y, 8, bold, MUTED);
    for (const line of wrap(value, regular, 11, inner - 130)) {
      text(line, margin + 130, y, 11);
      y -= 15;
    }
    y -= 5;
  };

  rule();
  const guests =
    [
      booking.adultsCount ? `${booking.adultsCount} adult${booking.adultsCount === 1 ? "" : "s"}` : null,
      booking.childrenCount ? `${booking.childrenCount} child${booking.childrenCount === 1 ? "" : "ren"}` : null,
      booking.infantsCount ? `${booking.infantsCount} infant${booking.infantsCount === 1 ? "" : "s"}` : null,
    ]
      .filter(Boolean)
      .join(", ") || `${booking.totalSeats} guest${booking.totalSeats === 1 ? "" : "s"}`;
  const stop = booking.pickupStop;
  const pickupPlace = stop?.name || booking.pickupCustomText || null;
  const pickupTime = resolveShuttlePickupTime({
    departureTime: formatTimeOfDay(departure.departureTime),
    town: stop?.town,
    stopName: stop?.name,
    customText: booking.pickupCustomText,
    storedPickupTime: booking.pickupTime,
  });
  row("Date", longDate(departure.date));
  row("Departs", clock(departure.departureTime) ?? "To be confirmed");
  row("Returns (approx.)", clock(departure.returnTime));
  row(
    "Pickup",
    pickupTime
      ? `${clock(pickupTime)} ${pickupPlace ? `at ${pickupPlace}` : "(place to be confirmed by email)"}`
      : (pickupPlace ?? "To be confirmed by email"),
  );
  row("Pickup address", stop ? [stop.address, stop.town].filter(Boolean).join(", ") : null);
  row("Pickup notes", stop?.instructions);
  row("Lead guest", booking.customerName);
  row("Guests", guests);
  row("Add-ons", booking.items.length ? booking.items.map((i) => (i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name)).join(", ") : null);
  row("Special requests", booking.specialRequests);

  rule();
  const summary = paymentSummary(booking, booking.payments);
  row("Total", money(booking.totalAmount, booking.currency));
  if (summary.paymentPlan === "DEPOSIT") {
    row("Paid so far", money(Math.round(summary.amountPaid * 100), booking.currency));
    if (summary.balanceDue > 0) {
      const due = summary.balanceDueAt
        ? ` by ${summary.balanceDueAt.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Edmonton" })}`
        : "";
      row("Balance due", `${money(Math.round(summary.balanceDue * 100), booking.currency)}${due} (pay it from your voucher page)`);
    } else {
      row("Balance due", "Nothing - paid in full");
    }
  } else if (!cancelled) {
    const paid = paidCents(booking.payments);
    row("Payment", paid >= booking.totalAmount ? "Paid in full" : `${money(booking.totalAmount - paid, booking.currency)} still to pay`);
  }

  // The tour's itinerary, on this same page: the voucher is always one page, so a long itinerary
  // is set smaller rather than moved to a second page. Left out inside the emailed itinerary PDF,
  // whose page already lists it.
  const plan = options.itinerary === false ? null : tourItinerary(departure.tour);
  if (plan) {
    const timeWidth = 96;
    const fit = [
      { size: 10, lead: 13, gap: 5 },
      { size: 9, lead: 11, gap: 3 },
      { size: 8, lead: 10, gap: 2 },
    ].map((f) => ({ ...f, lines: plan.steps.map((step) => wrap(step.text, regular, f.size, inner - timeWidth)) }));
    const neededFor = (f: (typeof fit)[number]) => 38 + f.lines.reduce((n, l) => n + l.length * f.lead + f.gap, 0) + (plan.note ? 16 : 0);
    // Room above "On the day", "Need help?" and the footer (about 150pt).
    const f = fit.find((option) => y - neededFor(option) >= 150) ?? fit[fit.length - 1];
    rule();
    text("Your itinerary", margin, y, 11, bold);
    y -= 18;
    for (const [i, step] of plan.steps.entries()) {
      if (step.time) text(step.time, margin, y, Math.min(9, f.size), bold, OCEAN);
      for (const line of f.lines[i]) {
        text(line, margin + timeWidth, y, f.size);
        y -= f.lead;
      }
      y -= f.gap;
    }
    if (plan.note) {
      text(plan.note, margin, y, 9, regular, MUTED);
      y -= 16;
    }
  }

  rule();
  text("On the day", margin, y, 11, bold);
  y -= 16;
  for (const line of [
    "Be at your pickup 10 minutes early and show this voucher to your guide, printed or on your phone.",
    "Your cancellation terms, and the button to cancel, are on your voucher page and in My trips.",
  ].flatMap((l) => wrap(l, regular, 10, inner))) {
    text(line, margin, y, 10, regular, MUTED);
    y -= 14;
  }
  y -= 10;
  text("Need help?", margin, y, 11, bold);
  y -= 16;
  text("+1 (825) 734-9456 (6 a.m. - 9 p.m. MT)   support@vistachase.com", margin, y, 10, regular, MUTED);

  text(`Issued ${new Date().toISOString().slice(0, 10)} - vistachase.com`, margin, 32, 8, regular, MUTED);
}

/**
 * The PDF attached to the confirmation email: one page with the reference, booking date, guest,
 * every day of the trip with times, pickup and itinerary, payment, contact, and each day's
 * check-in QR code. A single booking always fits one page; a long multi-day trip continues on a
 * second page only when it can't fit.
 */
export async function itineraryPdf(bookings: VoucherBooking[], trip: { title: string; reference: string } | null): Promise<Uint8Array> {
  const lead = bookings[0];
  const pdf = await PDFDocument.create();
  const reference = trip?.reference ?? lead.bookingReference;
  pdf.setTitle(`Vista Chase itinerary ${reference}`);
  pdf.setAuthor("Vista Chase");
  pdf.setCreator("vistachase.com");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;

  let page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const inner = width - margin * 2;
  let y = 0;
  const text = (value: string, x: number, at: number, size: number, font = regular, color = INK) => page.drawText(safe(value), { x, y: at, size, font, color });
  const emblem = await emblemFor(pdf);
  const header = (subtitle: string) => {
    drawBand(page, emblem, bold, regular, subtitle, margin);
    y = height - 122;
  };
  // A new page when the next block wouldn't fit above the footer.
  const room = (needed: number) => {
    if (y - needed > 60) return;
    page = pdf.addPage([595.28, 841.89]);
    header(`Canadian Rockies tours & shuttles - ${reference} (continued)`);
  };
  const rule = () => {
    room(24);
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.8, color: RULE });
    y -= 15;
  };
  const heading = (value: string) => {
    room(34);
    text(value, margin, y, 12, bold);
    y -= 18;
  };
  const row = (name: string, value: string | null | undefined, width_ = inner - 130) => {
    if (!value) return;
    const lines = wrap(value, regular, 10, width_);
    room(lines.length * 13 + 3);
    text(name.toUpperCase(), margin, y, 8, bold, MUTED);
    for (const line of lines) {
      text(line, margin + 130, y, 10);
      y -= 13;
    }
    y -= 2;
  };
  // Each day's check-in QR code, drawn at the right of its block (staff scan it at pickup), so the
  // whole booking fits on one page without separate voucher pages.
  const qrs = await Promise.all(bookings.map(async (b) => pdf.embedPng(await qrPng(b))));
  const qrCode = (i: number, top: number, size: number) => {
    const b = bookings[i];
    page.drawImage(qrs[i], { x: width - margin - size, y: top - size, width: size, height: size });
    const caption = b.voucherCode ? `Voucher ${b.voucherCode}` : "Scan at check-in";
    const capSize = 7.5;
    text(caption, width - margin - size / 2 - regular.widthOfTextAtSize(safe(caption), capSize) / 2, top - size - 10, capSize, regular, MUTED);
  };

  header("Canadian Rockies tours & shuttles - itinerary and voucher");
  const allConfirmed = bookings.every((b) => b.status === "CONFIRMED" || b.status === "COMPLETED");
  const single = bookings.length === 1;
  const qrSize = 112;
  const titleTop = y + 12;
  const titleWidth = single ? inner - qrSize - 24 : inner;
  text(allConfirmed ? "CONFIRMED" : "NOT CONFIRMED - see the status of each day below", margin, y, 11, bold, allConfirmed ? OCEAN : RED);
  y -= 26;
  const title = trip?.title ?? (lead.tourDeparture.tour?.title || lead.tourDeparture.shuttleRoute?.name || "Vista Chase experience");
  for (const line of wrap(title, bold, 19, titleWidth)) {
    text(line, margin, y, 19, bold);
    y -= 23;
  }
  if (bookings.length > 1) {
    text(`${bookings.length}-day trip, ${longDate(lead.tourDeparture.date)} to ${longDate(bookings[bookings.length - 1].tourDeparture.date)}`, margin, y, 11, regular, MUTED);
    y -= 20;
  }
  text("Booking reference", margin, y, 9, regular, MUTED);
  y -= 15;
  text(reference, margin, y, 15, bold);
  y -= 20;
  if (single) {
    qrCode(0, titleTop, qrSize);
    y = Math.min(y, titleTop - qrSize - 22);
  }

  rule();
  const booked = lead.createdAt.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Edmonton" });
  const guests =
    [
      lead.adultsCount ? `${lead.adultsCount} adult${lead.adultsCount === 1 ? "" : "s"}` : null,
      lead.childrenCount ? `${lead.childrenCount} child${lead.childrenCount === 1 ? "" : "ren"}` : null,
      lead.infantsCount ? `${lead.infantsCount} infant${lead.infantsCount === 1 ? "" : "s"}` : null,
    ]
      .filter(Boolean)
      .join(", ") || `${lead.totalSeats} guest${lead.totalSeats === 1 ? "" : "s"}`;
  row("Booked on", booked);
  row("Lead guest", lead.customerName);
  row("Email", lead.customerEmail);
  row("Phone", lead.customerPhone);
  row("Guests", guests);
  row("Special requests", lead.specialRequests);

  rule();
  heading(bookings.length > 1 ? "Your days" : "Your tour");
  for (const [i, b] of bookings.entries()) {
    const d = b.tourDeparture;
    const name = d.tour?.title || d.shuttleRoute?.name || "Vista Chase experience";
    const dayQr = single ? 0 : 76;
    room(dayQr ? dayQr + 30 : 90);
    const dayTop = y + 10;
    text(bookings.length > 1 ? `Day ${i + 1} - ${longDate(d.date)}` : longDate(d.date), margin, y, 11, bold, OCEAN);
    y -= 16;
    for (const line of wrap(name, bold, 11, inner - (dayQr ? dayQr + 16 : 0))) {
      text(line, margin, y, 11, bold);
      y -= 14;
    }
    y -= 3;
    if (dayQr) qrCode(i, dayTop, dayQr);
    const beside = dayQr ? inner - 130 - dayQr - 16 : inner - 130;
    const stop = b.pickupStop;
    const place = stop?.name || b.pickupCustomText || null;
    const pickupTime = resolveShuttlePickupTime({
      departureTime: formatTimeOfDay(d.departureTime),
      town: stop?.town,
      stopName: stop?.name,
      customText: b.pickupCustomText,
      storedPickupTime: b.pickupTime,
    });
    row("Departs", clock(d.departureTime) ?? "To be confirmed", beside);
    row("Returns (approx.)", clock(d.returnTime), beside);
    row("Pickup", pickupTime ? `${clock(pickupTime)}${place ? ` at ${place}` : ""}` : (place ?? "To be confirmed by email"), beside);
    row("Pickup address", stop ? [stop.address, stop.town].filter(Boolean).join(", ") : null, beside);
    if (bookings.length > 1) row("Day reference", b.bookingReference, beside);
    if (!(b.status === "CONFIRMED" || b.status === "COMPLETED")) row("Status", b.status.replace(/_/g, " ").toLowerCase(), beside);
    if (dayQr) y = Math.min(y, dayTop - dayQr - 20); // below the QR code and its caption
    const plan = tourItinerary(d.tour);
    if (plan) {
      y -= 3;
      room(40);
      text("ITINERARY", margin, y, 8, bold, MUTED);
      y -= 14;
      for (const step of plan.steps) {
        const lines = wrap(step.text, regular, 9.5, inner - 96);
        room(lines.length * 12 + 4);
        if (step.time) text(step.time, margin, y, 8.5, bold, OCEAN);
        for (const line of lines) {
          text(line, margin + 96, y, 9.5);
          y -= 12;
        }
        y -= 3;
      }
      if (plan.note) {
        room(14);
        text(plan.note, margin, y, 8.5, regular, MUTED);
        y -= 13;
      }
    }
    y -= 4;
  }

  rule();
  heading("Payment");
  const currency = lead.currency;
  const total = bookings.reduce((n, b) => n + b.totalAmount, 0);
  const paid = bookings.reduce((n, b) => n + paidCents(b.payments), 0);
  row("Total", money(total, currency));
  row("Paid", money(Math.min(paid, total), currency));
  const deposit = bookings.find((b) => b.paymentPlan === "DEPOSIT" && b.balanceDueAt);
  row(
    "Balance due",
    paid >= total
      ? "Nothing - paid in full"
      : `${money(total - paid, currency)}${deposit?.balanceDueAt ? ` by ${deposit.balanceDueAt.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Edmonton" })}` : ""} (pay it from your voucher page)`,
  );

  rule();
  heading("On the day");
  for (const line of [
    "Be at your pickup 10 minutes early and show this page to your guide, printed or on your phone: staff scan the QR code" + (single ? "" : " for that day") + " at check-in.",
    "Cancellation terms and the cancel button are on your voucher page and in My trips.",
  ].flatMap((l) => wrap(l, regular, 9.5, inner))) {
    room(14);
    text(line, margin, y, 9.5, regular, MUTED);
    y -= 13;
  }
  y -= 5;
  room(16);
  text("Need help?", margin, y, 10, bold);
  text("+1 (825) 734-9456 (6 a.m. - 9 p.m. MT)   support@vistachase.com", margin + bold.widthOfTextAtSize("Need help?  ", 10), y, 10, regular, MUTED);
  for (const p of pdf.getPages()) p.drawText(safe(`Issued ${new Date().toISOString().slice(0, 10)} - vistachase.com`), { x: margin, y: 32, size: 8, font: regular, color: MUTED });
  return pdf.save();
}
