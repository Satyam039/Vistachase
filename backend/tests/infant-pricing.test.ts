import { describe, expect, it } from "vitest";
import { fareSubtotal, seatedGuests, seatsToReserve } from "@/modules/pricing/departure-pricing";
import { priceBooking } from "@/modules/pricing/booking-pricing";

// Owner's doc Pricing (2026-11-04): Adult 16–99, Youth 6–15, Infant 0–5.
const shared = { price: 32000, childPrice: 28000, infantPrice: 17000, capacityTotal: 12, tour: { category: "SHARED" } };
const legacy = { price: 18900, childPrice: 11900, infantPrice: null, capacityTotal: 12, tour: { category: "SHARED" } };
const privateVehicle = { price: 175000, childPrice: null, infantPrice: null, capacityTotal: 14, tour: { category: "PRIVATE" } };

describe("infant fares", () => {
  it("charges adults, youth and infants their own fares where the departure prices infants", () => {
    expect(fareSubtotal(shared, 2, 1, 1)).toBe(2 * 32000 + 28000 + 17000);
    expect(priceBooking(shared, { adults: 2, children: 1, infants: 1 }).totalCents).toBe(2 * 32000 + 28000 + 17000);
  });

  it("gives priced infants a seat", () => {
    expect(seatedGuests(shared, { adults: 2, children: 1, infants: 1 })).toBe(4);
    expect(seatsToReserve(shared, seatedGuests(shared, { adults: 2, infants: 2 }))).toBe(4);
  });

  it("keeps infants free and seatless on departures without an infant price", () => {
    expect(fareSubtotal(legacy, 2, 1, 2)).toBe(2 * 18900 + 11900);
    expect(seatedGuests(legacy, { adults: 2, children: 1, infants: 2 })).toBe(3);
  });

  it("prices a private vehicle once, whoever is in it", () => {
    expect(fareSubtotal(privateVehicle, 3, 2, 1)).toBe(175000);
  });
});
