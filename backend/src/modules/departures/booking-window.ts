// When a departure stops taking bookings on this site. Bókun applies its own per-product cutoffs;
// this is the website's server-side rule, applied when a seat hold or a booking is created and
// when departures are listed, so a departure that has left (or is about to) can't be booked even
// if the browser still shows it.
//
// BOOKING_CUTOFF_MINUTES: minutes before the departure time that online booking closes
// (default 60; 0 = until departure). Departure dates and times are Mountain Time.

import { getMountainTimeInstant } from "@/lib/utils/time";

const DEFAULT_CUTOFF_MINUTES = 60;

export function bookingCutoffMinutes(): number {
  const raw = process.env.BOOKING_CUTOFF_MINUTES;
  if (raw === undefined || raw.trim() === "") return DEFAULT_CUTOFF_MINUTES;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_CUTOFF_MINUTES;
}

/** The moment online booking closes for a departure (date + time stored as Mountain wall-clock values). */
export function bookingClosesAt(departure: { date: Date; departureTime: Date }): Date {
  return new Date(getMountainTimeInstant(departure.date, departure.departureTime).getTime() - bookingCutoffMinutes() * 60_000);
}

export function isBookable(departure: { date: Date; departureTime: Date }, now: Date = new Date()): boolean {
  return now.getTime() < bookingClosesAt(departure).getTime();
}

/** The customer-facing reason a departure can't be booked any more, or null when it can. */
export function bookingClosedError(departure: { date: Date; departureTime: Date }, now: Date = new Date()): string | null {
  if (isBookable(departure, now)) return null;
  const minutes = bookingCutoffMinutes();
  return minutes > 0
    ? `Online booking for this departure closed ${minutes} minutes before departure. Please choose another date or contact us.`
    : "This departure has already left. Please choose another date.";
}
