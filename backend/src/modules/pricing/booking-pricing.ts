// Everything a booking costs, worked out on the server in whole cents. The browser only says which
// add-ons and promo code the guest chose; it never sends prices. No sales tax is added: prices
// are what the guest pays (business decision, 2026-10-08).

import { fareSubtotal } from "@/modules/pricing/departure-pricing";

/** Add-ons offered at checkout (frontend BookingCheckoutClient ADD_ONS), priced here. */
export const ADD_ONS = [
  { id: "parkPass", name: "Parks Canada Discovery Pass Assistance", priceCents: 2500, perGuest: false },
  { id: "hotDrinks", name: "Hot Drink & Morning Pastry Package", priceCents: 1500, perGuest: true },
  { id: "lunch", name: "Gourmet Rockies Packed Lunch", priceCents: 2200, perGuest: true },
] as const;

export type AddOnChoice = { id?: string; name?: string };

/**
 * Promo codes as "CODE:percent" pairs in PROMO_CODES (e.g. "RIMROCKBANFF5:5,BANFF10:10"), the same
 * codes configured in Bókun. TESTVISTA100 (100% off, for end-to-end tests) works only outside
 * production.
 */
export function promoCodes(): Map<string, number> {
  const raw = process.env.PROMO_CODES ?? "RIMROCKBANFF5:5,BANFF10:10";
  const codes = new Map<string, number>();
  for (const pair of raw.split(",")) {
    const [code, percent] = pair.split(":").map((s) => s.trim());
    const value = Number(percent);
    if (code && Number.isFinite(value) && value > 0 && value <= 100) codes.set(code.toUpperCase(), value);
  }
  if (process.env.NODE_ENV !== "production") codes.set("TESTVISTA100", 100);
  return codes;
}

export function promoPercent(code?: string | null): number | null {
  if (!code) return null;
  return promoCodes().get(code.trim().toUpperCase()) ?? null;
}

export interface PricedDeparture {
  price: number; // cents
  capacityTotal: number;
  tour?: { category: string } | null;
}

export interface BookingTotals {
  fareCents: number;
  discountPercent: number;
  discountCents: number;
  addOns: { name: string; priceCents: number; quantity: number }[];
  addOnsCents: number;
  totalCents: number;
}

export function priceBooking(
  departure: PricedDeparture,
  guests: number,
  addOnChoices: AddOnChoice[] = [],
  promoCode?: string | null,
): BookingTotals {
  const fareCents = fareSubtotal(departure, guests);
  const discountPercent = promoPercent(promoCode) ?? 0;
  const discountCents = Math.round((fareCents * discountPercent) / 100);

  // Each add-on once, matched by id (or by its stored name, for older clients); prices are ours.
  const seen = new Set<string>();
  const addOns = addOnChoices
    .map((choice) => ADD_ONS.find((a) => a.id === choice.id || a.name === choice.name))
    .filter((a): a is (typeof ADD_ONS)[number] => Boolean(a) && !seen.has(a!.id) && Boolean(seen.add(a!.id)))
    .map((a) => ({ name: a.name, priceCents: a.priceCents, quantity: a.perGuest ? guests : 1 }));
  const addOnsCents = addOns.reduce((sum, a) => sum + a.priceCents * a.quantity, 0);

  const totalCents = fareCents - discountCents + addOnsCents;
  return { fareCents, discountPercent, discountCents, addOns, addOnsCents, totalCents };
}
