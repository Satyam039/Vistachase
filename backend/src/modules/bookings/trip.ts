// Multi-day trips: several bookings, one per day, that the guest bought as one trip. The
// Two-Day Rockies Explorer (package-booking.ts) makes them at checkout; staff link the days of a
// private multi-day trip they booked with Quick Book (linkTripBookings). Each day stays an
// ordinary booking (seats, manifest, check-in, its own QR code), and every day's price snapshot
// carries the same `package` block: { slug, title, day, references }. The trip is known by its
// Day 1 reference: one confirmation email and one PDF itinerary list every day, and My trips,
// the voucher page and the admin booking screen show the days together under it.

import prisma from "@/lib/db/prisma";
import { getBookingByReference } from "@/modules/bookings/booking.repository";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";

export interface TripInfo {
  title: string;
  /** The trip's reference: Day 1's booking reference. */
  reference: string;
  /** This booking's day (1-based). */
  day: number;
  days: number;
  references: string[];
}

/** The trip a booking belongs to, from its price snapshot; null for a single-day booking. */
export function tripOf(priceSnapshot: unknown, ownReference?: string): TripInfo | null {
  const pkg = (priceSnapshot as { package?: { title?: unknown; day?: unknown; references?: unknown } } | null)?.package;
  if (!pkg || !Array.isArray(pkg.references) || pkg.references.length < 2) return null;
  const references = pkg.references.filter((r): r is string => typeof r === "string");
  const day = typeof pkg.day === "number" ? pkg.day : ownReference ? references.indexOf(ownReference) + 1 : 1;
  return { title: typeof pkg.title === "string" ? pkg.title : "Multi-day trip", reference: references[0], day, days: references.length, references };
}

export type TripBooking = NonNullable<Awaited<ReturnType<typeof getBookingByReference>>>;

/** Every day of the booking's trip in day order (just the booking itself when it's a single day). */
export async function tripBookings(reference: string): Promise<TripBooking[]> {
  const booking = await getBookingByReference(reference);
  if (!booking) return [];
  const trip = tripOf(booking.priceSnapshot, booking.bookingReference);
  if (!trip) return [booking];
  const days = await Promise.all(trip.references.map((r) => (r === booking.bookingReference ? booking : getBookingByReference(r))));
  return days.filter((b): b is TripBooking => Boolean(b));
}

/** The days of a trip for API responses: reference, date, time, tour and status of each. */
export async function tripSummary(trip: TripInfo) {
  const rows = await prisma.booking.findMany({
    where: { bookingReference: { in: trip.references } },
    select: { bookingReference: true, status: true, tourDeparture: { select: { date: true, departureTime: true, tour: { select: { title: true } }, shuttleRoute: { select: { name: true } } } } },
  });
  return {
    title: trip.title,
    reference: trip.reference,
    day: trip.day,
    days: trip.references.map((ref, i) => {
      const b = rows.find((r) => r.bookingReference === ref);
      return {
        day: i + 1,
        bookingReference: ref,
        status: b?.status ?? null,
        date: b ? formatDateOnly(b.tourDeparture.date) : null,
        departureTime: formatTimeOfDay(b?.tourDeparture.departureTime),
        title: b?.tourDeparture.tour?.title ?? b?.tourDeparture.shuttleRoute?.name ?? null,
      };
    }),
  };
}

/**
 * Staff: links bookings into one trip (a private multi-day tour booked day by day with Quick
 * Book). The bookings must be for the same guest email, on different dates, and not already in a
 * trip. Days are ordered by date. Nothing about seats, prices or payments changes.
 */
export async function linkTripBookings(references: string[], title: string) {
  const unique = [...new Set(references.map((r) => r.trim().toUpperCase()))];
  if (unique.length < 2) return { error: "Choose at least two bookings to link." } as const;
  const bookings = await prisma.booking.findMany({ where: { bookingReference: { in: unique } }, include: { tourDeparture: { select: { date: true, departureTime: true } } } });
  if (bookings.length !== unique.length) {
    const missing = unique.filter((r) => !bookings.some((b) => b.bookingReference === r));
    return { error: `Not found: ${missing.join(", ")}.` } as const;
  }
  if (new Set(bookings.map((b) => b.customerEmail.toLowerCase())).size > 1) return { error: "These bookings are for different guests (emails don't match)." } as const;
  if (bookings.some((b) => tripOf(b.priceSnapshot))) return { error: "One of these bookings is already part of a trip." } as const;
  if (bookings.some((b) => ["CANCELLED", "EXPIRED", "REFUNDED"].includes(b.status))) return { error: "Cancelled or expired bookings can't be linked." } as const;
  const sorted = [...bookings].sort((a, b) => a.tourDeparture.date.getTime() - b.tourDeparture.date.getTime() || (a.tourDeparture.departureTime?.getTime() ?? 0) - (b.tourDeparture.departureTime?.getTime() ?? 0));
  if (new Set(sorted.map((b) => formatDateOnly(b.tourDeparture.date))).size !== sorted.length) return { error: "Each day of a trip needs its own date." } as const;

  const ordered = sorted.map((b) => b.bookingReference);
  await prisma.$transaction(
    sorted.map((b, i) =>
      prisma.booking.update({
        where: { id: b.id },
        data: {
          priceSnapshot: { ...((b.priceSnapshot as object | null) ?? {}), package: { slug: "staff-linked-trip", title, day: i + 1, references: ordered } },
          adminNotes: [b.adminNotes, `${title}, day ${i + 1} of ${ordered.length}: linked by staff with ${ordered.filter((r) => r !== b.bookingReference).join(", ")}.`].filter(Boolean).join("\n"),
        },
      }),
    ),
  );
  return { references: ordered, ids: sorted.map((b) => b.id) } as const;
}
