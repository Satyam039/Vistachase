// Pure tour helpers shared by server pages and client components (no "use client":
// server pages can call these directly). TourCard re-exports them for existing imports.
import type { TourWithAvailability } from "@/lib/api/types";

/**
 * Lowest price a guest can actually book: the cheapest scheduled departure, or the
 * tour's list price when nothing is scheduled (dates on request).
 */
export function fromPrice(tour: TourWithAvailability) {
  const departures = Array.isArray(tour?.departures) ? tour.departures : [];
  const prices = departures.map((d) => d.price).filter((p) => p > 0);
  return prices.length > 0 ? Math.min(...prices) : (tour?.basePrice ?? 0);
}

export function isVehicleTour(tour: TourWithAvailability) {
  return tour?.category === "PRIVATE";
}

/** "Price from" unit label: private tours and packages are priced per group. */
export function priceUnitLabel(tour: TourWithAvailability) {
  return tour?.priceUnit === "GROUP" ? "per group" : "per guest";
}

/** Duration as the product page states it ("9-11 hours"), falling back to the hours figure. */
export function durationLabel(tour: TourWithAvailability) {
  return tour?.facts?.find((f) => /duration/i.test(f.label))?.value ?? `${tour?.durationHours ?? 8} hours`;
}

/** Group size line; per-group tours list their vehicle sizes ("6 or 13 guests"). */
export function groupLabel(tour: TourWithAvailability) {
  if (tour?.category === "TICKET") return "Individual tickets";
  if (Array.isArray(tour?.vehicleOptions) && tour.vehicleOptions.length > 0) {
    return `Private, up to ${tour.vehicleOptions.map((v) => v.seats).join(" or ")} guests`;
  }
  return `Max ${tour?.maxGroupSize ?? 12} guests`;
}

export function reviewsLabel(tour: TourWithAvailability) {
  const count = tour?.reviewCount ?? 0;
  return count >= 1000
    ? `${count.toLocaleString("en-CA")}+ reviews`
    : `${count} reviews`;
}

/** Whether a departure can take this party. */
/** Readable category names for chips and labels. */
export const CATEGORY_LABEL: Record<string, string> = {
  SHARED: "Shared tour",
  PRIVATE: "Private tour",
  SHUTTLE: "Shuttle",
  MULTIDAY: "Multi-Day Journey",
  TICKET: "Activity ticket",
};

export function departureFits(tour: TourWithAvailability, departure: TourWithAvailability["departures"][number], seats: number) {
  if (!departure) return false;
  return isVehicleTour(tour)
    ? departure.seatsAvailable >= departure.capacityTotal && seats <= departure.capacityTotal
    : departure.seatsAvailable >= seats;
}

export function nextDepartureFor(tour: TourWithAvailability, seats: number, date?: string) {
  const departures = Array.isArray(tour?.departures) ? tour.departures : [];
  return departures.find((d) => departureFits(tour, d, seats) && (!date || d.date === date));
}

/**
 * Display wording for imported pickup inclusions: the catalog's "Doorstep pickup & drop-off"
 * (and its "/drop-off" spelling) reads "Hotel pickup" on the site; any note after it, such as
 * "(Banff, Canmore, Lake Louise)", is kept. Other inclusions pass through unchanged.
 */
export function pickupLabel(text: string) {
  return text.replace(/^doorstep pickup\s*(?:&|\/|and)\s*drop-?off/i, "Hotel pickup");
}

/**
 * A category's "from" offer for the home hero, worked out from the tours' own data so nothing is
 * claimed that a product doesn't have: the lowest bookable price, its unit, and only the inclusions
 * and group-size limit every priced tour in the category confirms. An inclusion only some of them
 * have says "on select tours". No sales tax is added to any price (backend booking-pricing.ts,
 * business decision 2026-10-08), so every price is tax-inclusive.
 */
export interface CategoryOffer {
  from: number;
  unit: "per person" | "per group";
  inclusions: string[];
  maxGuests: number | null;
}

const OFFER_INCLUSIONS: { label: string; test: (tour: TourWithAvailability) => boolean }[] = [
  { label: "Guided tour", test: (t) => (t.inclusions ?? []).some((i) => /guide/i.test(i)) },
  { label: "Transportation", test: (t) => (t.inclusions ?? []).some((i) => /transport|pickup|shuttle|suv|van|vehicle/i.test(i)) },
  { label: "Park admission", test: (t) => (t.inclusions ?? []).some((i) => /parks canada/i.test(i)) },
  {
    label: "Moraine Lake shuttle",
    test: (t) => [...(t.inclusions ?? []), ...(t.highlights ?? [])].some((i) => /moraine lake/i.test(i)),
  },
];

/** "Max 12 people" from the tour's "Small group" fact; null when the tour states no limit. */
function factMaxGuests(tour: TourWithAvailability) {
  const fact = tour.facts?.find((f) => /small group/i.test(f.label));
  const match = fact?.value.match(/max(?:imum)?\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function categoryOffer(tours: TourWithAvailability[], category: string): CategoryOffer | null {
  const priced = tours.filter((t) => t.category === category && fromPrice(t) > 0);
  if (priced.length === 0) return null;
  const inclusions = OFFER_INCLUSIONS.flatMap(({ label, test }) => {
    const count = priced.filter(test).length;
    if (count === priced.length) return [label];
    return count > 0 && label === "Moraine Lake shuttle" ? ["Moraine Lake shuttle"] : [];
  });
  const limits = priced.map(factMaxGuests);
  return {
    from: Math.min(...priced.map(fromPrice)),
    unit: priced.every((t) => t.priceUnit !== "GROUP") ? "per person" : "per group",
    inclusions,
    maxGuests: limits.every((n): n is number => n !== null) ? Math.max(...limits) : null,
  };
}
