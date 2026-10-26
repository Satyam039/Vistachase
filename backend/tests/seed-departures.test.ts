// The shuttle's dates are seeded to the end of its coming season (September), not just 60 days.

import { describe, it, expect } from "vitest";
import { daysToSeasonEnd } from "../scripts/seed-departures";

describe("daysToSeasonEnd", () => {
  it("counts to Sep 30 of this year while the season hasn't ended", () => {
    expect(daysToSeasonEnd("2027-06-01", 9)).toBe(121);
    expect(daysToSeasonEnd("2027-09-30", 9)).toBe(0);
  });

  it("counts to next year's Sep 30 once this season is over", () => {
    expect(daysToSeasonEnd("2026-10-26", 9)).toBe(339);
  });
});
