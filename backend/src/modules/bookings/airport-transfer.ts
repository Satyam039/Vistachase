// Airport transfer with a private tour (owner, 2026-10-29): under Guests the guest can add an
// airport transfer, and checkout asks for their airport arrival and departure dates and times.
// The owner's doc gives no transfer price yet, so nothing is charged online: the team confirms the
// transfer and its price with the guest. The details are kept in the booking's price snapshot and
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
  })
  .refine((t) => `${t.departureDate} ${t.departureTime}` > `${t.arrivalDate} ${t.arrivalTime}`, {
    message: "Departure must be after arrival",
    path: ["departureDate"],
  });

export type AirportTransfer = z.infer<typeof airportTransferSchema>;

/** The line staff read in the booking's special requests. */
export function airportTransferNote(t: AirportTransfer): string {
  return `Airport transfer requested: arrival ${t.arrivalDate} ${t.arrivalTime}, departure ${t.departureDate} ${t.departureTime} (price to be confirmed by Vista Chase).`;
}
