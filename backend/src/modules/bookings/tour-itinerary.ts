// The itinerary a booking's confirmation email and PDF carry (owner, 2026-11-14: "Fix outdated
// itineraries in booking confirmation emails and PDFs").
//
// Source of truth: the website itself. The data is imported from the frontend's own files
// (`@site/*` = frontend/src/lib, see tsconfig.json / vitest.config.ts):
//   - frontend/src/lib/itineraries.ts   the day tours' stops, timeline, pickup text and Important
//                                        Information (the tour pages render the same objects), and
//                                        the Three- and Four-Day journeys' day-by-day itineraries
//   - frontend/src/lib/shuttleSchedule.ts the shuttle timetable the shuttles page shows
// so a change on the website reaches every PDF built after it, with nothing to copy by hand.
//
// The booking is matched by what was actually booked, never a generic template:
//   - a private Three- or Four-Day journey day: that journey's itinerary for that day (from the
//     booking's price snapshot: package slug + day number), not the day tour it is booked on;
//   - a day tour: that tour's own itinerary (shared and private versions differ), with stops that
//     only run June 1 – October 10 left out on other dates;
//   - a shuttle: its departure's row of the timetable (pickup times, lake windows, return).
// When none of these fits (a retired tour, an off-timetable shuttle time, a winter Icefield date
// whose route the team confirms) the result is `missing` with the reason: the guest is told the
// team will confirm the itinerary, and staff get a flag, instead of an old Webflow itinerary.

import { PACKAGE_ITINERARIES, TOUR_ITINERARIES, inSummerSeason } from "@site/itineraries";
import { SHUTTLE_DEPARTURES, SHUTTLE_PICKUPS, clockRange, departuresFor, clock as shuttleClock } from "@site/shuttleSchedule";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";

export interface ItineraryStep {
  time: string;
  text: string;
}

export interface ItineraryStop {
  name: string;
  text: string;
}

export interface BookingItinerary {
  /** A line naming this day's plan, when it isn't the tour's own (a journey's "Day 2 — …", a shuttle departure). */
  heading: string | null;
  duration: string | null;
  /** The day in order (pickup, morning, midday…, return). */
  steps: ItineraryStep[];
  /** Stop by stop. */
  stops: ItineraryStop[];
  /** Important information for this day. */
  notes: string[];
  /** Where it came from, for logs and tests: "tour:<slug>", "package:<slug>:<day>", "shuttle:<n>". */
  source: string;
}

export type ItineraryResult =
  | { ok: true; itinerary: BookingItinerary }
  | {
      ok: false;
      /** For staff (the booking flag): what is missing and why. */
      reason: string;
      /** For the guest: what the PDF and email say instead of an itinerary. */
      guestNote: string;
    };

export const MISSING_ITINERARY_NOTE =
  "Our team will confirm your detailed itinerary for this date by email before your tour, and your guide goes through it with you the evening before.";

/**
 * The names these tours carry on the website, where the database title is an older Webflow name
 * ("Our Best Selling Banff Shared Tour"). Shared and private share a page name, so emails say which
 * one was booked. The day tours' names come from lib/itineraries.ts.
 */
export const WEBSITE_TITLES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(TOUR_ITINERARIES).map(([slug, t]) => [slug, t.title])),
  "winter-special": "Winter Special Shared Tour",
  "winter-signature-private-tour": "Special Winter Private Tour",
};

/** The experience's name for vouchers and emails: the website's name for the tour, else its title. */
export function experienceTitle(departure: { tour?: { slug: string; title: string } | null; shuttleRoute?: { name: string } | null }): string {
  const tour = departure.tour;
  return (tour && WEBSITE_TITLES[tour.slug]) || tour?.title || departure.shuttleRoute?.name || "Vista Chase experience";
}

export interface ItineraryBooking {
  priceSnapshot?: unknown;
  tourDeparture: {
    date: Date | string;
    departureTime: Date | string | null;
    shuttleRouteId?: string | null;
    shuttleRoute?: unknown;
    tour?: { slug: string; category?: string | null } | null;
  };
}

const dateOf = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : formatDateOnly(d));
const hhmm = (t: Date | string | null) => (t == null ? "" : typeof t === "string" ? t.slice(0, 5) : formatTimeOfDay(t));

const SEASON_NOTE = "Moraine Lake and the Columbia Icefield activities run from June 1 to October 10 only, so they are not part of your date's itinerary.";

function packageDay(snapshot: unknown): { slug: string; day: number } | null {
  const pkg = (snapshot as { package?: { slug?: unknown; day?: unknown } } | null)?.package;
  if (!pkg || typeof pkg.slug !== "string" || typeof pkg.day !== "number") return null;
  return { slug: pkg.slug, day: pkg.day };
}

const isShuttle = (d: ItineraryBooking["tourDeparture"]) =>
  Boolean(d.shuttleRouteId || d.shuttleRoute || d.tour?.category === "SHUTTLE" || d.tour?.slug?.includes("shuttle"));

/** The itinerary for this booking's day, or why there is none to send. */
export function bookingItinerary(booking: ItineraryBooking): ItineraryResult {
  const d = booking.tourDeparture;
  const date = dateOf(d.date);
  const slug = d.tour?.slug ?? "";

  // 1. A day of a private Three- or Four-Day journey: that journey's itinerary for the day.
  const pkg = packageDay(booking.priceSnapshot);
  const journey = pkg ? PACKAGE_ITINERARIES[pkg.slug as keyof typeof PACKAGE_ITINERARIES] : undefined;
  if (pkg && journey) {
    const day = journey.find((x) => x.dayNumber === pkg.day);
    if (!day) {
      return { ok: false, reason: `No Day ${pkg.day} in the website itinerary of ${pkg.slug}.`, guestNote: MISSING_ITINERARY_NOTE };
    }
    return {
      ok: true,
      itinerary: {
        heading: day.title,
        duration: null,
        steps: [],
        stops: day.stops.map((s) => ({ name: s.name, text: s.desc })),
        notes: [day.closing],
        source: `package:${pkg.slug}:${pkg.day}`,
      },
    };
  }

  // 2. A day tour (also each day of the Two-Day Rockies Explorer, shared or private).
  const tour = TOUR_ITINERARIES[slug];
  if (tour) {
    const summer = inSummerSeason(date);
    if (!summer && tour.winterRouteToBeConfirmed) {
      return {
        ok: false,
        reason: `${tour.title} on ${date}: the website publishes only the June 1 – October 10 route; the team confirms the winter route for each date.`,
        guestNote: `Between October 11 and May 31 the Ice Explorer and Skywalk don't run and the route is adjusted for winter. ${MISSING_ITINERARY_NOTE}`,
      };
    }
    const stops = tour.stops.filter((s) => summer || !s.summerOnly).map(({ name, text }) => ({ name, text }));
    const notes = [...(tour.pickup ?? []), ...tour.seasonal];
    if (!summer && tour.stops.some((s) => s.summerOnly)) notes.unshift(SEASON_NOTE);
    return {
      ok: true,
      itinerary: { heading: null, duration: tour.duration, steps: tour.steps, stops, notes, source: `tour:${slug}` },
    };
  }

  // 3. A shuttle: its row of the website timetable.
  if (isShuttle(d)) {
    const time = hhmm(d.departureTime);
    const dep = SHUTTLE_DEPARTURES.find((x) => x.pickup.banff === time);
    if (!dep) {
      return { ok: false, reason: `Shuttle departure at ${time || "no time"} is not on the website's shuttle timetable.`, guestNote: MISSING_ITINERARY_NOTE };
    }
    if (!departuresFor(date).some((x) => x.number === dep.number)) {
      return { ok: false, reason: `Shuttle departure ${dep.number} (${time}) doesn't run on ${date} according to the website's timetable.`, guestNote: MISSING_ITINERARY_NOTE };
    }
    const pickups = SHUTTLE_PICKUPS.map((p) => (dep.pickup[p.id] ? `${p.label} ${shuttleClock(dep.pickup[p.id]!)}` : null)).filter(Boolean).join(" · ");
    return {
      ok: true,
      itinerary: {
        heading: `Departure ${dep.number} · ${dep.name}`,
        duration: null,
        steps: [
          { time: "Pickup", text: pickups },
          { time: clockRange(dep.moraine), text: "Moraine Lake" },
          { time: clockRange(dep.louise), text: "Lake Louise" },
          { time: "Return", text: `Back in Banff around ${shuttleClock(dep.returnBanff)} and Canmore around ${shuttleClock(dep.returnCanmore)} (estimated).` },
        ],
        stops: [],
        notes: [
          "Shuttle departures have specific lake pickup times, which must be followed.",
          "Times are local Alberta time. Your exact pickup time and stop are shown above.",
        ],
        source: `shuttle:${dep.number}`,
      },
    };
  }

  // 4. Nothing current on the website for this product: never fall back to old catalog text.
  return {
    ok: false,
    reason: `No current website itinerary for "${slug || "unknown product"}".`,
    guestNote: MISSING_ITINERARY_NOTE,
  };
}
