// Cancellation policy wording, from the vistachase.com legal terms (owner decision: the 72-hour
// legal policy applies site-wide). Tickets follow the attraction operator's rules.

export const CANCELLATION_SHORT = "Free cancellation up to 72 hours before";
export const TICKET_CANCELLATION_SHORT = "Cancellation follows the operator's rules";

/** Multi-day journeys keep the 20% deposit (full terms on the tour page and /cancellation-policy). */
export const MULTIDAY_CANCELLATION_SHORT = "Refundable up to 72 hours before, less the 20% deposit";

export const cancellationShort = (category?: string) =>
  category === "TICKET" ? TICKET_CANCELLATION_SHORT : category === "MULTIDAY" ? MULTIDAY_CANCELLATION_SHORT : CANCELLATION_SHORT;

export const CANCEL_WINDOW_HOURS = 72;
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

/** Free cancellation is open until 72 hours before departure. */
export const canCancelFree = (date: string, time?: string, now = new Date()) =>
  departureInstant(date, time).getTime() - now.getTime() >= CANCEL_WINDOW_HOURS * 3600_000;

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

export const DEPOSIT_POLICY = `The ${DEPOSIT_PERCENT}% deposit is non-refundable. Cancel up to 72 hours before departure and everything else you've paid is refunded.`;
