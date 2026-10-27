// The voucher as a real PDF file (GET /api/bookings/voucher.pdf). The voucher page's Print button
// relies on the browser's print dialog, which in-app browsers (Gmail, WhatsApp, Instagram) don't
// have, so guests got nothing they could open. This file is built on the server with pdf-lib's
// standard fonts: one A4 page, the QR code staff scan at check-in, and the facts the guide needs.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { checkinLink } from "@/lib/security/signed-links";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";
import { paidCents, paymentSummary } from "@/modules/bookings/deposit";
import type { getBookingByReference } from "@/modules/bookings/booking.repository";

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
  const departure = booking.tourDeparture;
  const title = departure.tour?.title || departure.shuttleRoute?.name || "Vista Chase experience";
  pdf.setTitle(`Vista Chase voucher ${booking.bookingReference}`);
  pdf.setAuthor("Vista Chase");
  pdf.setCreator("vistachase.com");

  const page: PDFPage = pdf.addPage([595.28, 841.89]); // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 48;
  const inner = width - margin * 2;

  const text = (value: string, x: number, y: number, size: number, font = regular, color = INK) =>
    page.drawText(safe(value), { x, y, size, font, color });

  // Header band
  page.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: rgb(0.047, 0.122, 0.129) });
  text("VISTA CHASE", margin, height - 50, 20, bold, rgb(1, 1, 1));
  text("Canadian Rockies tours & shuttles", margin, height - 70, 10, regular, rgb(0.8, 0.84, 0.85));
  const label = "BOOKING VOUCHER";
  text(label, width - margin - bold.widthOfTextAtSize(label, 11), height - 50, 11, bold, rgb(0.93, 0.8, 0.45));

  let y = height - 130;
  const cancelled = booking.status === "CANCELLED" || booking.status === "EXPIRED" || booking.status === "REFUNDED";
  const status = cancelled
    ? "CANCELLED - this voucher is no longer valid"
    : booking.status === "PENDING_PAYMENT"
      ? "AWAITING PAYMENT - not valid until payment is confirmed"
      : "CONFIRMED";
  text(status, margin, y, 11, bold, cancelled || booking.status === "PENDING_PAYMENT" ? RED : OCEAN);
  y -= 26;

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
  row("Date", longDate(departure.date));
  row("Departs", clock(departure.departureTime) ?? "To be confirmed");
  row("Returns (approx.)", clock(departure.returnTime));
  row(
    "Pickup",
    booking.pickupTime
      ? `${clock(booking.pickupTime)} ${pickupPlace ? `at ${pickupPlace}` : "(place to be confirmed by email)"}`
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
  text("+1 (825) 734-9456 (6 a.m. - 9 p.m. MT)   bookings@vistachase.com   support@vistachase.com", margin, y, 10, regular, MUTED);

  text(`Issued ${new Date().toISOString().slice(0, 10)} - vistachase.com`, margin, 32, 8, regular, MUTED);

  return pdf.save();
}
