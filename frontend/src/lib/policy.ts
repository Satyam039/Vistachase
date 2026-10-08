// Cancellation policy wording, from the vistachase.com legal terms (owner decision: the 72-hour
// legal policy applies site-wide). Tickets follow the attraction operator's rules.

export const CANCELLATION_SHORT = "Free cancellation up to 72 hours before";
export const TICKET_CANCELLATION_SHORT = "Cancellation follows the operator's rules";

export const cancellationShort = (category?: string) => (category === "TICKET" ? TICKET_CANCELLATION_SHORT : CANCELLATION_SHORT);

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
