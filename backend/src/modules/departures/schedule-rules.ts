// One start time per day tour (owner, 2026-11-12): Banff & Yoho Discovery and Columbia Icefield
// Adventure, shared and private, leave at 8:00 AM only. Any other time on these tours (old 7:00,
// 7:30 and 8:30 dates) is never listed, held or booked, and the Bókun seat sync never puts one back
// on sale. Departures at another time that nobody has booked are cancelled by
// scripts/seed-departures.ts (retireOffScheduleDepartures); ones with a booking stay for that guest.

import { formatTimeOfDay } from "@/lib/utils/time";

export const FIXED_START_TIMES: Record<string, string> = {
  "banff-highlights-tour": "08:00",
  "shared-tours-icefields-jasper": "08:00",
  "banff-private-tour": "08:00",
  "icefields-jasper-private-tour": "08:00",
};

// The rule in force. Test suites build departures at many times on these tours, so under vitest it
// starts empty and the tests that cover it switch it on (setFixedStartTimesForTests).
let active: Record<string, string> = process.env.VITEST ? {} : FIXED_START_TIMES;

export function setFixedStartTimesForTests(times: Record<string, string> | null) {
  active = times ?? {};
}

const hhmm = (time: string | Date) => (typeof time === "string" ? time.slice(0, 5) : formatTimeOfDay(time));

/** False when the tour has one fixed start time and this departure isn't at it. */
export function isScheduledStartTime(slug: string | null | undefined, time: string | Date): boolean {
  const fixed = slug ? active[slug] : undefined;
  return !fixed || hhmm(time) === fixed;
}

/** The guest-facing refusal for a departure at a time the tour no longer runs, or null. */
export function startTimeError(slug: string | null | undefined, time: string | Date): string | null {
  if (isScheduledStartTime(slug, time)) return null;
  const fixed = active[slug!];
  const [h, m] = fixed.split(":").map(Number);
  return `This tour departs at ${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"} only. Please choose that departure.`;
}

/**
 * Seats per Moraine Lake & Lake Louise shuttle departure (owner, 2026-11-12). The seed sets it, and
 * the Bókun seat sync never lists more, whatever Bókun's own capacity is.
 */
export const SHUTTLE_CAPACITY = 14;

/** Guests per private day-tour vehicle (Banff & Yoho and Columbia Icefield private): "up to 13". */
export const PRIVATE_VEHICLE_CAPACITY = 13;
