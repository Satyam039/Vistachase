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
export const NO_CUSTOM_PICKUP_CATEGORIES = new Set(["SHARED", "SHUTTLE"]);

type TourLike = { category?: string | null; slug?: string | null } | null | undefined;
type StopLike = { town?: string | null; name?: string | null; address?: string | null };

const isLakeLouise = (text: string | null | undefined) => /lake\s*louise/i.test(text ?? "");
const isOutsideCanmoreBanff = (text: string | null | undefined) =>
  /\b(lake\s*louise|calgary|jasper|golden|field|revelstoke|edmonton|airdrie|cochrane|radium|invermere)\b/i.test(text ?? "");

/** True when this tour may not pick up in Lake Louise. */
export function excludesLakeLouisePickup(tour: TourLike): boolean {
  return NO_LAKE_LOUISE_PICKUP_CATEGORIES.has(String(tour?.category ?? "").toUpperCase());
}

/** True when this tour allows listed stops only (no free-text custom pickup address). */
export function excludesCustomPickup(tour: TourLike, isShuttle = false): boolean {
  return (
    isShuttle ||
    NO_CUSTOM_PICKUP_CATEGORIES.has(String(tour?.category ?? "").toUpperCase()) ||
    Boolean(tour?.slug?.includes("shuttle"))
  );
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

export const CUSTOM_PICKUP_REFUSED =
  "Custom pickup addresses are not available for shuttles or shared tours. Please choose one of the listed pickup locations.";

export const PRIVATE_CUSTOM_PICKUP_TOWN_REFUSED =
  "Custom pickup addresses on private tours are available in Canmore and Banff only. Please choose a listed stop or enter a Canmore or Banff address.";

/** Why this pickup can't be used on this tour, or null when it's fine. */
export function pickupError(
  tour: TourLike,
  stop: StopLike | null,
  customText?: string | null,
  options?: { isShuttle?: boolean; allowCustomPickup?: boolean },
): string | null {
  const trimmedCustom = customText?.trim() ?? "";
  if (!options?.allowCustomPickup && trimmedCustom && excludesCustomPickup(tour, options?.isShuttle)) {
    return CUSTOM_PICKUP_REFUSED;
  }
  if (
    !options?.allowCustomPickup &&
    trimmedCustom &&
    !stop &&
    String(tour?.category ?? "").toUpperCase() === "PRIVATE" &&
    !/^Jasper:/i.test(trimmedCustom) &&
    isOutsideCanmoreBanff(trimmedCustom)
  ) {
    return PRIVATE_CUSTOM_PICKUP_TOWN_REFUSED;
  }
  if (!excludesLakeLouisePickup(tour)) return null;
  if (stop && isLakeLouiseStop(stop)) return LAKE_LOUISE_PICKUP_REFUSED;
  if (!stop && isLakeLouise(customText)) return LAKE_LOUISE_PICKUP_REFUSED;
  return null;
}
