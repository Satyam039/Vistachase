// Pure tour helpers shared by server pages and client components (no "use client":
// server pages can call these directly). TourCard re-exports them for existing imports.
import type { TourWithAvailability } from "@/lib/api/types";

/**
 * Lowest price a guest can actually book: the cheapest scheduled departure, or the
 * tour's list price when nothing is scheduled (dates on request).
 */
export function fromPrice(tour: TourWithAvailability) {
  const prices = tour.departures.map((d) => d.price).filter((p) => p > 0);
  return prices.length > 0 ? Math.min(...prices) : tour.basePrice;
}

export function isVehicleTour(tour: TourWithAvailability) {
  return tour.category === "PRIVATE";
}

/** "Price from" unit label: private tours and packages are priced per group. */
export function priceUnitLabel(tour: TourWithAvailability) {
  return tour.priceUnit === "GROUP" ? "per group" : "per guest";
}

/** Duration as the product page states it ("9-11 hours"), falling back to the hours figure. */
export function durationLabel(tour: TourWithAvailability) {
  return tour.facts.find((f) => /duration/i.test(f.label))?.value ?? `${tour.durationHours} hours`;
}

/** Group size line; per-group tours list their vehicle sizes ("6 or 13 guests"). */
export function groupLabel(tour: TourWithAvailability) {
  if (tour.category === "TICKET") return "Individual tickets";
  if (tour.vehicleOptions.length > 0) {
    return `Private, up to ${tour.vehicleOptions.map((v) => v.seats).join(" or ")} guests`;
  }
  return `Max ${tour.maxGroupSize} guests`;
}

export function reviewsLabel(tour: TourWithAvailability) {
  return tour.reviewCount >= 1000
    ? `${tour.reviewCount.toLocaleString("en-CA")}+ reviews`
    : `${tour.reviewCount} reviews`;
}

/** Whether a departure can take this party. */
/** Readable category names for chips and labels. */
export const CATEGORY_LABEL: Record<string, string> = {
  SHARED: "Shared tour",
  PRIVATE: "Private tour",
  SHUTTLE: "Shuttle",
  MULTIDAY: "Multi-day",
  TICKET: "Activity ticket",
};

export function departureFits(tour: TourWithAvailability, departure: TourWithAvailability["departures"][number], seats: number) {
  return isVehicleTour(tour)
    ? departure.seatsAvailable >= departure.capacityTotal && seats <= departure.capacityTotal
    : departure.seatsAvailable >= seats;
}

export function nextDepartureFor(tour: TourWithAvailability, seats: number, date?: string) {
  return tour.departures.find((d) => departureFits(tour, d, seats) && (!date || d.date === date));
}
