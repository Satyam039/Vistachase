// "Add to calendar" for a confirmed booking: an iCalendar (.ics) file, attached to the
// confirmation email and downloadable from GET /api/bookings/calendar.ics, plus a Google Calendar
// link. iPhone Mail and Apple Calendar open the .ics with "Add to Calendar"; Android phones (Gmail,
// Google Calendar) use the Google link, and Outlook opens the .ics too. One event per day of a trip.

import { siteUrl, signBookingLink, voucherLink } from "@/lib/security/signed-links";
import { getMountainTimeInstant } from "@/lib/utils/time";
import type { TripBooking } from "@/modules/bookings/trip";

/** How long a day lasts in the calendar when the departure has no return time. */
const DEFAULT_HOURS = 8;

interface CalendarDay {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
}

type CalendarBooking = Pick<TripBooking, "bookingReference" | "pickupTime" | "pickupCustomText" | "pickupStop" | "tourDeparture">;

/** The calendar event for one booking (one day). */
export function calendarDay(b: CalendarBooking): CalendarDay {
  const d = b.tourDeparture;
  const title = d.tour?.title || d.shuttleRoute?.name || "Vista Chase experience";
  const start = getMountainTimeInstant(d.date, d.departureTime);
  let end = d.returnTime ? getMountainTimeInstant(d.date, d.returnTime) : new Date(start.getTime() + DEFAULT_HOURS * 3_600_000);
  if (end <= start) end = new Date(start.getTime() + DEFAULT_HOURS * 3_600_000);
  const stop = b.pickupStop;
  const place = stop?.name || b.pickupCustomText || "";
  const location = [place, stop?.address, stop?.town].filter(Boolean).join(", ");
  const pickup = b.pickupTime ? `Pickup ${b.pickupTime}${place ? ` at ${place}` : ""}. ` : "";
  return {
    uid: `${b.bookingReference}@vistachase.com`,
    title: `Vista Chase: ${title}`,
    start,
    end,
    location,
    description: `${pickup}Booking ${b.bookingReference}. Be at your pickup 10 minutes early. Voucher: ${voucherLink(b.bookingReference)} Questions: +1 (825) 734-9456, support@vistachase.com`,
  };
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** RFC 5545 text escaping. */
const icsText = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
/** RFC 5545 line folding: lines over 75 octets continue on the next line after a space. */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf8") > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
    }
    current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** The .ics file for a booking or a whole trip (one VEVENT per day), with a reminder the day before. */
export function bookingIcs(bookings: CalendarBooking[], now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vista Chase//Bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const b of bookings) {
    const e = calendarDay(b);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${icsText(e.title)}`,
      ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
      `DESCRIPTION:${icsText(e.description)}`,
      `URL:${voucherLink(b.bookingReference)}`,
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(e.title)} tomorrow`,
      "TRIGGER:-PT18H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** "Add to Google Calendar" for one day (Android phones, Gmail, any browser). */
export function googleCalendarLink(b: CalendarBooking): string {
  const e = calendarDay(b);
  const params = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${stamp(e.start)}/${stamp(e.end)}`, details: e.description, location: e.location, ctz: "America/Edmonton" });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Download link for the .ics (iPhone, Apple Calendar, Outlook), signed like the voucher link. */
export function icsLink(reference: string): string {
  return `${siteUrl()}/api/bookings/calendar.ics?ref=${encodeURIComponent(reference)}&t=${signBookingLink(reference, "voucher")}`;
}
