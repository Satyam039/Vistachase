// Airport transfer with a private tour (owner, 2026-10-29): under Guests the guest can add an
// airport transfer, and checkout asks for their airport arrival and departure dates and times, and
// (owner, 2026-10-31) where the transfer is from and where it goes.
// Prices (owner's doc pricing table, 2026-11-04), private Calgary Airport transfer per one-way
// trip: Banff or Canmore CAD 364 for up to 6 guests (6 checked bags), 850 for up to 12 (12 bags);
// Lake Louise 445 / 895. The booking covers the arrival and the departure trip (two transfers).
// More than 12 guests: priced by the team. The details are kept in the booking's price snapshot and
// as the first line of its special requests, so staff see them in the booking, the manifest, the
// voucher and the Bókun booking note.

import { z } from "@/lib/security/validate";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const airportTransferSchema = z
  .object({
    arrivalDate: z.string().regex(DATE, "Use YYYY-MM-DD"),
    arrivalTime: z.string().regex(TIME, "Use HH:MM"),
    departureDate: z.string().regex(DATE, "Use YYYY-MM-DD"),
    departureTime: z.string().regex(TIME, "Use HH:MM"),
    /** Town at the mountain end of the transfer; sets the price. */
    town: z.enum(["BANFF", "CANMORE", "LAKE_LOUISE"]).default("BANFF"),
    from: z.string().trim().min(2, "Say where we pick you up").max(160),
    to: z.string().trim().min(2, "Say where we take you").max(160),
  })
  .refine((t) => `${t.departureDate} ${t.departureTime}` > `${t.arrivalDate} ${t.arrivalTime}`, {
    message: "Departure must be after arrival",
    path: ["departureDate"],
  });

export type AirportTransfer = z.infer<typeof airportTransferSchema>;

export const TOWN_LABEL: Record<AirportTransfer["town"], string> = { BANFF: "Banff", CANMORE: "Canmore", LAKE_LOUISE: "Lake Louise" };

/** One-way transfer prices in cents: [up to 6 guests, up to 12 guests]. */
export const AIRPORT_TRANSFER_CENTS: Record<AirportTransfer["town"], [number, number]> = {
  BANFF: [36400, 85000],
  CANMORE: [36400, 85000],
  LAKE_LOUISE: [44500, 89500],
};
export const AIRPORT_TRANSFER_LEGS = 2;

/** Price of one one-way transfer for this party (cents), or null above 12 guests (the team quotes). */
export function airportTransferLegCents(town: AirportTransfer["town"], guests: number): number | null {
  if (guests > 12) return null;
  return AIRPORT_TRANSFER_CENTS[town][guests <= 6 ? 0 : 1];
}

/** Arrival and departure transfers together (cents), or null when the team quotes it. */
export function airportTransferCents(t: Pick<AirportTransfer, "town">, guests: number): number | null {
  const leg = airportTransferLegCents(t.town, guests);
  return leg == null ? null : leg * AIRPORT_TRANSFER_LEGS;
}

/** The line staff read in the booking's special requests. */
export function airportTransferNote(t: AirportTransfer, priceCents: number | null = null): string {
  const price = priceCents == null ? "price to be confirmed by Vista Chase" : `CAD ${(priceCents / 100).toFixed(2)} paid at checkout`;
  return `Airport transfer (${TOWN_LABEL[t.town]}, arrival and departure): from ${t.from} to ${t.to}, arrival ${t.arrivalDate} ${t.arrivalTime}, departure ${t.departureDate} ${t.departureTime} (${price}).`;
}
