import { describe, expect, it } from "vitest";
import { fareSubtotal, seatedGuests } from "@/modules/pricing/departure-pricing";
import { priceBooking } from "@/modules/pricing/booking-pricing";
import { activitiesNote, unavailableActivities } from "@/modules/bookings/activity-addons";

describe("optional activities", () => {
  it("are offered only on tours that visit them", () => {
    expect(unavailableActivities("banff-highlights-tour", ["minnewankaCruise"])).toEqual([]);
    expect(unavailableActivities("banff-highlights-tour", ["skywalk"])).toEqual(["skywalk"]);
    expect(unavailableActivities(undefined, ["iceExplorer"])).toEqual(["iceExplorer"]);
  });

  it("tell staff who is coming, by age band", () => {
    expect(activitiesNote(["iceExplorer", "skywalk", "skywalk"], { adults: 2, youth: 1, infants: 0 })).toBe(
      "Optional activities requested: Columbia Icefield Ice Explorer, Columbia Icefield Skywalk for 2 adults (16+), 1 youth (6-15) (price varies; Vista Chase confirms it and books the tickets).",
    );
  });
});

// Owner's doc pricing table (2026-11-04): adult 16-99, youth 6-15, infant 0-5. A departure with an
// infant fare charges infants and gives them a seat; without one, infants ride free on a lap.
const shared = { price: 32000, childPrice: 28000, infantPrice: 17000, capacityTotal: 12, tour: { category: "SHARED" } };
const shuttle = { price: 13000, childPrice: null, infantPrice: null, capacityTotal: 14, tour: { category: "SHUTTLE" } };
const privateVehicle = { price: 175000, childPrice: null, infantPrice: 17000, capacityTotal: 14, tour: { category: "PRIVATE" } };

describe("infant fares", () => {
  it("charges adults, youth and infants their own fares on a shared tour", () => {
    expect(fareSubtotal(shared, 2, 1, 1)).toBe(2 * 32000 + 28000 + 17000);
    expect(seatedGuests(shared, 2, 1, 1)).toBe(4);
  });

  it("keeps infants free and seatless without an infant fare", () => {
    expect(fareSubtotal(shuttle, 2, 1, 2)).toBe(3 * 13000);
    expect(seatedGuests(shuttle, 2, 1, 2)).toBe(3);
  });

  it("never charges per guest on a private vehicle", () => {
    expect(fareSubtotal(privateVehicle, 2, 0, 1)).toBe(175000);
    expect(seatedGuests(privateVehicle, 2, 0, 1)).toBe(2);
  });

  it("counts paying infants for per-guest add-ons and applies the package discount", () => {
    const totals = priceBooking(shared, { adults: 1, children: 0, infants: 1 }, [{ id: "lunch" }], null, 10);
    expect(totals.fareCents).toBe(32000 + 17000);
    expect(totals.discountCents).toBe(4900);
    expect(totals.addOns).toEqual([{ name: "Gourmet Rockies Packed Lunch", priceCents: 2200, quantity: 2 }]);
  });
});
