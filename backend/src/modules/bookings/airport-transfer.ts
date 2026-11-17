// Airport transfer with a private tour (owner, 2026-10-29): under Guests the guest can add an
// airport transfer, and checkout asks for their flight times and (owner, 2026-10-31) where the
// transfer is from and where it goes.
//
// Transfer type (owner, 2026-11-17): Arrival only (airport -> hotel), Departure only (hotel ->
// airport) or Round trip (airport -> hotel -> airport). A round trip is two transfers and is charged
// as two. Older pages sent no type with both arrival and departure times: read as a round trip.
//
// Price per transfer, one way (owner, 2026-11-17), by where the guest stays ("Where you're staying"):
//   up to 12 guests: CAD 850 Calgary <-> Banff / Canmore, CAD 895 Calgary <-> Lake Louise.
//   up to 6 guests: not confirmed yet (SMALL_GROUP_CENTS is null), so the 12-guest price applies to
//   every group size until the owner confirms it. Set the small-group prices below to turn it on.
//   13+ guests: no approved price: not charged, the team confirms it (priceCents null).
// Replaces the flat CAD 364 per booking (2026-11-11), which charged a round trip as one transfer.
// The server prices the transfer: the checkout reads these prices from GET /api/bookings/airport-transfer.
// The details are kept in the booking's price snapshot, as a booking item ("x2" for a round trip) and
// as the first line of its special requests, so staff see them in the booking, the manifest, the
// voucher, the emails and the Bókun booking note.

import { z } from "@/lib/security/validate";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const AIRPORT_TRANSFER_TYPES = ["ARRIVAL", "DEPARTURE", "ROUND_TRIP"] as const;
export type AirportTransferType = (typeof AIRPORT_TRANSFER_TYPES)[number];
export type AirportArea = "BANFF" | "CANMORE" | "LAKE_LOUISE";

const optionalDate = z.string().regex(DATE, "Use YYYY-MM-DD").optional();
const optionalTime = z.string().regex(TIME, "Use HH:MM").optional();

export const airportTransferSchema = z
  .object({
    /** Arrival only, departure only or round trip. Missing (older pages): from the times sent. */
    type: z.enum(AIRPORT_TRANSFER_TYPES).optional(),
    arrivalDate: optionalDate,
    arrivalTime: optionalTime,
    departureDate: optionalDate,
    departureTime: optionalTime,
    from: z.string().trim().min(2, "Say where we pick you up").max(160),
    to: z.string().trim().min(2, "Say where we take you").max(160),
    /** Where the guest stays: sets the price. Required to book (checked when the booking is priced). */
    area: z.enum(["BANFF", "CANMORE", "LAKE_LOUISE"]).optional(),
  })
  .transform((t) => ({ ...t, type: t.type ?? inferType(t) }))
  .refine((t) => !needsArrival(t.type) || (t.arrivalDate && t.arrivalTime), { message: "Enter your arrival date and time", path: ["arrivalDate"] })
  .refine((t) => !needsDeparture(t.type) || (t.departureDate && t.departureTime), { message: "Enter your departure date and time", path: ["departureDate"] })
  .refine((t) => t.type !== "ROUND_TRIP" || `${t.departureDate} ${t.departureTime}` > `${t.arrivalDate} ${t.arrivalTime}`, {
    message: "Departure must be after arrival",
    path: ["departureDate"],
  });

export type AirportTransfer = z.output<typeof airportTransferSchema>;
/** What callers may pass in (type optional, as an older page sends it). */
export type AirportTransferInput = z.input<typeof airportTransferSchema>;

function inferType(t: { arrivalDate?: string; departureDate?: string }): AirportTransferType {
  if (t.arrivalDate && t.departureDate) return "ROUND_TRIP";
  return t.departureDate ? "DEPARTURE" : "ARRIVAL";
}
const needsArrival = (type: AirportTransferType) => type !== "DEPARTURE";
const needsDeparture = (type: AirportTransferType) => type !== "ARRIVAL";

export const AREA_LABEL: Record<AirportArea, string> = { BANFF: "Banff", CANMORE: "Canmore", LAKE_LOUISE: "Lake Louise" };
export const TYPE_LABEL: Record<AirportTransferType, string> = { ARRIVAL: "Arrival only", DEPARTURE: "Departure only", ROUND_TRIP: "Round trip" };

/** The largest group the approved prices cover. */
export const AIRPORT_TRANSFER_MAX_GUESTS = 12;
export const AIRPORT_TRANSFER_SMALL_GROUP_MAX = 6;

/** CAD per transfer (one way) for up to 12 guests, in cents (owner, 2026-11-17). */
export const AIRPORT_TRANSFER_CENTS: Record<AirportArea, number> = { BANFF: 85000, CANMORE: 85000, LAKE_LOUISE: 89500 };
/** Up to 6 guests: not confirmed by the owner yet. null = the 12-guest price applies. */
export const SMALL_GROUP_CENTS: Record<AirportArea, number | null> = { BANFF: null, CANMORE: null, LAKE_LOUISE: null };

/** Transfers in the booking: a round trip is two. */
export function transferCount(type: AirportTransferType): number {
  return type === "ROUND_TRIP" ? 2 : 1;
}

/** One transfer's price in cents, or null when there is no approved price (no area, under 2 or over 12 guests). */
export function airportTransferUnitCents(area: AirportArea | undefined, guests: number): number | null {
  if (!area || guests < 2 || guests > AIRPORT_TRANSFER_MAX_GUESTS) return null;
  const small = guests <= AIRPORT_TRANSFER_SMALL_GROUP_MAX ? SMALL_GROUP_CENTS[area] : null;
  return small ?? AIRPORT_TRANSFER_CENTS[area];
}

export interface AirportTransferQuote {
  type: AirportTransferType;
  transfers: number;
  unitCents: number | null;
  /** unitCents x transfers, or null when the team confirms the price. */
  totalCents: number | null;
}

export function quoteAirportTransfer(t: Pick<AirportTransfer, "type" | "area">, guests: number): AirportTransferQuote {
  const transfers = transferCount(t.type);
  const unitCents = airportTransferUnitCents(t.area, guests);
  return { type: t.type, transfers, unitCents, totalCents: unitCents == null ? null : unitCents * transfers };
}

/** The total price in cents (all transfers), or null when the team confirms it. */
export function airportTransferPriceCents(t: Pick<AirportTransfer, "type" | "area">, guests: number): number | null {
  return quoteAirportTransfer(t, guests).totalCents;
}

/** Prices for the checkout (GET /api/bookings/airport-transfer), in dollars. */
export function airportTransferPriceList() {
  const areas = (Object.keys(AIRPORT_TRANSFER_CENTS) as AirportArea[]).map((area) => ({
    area,
    label: AREA_LABEL[area],
    perTransfer: AIRPORT_TRANSFER_CENTS[area] / 100,
    perTransferSmallGroup: SMALL_GROUP_CENTS[area] == null ? null : SMALL_GROUP_CENTS[area]! / 100,
  }));
  return { currency: "CAD", minGuests: 2, maxGuests: AIRPORT_TRANSFER_MAX_GUESTS, smallGroupMax: AIRPORT_TRANSFER_SMALL_GROUP_MAX, areas };
}

/** The booking item: "Calgary Airport transfer, round trip (Banff)", quantity = transfers. */
export function airportTransferLabel(t: Pick<AirportTransfer, "type" | "area">): string {
  return `Calgary Airport transfer, ${TYPE_LABEL[t.type].toLowerCase()}${t.area ? ` (${AREA_LABEL[t.area]})` : ""}`;
}

const money = (cents: number) => `CAD ${(cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Round trip: 2 x CAD 850.00 = CAD 1,700.00" (or "price to be confirmed by Vista Chase"). */
export function airportTransferPriceText(quote: Pick<AirportTransferQuote, "transfers" | "unitCents">): string {
  if (quote.unitCents == null) return "price to be confirmed by Vista Chase";
  return quote.transfers > 1 ? `${quote.transfers} x ${money(quote.unitCents)} = ${money(quote.unitCents * quote.transfers)}` : money(quote.unitCents);
}

/** The line staff read in the booking's special requests. */
export function airportTransferNote(t: AirportTransfer, guests: number): string {
  const quote = quoteAirportTransfer(t, guests);
  const area = t.area ? `, staying in ${AREA_LABEL[t.area]}` : "";
  const times = [
    needsArrival(t.type) ? `arrival ${t.arrivalDate} ${t.arrivalTime}` : null,
    needsDeparture(t.type) ? `departure ${t.departureDate} ${t.departureTime}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const price = quote.unitCents != null ? `${airportTransferPriceText(quote)}, paid with the tour` : "price to be confirmed by Vista Chase";
  return `Airport transfer requested (${TYPE_LABEL[t.type].toLowerCase()}): from ${t.from} to ${t.to}${area}, ${times} (${price}).`;
}

/** Stored in priceSnapshot.airportTransfer. */
export interface StoredAirportTransfer extends Partial<AirportTransfer> {
  priceCents?: number | null;
  unitCents?: number | null;
  transfers?: number;
}

/**
 * The guest-facing summary of a booking's transfer, for emails, the voucher and the admin booking:
 * "Round trip (Calgary Airport (YYC) to Banff and back), 2 x CAD 850.00 = CAD 1,700.00". null without one.
 */
export function airportTransferSummary(priceSnapshot: unknown): string | null {
  const t = (priceSnapshot as { airportTransfer?: StoredAirportTransfer } | null)?.airportTransfer;
  if (!t || typeof t !== "object") return null;
  // Bookings made before 2026-11-17 have no type: they were charged one flat price for both ways.
  const type: AirportTransferType = t.type ?? inferType(t);
  const transfers = t.transfers ?? (t.type ? transferCount(type) : 1);
  const unitCents = t.unitCents ?? (t.priceCents != null ? Math.round(t.priceCents / transfers) : null);
  const route = type === "ROUND_TRIP" ? `${t.from} to ${t.to} and back` : `${t.from} to ${t.to}`;
  const times = [
    needsArrival(type) && t.arrivalDate ? `arrival ${t.arrivalDate} ${t.arrivalTime ?? ""}`.trim() : null,
    needsDeparture(type) && t.departureDate ? `departure ${t.departureDate} ${t.departureTime ?? ""}`.trim() : null,
  ].filter(Boolean);
  return `${TYPE_LABEL[type]} (${route})${times.length ? `, ${times.join(", ")}` : ""}, ${airportTransferPriceText({ transfers, unitCents })}`;
}
