// Airport transfer with a private tour (owner, 2026-10-29): under Guests the guest can add an
// airport transfer, and checkout asks for their airport arrival and departure dates and times, and
// (owner, 2026-10-31) where the transfer is from and where it goes.
//
// Price (owner, 2026-11-11: "jahan bhi airport wala hai CAD $364 /transfer karde, aur uska price
// final price mein add ho jaye"): one flat CAD 364 for the transfer (arrival and departure, as the
// owner set on 2026-11-04), whatever the area, season or group size, added to the total when the
// guest ticks the box. Replaces the 2026-11-04 table (Banff/Canmore 364/850, Lake Louise 445/895,
// summer only).
// The details are kept in the booking's price snapshot and as the first line of its special
// requests, so staff see them in the booking, the manifest, the voucher and the Bókun booking note.
// Frontend mirror: frontend/src/components/booking/AirportTransferFields.tsx.

import { z } from "@/lib/security/validate";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const airportTransferSchema = z
  .object({
    arrivalDate: z.string().regex(DATE, "Use YYYY-MM-DD"),
    arrivalTime: z.string().regex(TIME, "Use HH:MM"),
    departureDate: z.string().regex(DATE, "Use YYYY-MM-DD"),
    departureTime: z.string().regex(TIME, "Use HH:MM"),
    from: z.string().trim().min(2, "Say where we pick you up").max(160),
    to: z.string().trim().min(2, "Say where we take you").max(160),
    /** Where the guest stays, for the price. Older pages don't send it: priced by the team then. */
    area: z.enum(["BANFF", "CANMORE", "LAKE_LOUISE"]).optional(),
  })
  .refine((t) => `${t.departureDate} ${t.departureTime}` > `${t.arrivalDate} ${t.arrivalTime}`, {
    message: "Departure must be after arrival",
    path: ["departureDate"],
  });

export type AirportTransfer = z.infer<typeof airportTransferSchema>;

const AREA_LABEL = { BANFF: "Banff", CANMORE: "Canmore", LAKE_LOUISE: "Lake Louise" } as const;

/** CAD 364 per transfer, in cents (owner, 2026-11-11). */
export const AIRPORT_TRANSFER_PRICE_CENTS = 36400;

/** The transfer's price in cents. Available only for 2+ guests (null below that). */
export function airportTransferPriceCents(_t: Pick<AirportTransfer, "area" | "arrivalDate">, guests: number): number | null {
  if (guests < 2) return null;
  return AIRPORT_TRANSFER_PRICE_CENTS;
}

/** The checkout line for a priced transfer. */
export function airportTransferLabel(t: Pick<AirportTransfer, "area">, guests: number): string {
  void guests;
  return `Calgary Airport transfer${t.area ? ` (${AREA_LABEL[t.area]})` : ""}`;
}

/** The line staff read in the booking's special requests. */
export function airportTransferNote(t: AirportTransfer, priceCents: number | null = null): string {
  const area = t.area ? `, staying in ${AREA_LABEL[t.area]}` : "";
  const price = priceCents != null ? `CAD ${(priceCents / 100).toFixed(2)}, paid with the tour` : "price to be confirmed by Vista Chase";
  return `Airport transfer requested: from ${t.from} to ${t.to}${area}, arrival ${t.arrivalDate} ${t.arrivalTime}, departure ${t.departureDate} ${t.departureTime} (${price}).`;
}
