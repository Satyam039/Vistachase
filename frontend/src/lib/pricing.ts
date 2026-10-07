/**
 * Original ("was") price shown struck through above the offer price.
 *
 * Vista Chase chose a fixed markup over the offer price. It is one setting: change the
 * percentage here, or set it to 0 to show only the offer price everywhere. Advertising a
 * "was" price that was never actually charged can conflict with Canadian consumer-protection
 * rules (ordinary price claims), so confirm the figure with the business.
 */
export const ORIGINAL_PRICE_MARKUP = 0.2;

/** Whether a product has a price yet (new products are "on request" until Bokun prices exist). */
export const hasPrice = (price: number | null | undefined): price is number => typeof price === "number" && price > 0;

/** The struck-through original price for an offer price, or null when there is none to show. */
export function originalPrice(offer: number | null | undefined): number | null {
  if (!hasPrice(offer) || ORIGINAL_PRICE_MARKUP <= 0) return null;
  return Math.round(offer * (1 + ORIGINAL_PRICE_MARKUP));
}

/** Whole-number saving, e.g. 17 for "Save 17%". */
export function savingsPercent(offer: number, original: number): number {
  return Math.round((1 - offer / original) * 100);
}

export const money = (amount: number) =>
  `$${amount.toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
