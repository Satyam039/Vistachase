// Booking & Cancellation Policy (owner's document, October 28, 2026; full text at
// /privacy-policy-vista-chase). backend/src/modules/bookings/cancellation-policy.ts holds the same
// rules and decides refunds:
//   shared tours and shuttles: full refund up to 24 hours before departure
//   private single-day tours: full refund up to 72 hours before departure
//   private packages of two or more days: 80% refund up to 72 hours before the first day
// Tickets follow the attraction operator's rules.

export const POLICY_URL = "/privacy-policy-vista-chase";

export interface CancellationTerms {
  cutoffHours: number;
  /** Share of the total price kept on an eligible cancellation. */
  keepPercent: number;
}

/** The rules for a product category; `multiDay` marks a private booking that is one day of a package. */
export function cancellationTerms(category?: string | null, multiDay = false): CancellationTerms {
  if (category === "SHARED" || category === "SHUTTLE") return { cutoffHours: 24, keepPercent: 0 };
  if (category === "MULTIDAY" || (category === "PRIVATE" && multiDay)) return { cutoffHours: 72, keepPercent: 20 };
  return { cutoffHours: 72, keepPercent: 0 };
}

export const TICKET_CANCELLATION_SHORT = "Cancellation follows the operator's rules";

/** One short line, e.g. "Free cancellation up to 24 hours before". */
export function cancellationShort(category?: string | null, multiDay = false) {
  if (category === "TICKET") return TICKET_CANCELLATION_SHORT;
  const t = cancellationTerms(category, multiDay);
  return t.keepPercent > 0
    ? `${100 - t.keepPercent}% refund up to ${t.cutoffHours} hours before the first day`
    : `Free cancellation up to ${t.cutoffHours} hours before`;
}

/** Compact card label, e.g. "Free cancellation 24h". */
export function cancellationBadge(category?: string | null) {
  if (category === "TICKET") return "Operator's cancellation rules";
  const t = cancellationTerms(category);
  return t.keepPercent > 0 ? `${100 - t.keepPercent}% refund up to ${t.cutoffHours}h` : `Free cancellation ${t.cutoffHours}h`;
}

/** The full rule as a sentence, for tour pages, vouchers and My trips. */
export function cancellationSentence(category?: string | null, multiDay = false) {
  if (category === "TICKET") return "Tickets follow the attraction operator's cancellation rules, shown before you book.";
  const t = cancellationTerms(category, multiDay);
  return t.keepPercent > 0
    ? `Cancel at least ${t.cutoffHours} hours before the first tour day for an 80% refund; ${t.keepPercent}% of the total package price is non-refundable. No refund after that, or for a no-show.`
    : `Cancel at least ${t.cutoffHours} hours before departure for a full refund. No refund after that, or for a no-show.`;
}

const ROCKIES_TZ = "America/Edmonton";

/** A departure's real moment in time: dates and times are Mountain Time, whatever the device's zone. */
export function departureInstant(date: string, time = "08:00"): Date {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const [hh, mm] = (time || "08:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Offset of Mountain Time at that moment (handles daylight saving).
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: ROCKIES_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(guess))
    .reduce<Record<string, number>>((acc, p) => (p.type !== "literal" ? { ...acc, [p.type]: Number(p.value) } : acc), {});
  const asMountain = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return new Date(guess - (asMountain - guess));
}

/** Is the refund deadline for this booking still open? (Package days: pass Day 1's date and time.) */
export const canCancelFree = (date: string, time?: string, category?: string | null, now = new Date()) =>
  departureInstant(date, time).getTime() - now.getTime() >= cancellationTerms(category).cutoffHours * 3600_000;

/** Customer-facing availability line for a bookable departure (premium brief, item 7). Shown only when
 * the backend reports seats open; never a count. Full departures keep their factual "Sold out". */
export const SEATS_MESSAGE = "Seats get sold out fast";

// Deposit payments (backend modules/bookings/deposit.ts holds the same numbers and decides).
export const DEPOSIT_PERCENT = 20;
export const DEPOSIT_MIN_DAYS = 15;
export const BALANCE_DUE_DAYS = 14;

/** A deposit can be chosen when the departure is at least 15 days away. */
export const depositAvailable = (date: string, time?: string, now = new Date()) =>
  departureInstant(date, time).getTime() - now.getTime() >= DEPOSIT_MIN_DAYS * 86_400_000;

/** When the balance is due: 14 days before departure. */
export const balanceDueDate = (date: string, time?: string) => new Date(departureInstant(date, time).getTime() - BALANCE_DUE_DAYS * 86_400_000);

/** The deposit in dollars, rounded to the cent the way the server rounds it. */
export const depositFor = (total: number) => Math.round((Math.round(total * 100) * DEPOSIT_PERCENT) / 100) / 100;

/** "Fri, Mar 13, 2026" in Banff time. */
export const formatRockiesDate = (at: Date | string) =>
  new Date(at).toLocaleDateString("en-CA", { timeZone: ROCKIES_TZ, weekday: "short", month: "short", day: "numeric", year: "numeric" });

/** A deposit doesn't change the cancellation rules (policy section 11). */
export const depositPolicy = (category?: string | null, multiDay = false) =>
  `Paying a ${DEPOSIT_PERCENT}% deposit doesn't change the cancellation rules: ${cancellationSentence(category, multiDay).replace(/^C/, "c")}`;
