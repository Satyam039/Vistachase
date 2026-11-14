// Which pickup stops a tour may use.
//
// Shared (small-group) tours don't pick up in Lake Louise (owner's "VistaChase Website" PDF,
// 2026-11-14, Fix #006): the detour adds driving time and puts the day's itinerary at risk. This
// covers the Banff & Yoho Discovery (banff-highlights-tour) and the Columbia Icefield Adventure
// (shared-tours-icefields-jasper), and with them the shared Two-Day Rockies Explorer, which books
// those two departures. Private tours (category PRIVATE), shuttles (Lake Louise Village is a shuttle
// stop) and everything else keep every active stop.
//
// The checkout lists only the allowed stops (getCheckoutDeparture), and createBooking refuses any
// other, so the rule holds for the website, the concierge, packages and API callers alike. Staff can
// still set any pickup on an existing booking in Admin.

export const NO_LAKE_LOUISE_PICKUP_CATEGORIES = new Set(["SHARED"]);

type TourLike = { category?: string | null } | null | undefined;
type StopLike = { town?: string | null; name?: string | null; address?: string | null };

const isLakeLouise = (text: string | null | undefined) => /lake\s*louise/i.test(text ?? "");

/** True when this tour may not pick up in Lake Louise. */
export function excludesLakeLouisePickup(tour: TourLike): boolean {
  return NO_LAKE_LOUISE_PICKUP_CATEGORIES.has(String(tour?.category ?? "").toUpperCase());
}

/** A stop in Lake Louise: its town is Lake Louise (Samson Mall, the Chateau, Lake Louise Inn…). */
export function isLakeLouiseStop(stop: StopLike): boolean {
  return isLakeLouise(stop.town);
}

/** The stops this tour's checkout offers. */
export function stopsForTour<T extends StopLike>(tour: TourLike, stops: T[]): T[] {
  return excludesLakeLouisePickup(tour) ? stops.filter((s) => !isLakeLouiseStop(s)) : stops;
}

export const LAKE_LOUISE_PICKUP_REFUSED =
  "Our small-group (shared) tours pick up in Banff and Canmore only, not Lake Louise. Please choose a Banff or Canmore pickup, or book a private tour for a Lake Louise pickup.";

/** Why this pickup can't be used on this tour, or null when it's fine. */
export function pickupError(tour: TourLike, stop: StopLike | null, customText?: string | null): string | null {
  if (!excludesLakeLouisePickup(tour)) return null;
  if (stop && isLakeLouiseStop(stop)) return LAKE_LOUISE_PICKUP_REFUSED;
  if (!stop && isLakeLouise(customText)) return LAKE_LOUISE_PICKUP_REFUSED;
  return null;
}
