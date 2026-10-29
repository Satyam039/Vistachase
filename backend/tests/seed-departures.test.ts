// The shuttle's dates are seeded to the end of its coming season (September), not just 60 days.
// Private tours take their summer price from June 1 to October 10.

import { describe, it, expect } from "vitest";
import { daysToSeasonEnd, isSummerSeason } from "../scripts/seed-departures";

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
