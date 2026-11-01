/** A time zone's offset from UTC at an instant, in milliseconds (America/Edmonton: -6h or -7h). */
function zoneOffsetMs(at: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value]),
  );
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return wall - Math.floor(at / 1000) * 1000;
}

/**
 * The real instant of a stored Mountain Time departure (date + time of day).
 * The offset is read at the departure's own instant, so the days the clocks change are right too
 * (reading it at the wall-clock time taken as UTC put early-morning departures an hour off then).
 */
export function getMountainTimeInstant(dateObj: Date, timeObj: Date | null): Date {
  const dateStr = dateObj.toISOString().split("T")[0];
  const timeStr = timeObj ? timeObj.toISOString().split("T")[1].slice(0, 5) : "08:00";
  return wallClockInstant(dateStr, timeStr, "America/Edmonton");
}

/** The instant a "YYYY-MM-DD" "HH:MM" wall clock in a time zone stands for. */
export function wallClockInstant(date: string, time: string, timeZone: string): Date {
  const wallAsUtc = new Date(`${date}T${time}:00.000Z`).getTime();
  // Guess with the offset near that time, then correct with the offset at the guessed instant.
  const guess = wallAsUtc - zoneOffsetMs(wallAsUtc, timeZone);
  return new Date(wallAsUtc - zoneOffsetMs(guess, timeZone));
}

// Departure dates and times are stored as wall-clock values in Mountain Time: the date as UTC
// midnight of that calendar day, the time of day on 1970-01-01 in UTC. getMountainTimeInstant()
// turns the pair into the real instant. The API exchanges them as "YYYY-MM-DD" and "HH:MM".

/** "2026-10-08" → the stored date value. */
export function dateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Expected YYYY-MM-DD, got "${value}"`);
  return new Date(`${value}T00:00:00.000Z`);
}

/** "08:30" → the stored time-of-day value. */
export function timeOfDay(value: string): Date {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error(`Expected HH:MM, got "${value}"`);
  return new Date(`1970-01-01T${value}:00.000Z`);
}

/** Stored date value → "2026-10-08". */
export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Stored time-of-day value → "08:30". */
export function formatTimeOfDay(value: Date): string;
export function formatTimeOfDay(value: Date | null | undefined): string | null;
export function formatTimeOfDay(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(11, 16) : null;
}

/** Today's date in Banff (America/Edmonton) as "YYYY-MM-DD"; the operating day for dispatch and messages. */
export function todayInMountainTime(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * Express "json replacer": every API response sends departure dates and times in the shape the
 * frontend expects ("2026-10-08", "08:30"), even where a route returns database rows directly.
 * Matches only the stored conventions above on the fields that use them.
 */
export function apiJsonReplacer(key: string, value: unknown): unknown {
  if (typeof value !== "string") return value;
  // pickupTime falls back to the departure time (a stored time of day) when a booking has none.
  if ((key === "departureTime" || key === "returnTime" || key === "pickupTime") && /^1970-01-01T\d{2}:\d{2}:00\.000Z$/.test(value)) {
    return value.slice(11, 16);
  }
  if (key === "date" && /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value)) {
    return value.slice(0, 10);
  }
  return value;
}
