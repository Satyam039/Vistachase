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
  capacityTotal: number;
  tour?: { category: string } | null;
}

export function isVehicleDeparture(departure: PricedDeparture): boolean {
  return departure.tour?.category === "PRIVATE";
}

/** Seats a booking or hold removes from sale. */
export function seatsToReserve(departure: PricedDeparture, guests: number): number {
  return isVehicleDeparture(departure) ? departure.capacityTotal : guests;
}

/** Fare before add-ons and tax. */
export function fareSubtotal(departure: PricedDeparture, guests: number): number {
  return isVehicleDeparture(departure) ? departure.price : departure.price * guests;
}

/** Problem with the party size for this departure, if any. */
export function partySizeError(departure: PricedDeparture, guests: number): string | null {
  if (guests < 1) return "At least one guest is required.";
  if (isVehicleDeparture(departure) && guests > departure.capacityTotal) {
    return `This private vehicle seats up to ${departure.capacityTotal} guests.`;
  }
  return null;
}
