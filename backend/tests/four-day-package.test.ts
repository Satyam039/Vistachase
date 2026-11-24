// Four-Day Rockies & Jasper rules (owner's Trello card, 2026-11-24): consecutive Jasper dates, up to
// 14 guests in the van, and the cancellation deadline running from an earlier arrival transfer.

import { describe, it, expect } from "vitest";
import { findPackage, packageDateRuleError } from "@/modules/bookings/package-booking";
import { arrivalPickupInstant } from "@/modules/bookings/cancellation-policy";
import { partySizeError } from "@/modules/pricing/departure-pricing";

const four = findPackage("four-day-rockies-and-jasper")!;

describe("four-day date rules", () => {
  it("Jasper Highlights & Return must be the day after Icefields Parkway to Jasper", () => {
    expect(packageDateRuleError(four, ["2027-07-20", "2027-07-01", "2027-07-10", "2027-07-11"])).toBeNull();
    expect(packageDateRuleError(four, ["2027-07-01", "2027-07-02", "2027-07-10", "2027-07-12"])).toContain("must be the day after");
    // Across a month end.
    expect(packageDateRuleError(four, ["2027-07-01", "2027-07-02", "2027-07-31", "2027-08-01"])).toBeNull();
  });

  it("all four dates must differ", () => {
    expect(packageDateRuleError(four, ["2027-07-10", "2027-07-02", "2027-07-10", "2027-07-11"])).toContain("different date");
  });
});

describe("four-day group size", () => {
  const van = { capacityTotal: 13, price: 175000, childPrice: null, infantPrice: null, tour: { category: "PRIVATE" } } as never;
  it("takes 14 guests in a 13-seat private departure only when the package allows it", () => {
    expect(partySizeError(van, 14)).toContain("13");
    expect(partySizeError(van, 14, 14)).toBeNull();
    expect(partySizeError(van, 15, 14)).toContain("14");
  });
});

describe("four-day cancellation deadline", () => {
  it("reads an arrival transfer's pickup in Alberta time, ignoring departure-only transfers", () => {
    expect(arrivalPickupInstant({ airportTransfer: { type: "ARRIVAL", arrivalDate: "2027-07-01", arrivalTime: "14:30" } })?.toISOString()).toBe("2027-07-01T20:30:00.000Z");
    expect(arrivalPickupInstant({ airportTransfer: { type: "ROUND_TRIP", arrivalDate: "2027-07-01", arrivalTime: "09:00" } })).not.toBeNull();
    expect(arrivalPickupInstant({ airportTransfer: { type: "DEPARTURE", departureDate: "2027-07-09", departureTime: "18:00" } })).toBeNull();
    expect(arrivalPickupInstant({})).toBeNull();
  });
});
