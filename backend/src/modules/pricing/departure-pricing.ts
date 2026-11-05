/**
 * How a departure is sold.
 *
 * Shared tours and shuttles sell seats: the fare is price × guests and each guest takes one seat.
 * Private tours sell the whole vehicle: the fare is the departure price once (per vehicle), and a
 * booking or hold takes every seat, so no second party can be sold the same departure. Guests are
 * still counted (manifests, add-ons) but are capped at the vehicle's seats.
 */

interface PricedDeparture {
  price: number;
  /** Per-youth (6–15) price (cents) when it differs from the adult price; adults' price otherwise. */
  childPrice?: number | null;
  /** Per-infant (0–5) price (cents). Set: infants pay it and take a seat. Null: free on a lap. */
  infantPrice?: number | null;
  capacityTotal: number;
  tour?: { category: string } | null;
}

export function isVehicleDeparture(departure: PricedDeparture): boolean {
  return departure.tour?.category === "PRIVATE";
}

/** Infants who pay and take a seat on this departure (none when infants ride free). */
export function seatedInfants(departure: { infantPrice?: number | null }, infants = 0): number {
  return departure.infantPrice != null ? infants : 0;
}

/** Guests who take a seat: adults, youth and, where infants pay, infants. */
export function seatedGuests(departure: { infantPrice?: number | null }, party: { adults: number; children?: number; infants?: number }): number {
  return party.adults + (party.children ?? 0) + seatedInfants(departure, party.infants ?? 0);
}

/** Seats a booking or hold removes from sale. */
export function seatsToReserve(departure: PricedDeparture, guests: number): number {
  return isVehicleDeparture(departure) ? departure.capacityTotal : guests;
}

/**
 * Fare before add-ons, in cents (departure prices are stored in cents). Private tours: one
 * vehicle price. Otherwise adults at the departure price, youth at the child price and infants at
 * the infant price (free when the departure has none).
 */
export function fareSubtotal(departure: PricedDeparture, adults: number, children = 0, infants = 0): number {
  if (isVehicleDeparture(departure)) return departure.price;
  return (
    departure.price * adults +
    (departure.childPrice ?? departure.price) * children +
    (departure.infantPrice ?? 0) * seatedInfants(departure, infants)
  );
}

/** Problem with the party size for this departure, if any. */
export function partySizeError(departure: PricedDeparture, guests: number): string | null {
  if (guests < 1) return "At least one guest is required.";
  if (isVehicleDeparture(departure) && guests > departure.capacityTotal) {
    return `This private vehicle seats up to ${departure.capacityTotal} guests.`;
  }
  return null;
}
