// The shuttle's dates are seeded to the end of its coming season (September), not just 60 days.
// Private tours take their summer price from June 1 to October 10.

import { describe, it, expect } from "vitest";
import { DEFAULT_SCHEDULES, WINTER_MONTHS, daysToSeasonEnd, fareFor, isSummerSeason, winterRealignment } from "../scripts/seed-departures";

describe("daysToSeasonEnd", () => {
  it("counts to Sep 30 of this year while the season hasn't ended", () => {
    expect(daysToSeasonEnd("2027-06-01", 9)).toBe(121);
    expect(daysToSeasonEnd("2027-09-30", 9)).toBe(0);
  });

  it("counts to next year's Sep 30 once this season is over", () => {
    expect(daysToSeasonEnd("2026-10-26", 9)).toBe(339);
  });
});

describe("isSummerSeason", () => {
  it("is June 1 to October 10 inclusive", () => {
    expect(isSummerSeason("2027-05-31")).toBe(false);
    expect(isSummerSeason("2027-06-01")).toBe(true);
    expect(isSummerSeason("2027-10-10")).toBe(true);
    expect(isSummerSeason("2027-10-11")).toBe(false);
    expect(isSummerSeason("2027-01-15")).toBe(false);
  });
});

describe("fareFor (owner's doc Pricing, 2026-11-04)", () => {
  const schedule = (slug: string) => DEFAULT_SCHEDULES.find((s) => s.slug === slug)!;

  it("prices Columbia Icefield Adventure by season, with youth and infant fares", () => {
    const icefield = schedule("shared-tours-icefields-jasper");
    expect(fareFor(icefield, "07:30", "2027-07-01")).toEqual({ price: 32000, childPrice: 28000, infantPrice: 17000 });
    expect(fareFor(icefield, "07:30", "2027-01-15")).toEqual({ price: 22000, childPrice: 22000, infantPrice: 17000 });
  });

  it("prices private vehicles 1,750 in summer and 1,240 in winter", () => {
    expect(fareFor(schedule("banff-private-tour"), "08:00", "2027-07-01").price).toBe(175000);
    expect(fareFor(schedule("icefields-jasper-private-tour"), "08:00", "2027-11-01").price).toBe(124000);
  });

  it("prices each shuttle departure on its own, the same for every age", () => {
    const fullDay = schedule("full-day-at-lake-louise-and-moraine-lake");
    const sunrise = schedule("sunrise-shuttle-to-moraine-lake-and-lake-louise");
    const at = (item: typeof fullDay, time: string) => fareFor(item, item.times.find((t) => typeof t !== "string" && t.time === time)!, "2027-07-01");
    expect(at(sunrise, "03:15")).toEqual({ price: 13000, childPrice: 13000, infantPrice: 13000 });
    expect(at(fullDay, "06:30").price).toBe(12000);
    expect(at(fullDay, "10:15").price).toBe(12000);
    expect(at(fullDay, "11:30").price).toBe(10800);
    expect(at(fullDay, "16:45").price).toBe(10800);
  });
});

describe("winter tours (owner, 2026-11-11: bookable again)", () => {
  const schedule = (slug: string) => DEFAULT_SCHEDULES.find((s) => s.slug === slug)!;
  const dep = (date: string, price: number, childPrice: number | null, capacityTotal: number, status = "ACTIVE") => ({ date, price, childPrice, infantPrice: null, capacityTotal, status });

  it("run December to April only, at the prices on their pages", () => {
    const shared = schedule("winter-special");
    const priv = schedule("winter-signature-private-tour");
    expect(WINTER_MONTHS).toEqual([12, 1, 2, 3, 4]);
    expect(fareFor(shared, shared.times[0], "2027-01-15")).toEqual({ price: 19900, childPrice: 19900, infantPrice: null });
    expect(fareFor(priv, priv.times[0], "2027-01-15").price).toBe(99900);
    expect(priv.capacity).toBe(6);
  });

  it("puts old unbooked dates right: off sale outside the season, new fare inside it", () => {
    const shared = schedule("winter-special");
    expect(winterRealignment(shared, dep("2026-11-20", 16900, 9900, 12))).toEqual({ status: "CANCELLED" });
    expect(winterRealignment(shared, dep("2026-12-20", 16900, 9900, 12))).toEqual({ price: 19900, childPrice: 19900, infantPrice: null, capacityTotal: 12 });
    expect(winterRealignment(shared, dep("2026-12-21", 19900, 19900, 12))).toBeNull();
    expect(winterRealignment(shared, dep("2026-11-21", 16900, 9900, 12, "CANCELLED"))).toBeNull();
  });
});
