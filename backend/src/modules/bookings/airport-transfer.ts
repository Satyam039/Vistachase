// Airport transfer with a private tour (owner, 2026-10-29): under Guests the guest can add an
// airport transfer, and checkout asks for their airport arrival and departure dates and times, and
// (owner, 2026-10-31) where the transfer is from and where it goes.
//
// Price (owner's doc, Pricing, 2026-11-04; owner 2026-11-04: the price covers both ways, arrival
// and departure): Calgary Airport to/from Banff or Canmore CAD 364 for up to 6 guests (6 checked
// bags) or CAD 850 for up to 12 (12 bags); Lake Louise CAD 445 / 895. Charged with the tour when
// the guest arrives June 1 to October 10 with up to 12 guests. In winter ("varies") or for 13+
// guests the price is confirmed by the team and nothing is charged online.
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

/** Both ways, cents: up to 6 guests, up to 12 guests. */
export const AIRPORT_TRANSFER_PRICES = {
  BANFF: { small: 36400, large: 85000 },
  CANMORE: { small: 36400, large: 85000 },
  LAKE_LOUISE: { small: 44500, large: 89500 },
} as const;

/** The transfer's price in cents (both ways), or null when the team confirms it (winter, 13+ guests, no area). */
export function airportTransferPriceCents(t: Pick<AirportTransfer, "area" | "arrivalDate">, guests: number): number | null {
  if (!t.area) return null;
  const md = t.arrivalDate.slice(5, 10);
  if (md < "06-01" || md > "10-10") return null;
  if (guests <= 6) return AIRPORT_TRANSFER_PRICES[t.area].small;
  if (guests <= 12) return AIRPORT_TRANSFER_PRICES[t.area].large;
  return null;
}

/** The checkout line for a priced transfer. */
export function airportTransferLabel(t: Pick<AirportTransfer, "area">, guests: number): string {
  return `Calgary Airport transfer, both ways (${t.area ? AREA_LABEL[t.area] : "Banff"}, up to ${guests <= 6 ? 6 : 12} guests)`;
}

/** The line staff read in the booking's special requests. */
export function airportTransferNote(t: AirportTransfer, priceCents: number | null = null): string {
  const area = t.area ? `, staying in ${AREA_LABEL[t.area]}` : "";
  const price = priceCents != null ? `CAD ${(priceCents / 100).toFixed(2)} both ways, paid with the tour` : "price to be confirmed by Vista Chase";
  return `Airport transfer requested: from ${t.from} to ${t.to}${area}, arrival ${t.arrivalDate} ${t.arrivalTime}, departure ${t.departureDate} ${t.departureTime} (${price}).`;
}
