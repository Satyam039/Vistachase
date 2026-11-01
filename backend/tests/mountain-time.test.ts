// Departure instants on the days clocks change. getMountainTimeInstant used to read the UTC
// offset at the wall-clock time taken as UTC, which put departures in the early hours after a
// change an hour off (CI failed on 2026-11-01 when its tz data still had Alberta fall back).
// Newer tz data keeps Alberta on UTC-6 all year, so the clock-change cases use America/Denver,
// which follows the same rules Alberta used to.

import { describe, expect, it } from "vitest";
import { dateOnly, getMountainTimeInstant, timeOfDay, wallClockInstant } from "@/lib/utils/time";

const wallClock = (instant: Date, timeZone: string) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};

describe("wallClockInstant", () => {
  it("is right in the early hours of the days the clocks change", () => {
    const denver = (date: string, time: string) => wallClockInstant(date, time, "America/Denver").toISOString();
    expect(denver("2026-11-01", "03:05")).toBe("2026-11-01T10:05:00.000Z"); // after fall back (MST)
    expect(denver("2026-11-01", "00:30")).toBe("2026-11-01T06:30:00.000Z"); // before fall back (MDT)
    expect(denver("2026-03-08", "03:30")).toBe("2026-03-08T09:30:00.000Z"); // after spring forward (MDT)
    expect(denver("2026-03-08", "01:30")).toBe("2026-03-08T08:30:00.000Z"); // before spring forward (MST)
    expect(denver("2026-07-15", "08:30")).toBe("2026-07-15T14:30:00.000Z");
    expect(denver("2026-12-15", "08:30")).toBe("2026-12-15T15:30:00.000Z");
  });

  it("round-trips every quarter hour around the change days in Banff time", () => {
    for (const start of ["2026-10-31T00:00:00Z", "2026-03-07T00:00:00Z"]) {
      for (let i = 0; i < 4 * 72; i++) {
        const instant = new Date(Date.parse(start) + i * 15 * 60_000);
        const { date, time } = wallClock(instant, "America/Edmonton");
        const back = getMountainTimeInstant(dateOnly(date), timeOfDay(time));
        expect(wallClock(back, "America/Edmonton")).toEqual({ date, time });
      }
    }
  });

  it("defaults to 08:00 without a time", () => {
    const at = getMountainTimeInstant(dateOnly("2026-07-15"), null);
    expect(wallClock(at, "America/Edmonton")).toEqual({ date: "2026-07-15", time: "08:00" });
  });
});
