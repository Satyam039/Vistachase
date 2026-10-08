import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { mapAvailability, syncBokunAvailability, type BokunAvailability, type BokunAvailabilitySource } from "@/modules/bokun/availability-sync";
import { PRODUCT_MAP } from "@/modules/bokun/product-map";
import { dateOnly, formatTimeOfDay } from "@/lib/utils/time";
import { fareSubtotal } from "@/modules/pricing/departure-pricing";

// Shaped like the live responses (shared 1142134: Adults $199 / Child $175; private 1167962:
// "6 PASSENGERS" $999 per booking). Dates are far in the future so other test files never overlap.
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const SHARED_CATEGORIES = [
  { id: 767927, title: "Adults" },
  { id: 773211, title: "Child (1-13)" },
];

function shared(iso: string, over: Partial<BokunAvailability> = {}): BokunAvailability {
  return {
    date: day(iso),
    startTime: "08:00",
    availabilityCount: 10,
    bookedParticipants: 4,
    soldOut: false,
    unavailable: false,
    defaultRateId: 1,
    rates: [{ id: 1, pricedPerPerson: true, maxPerBooking: 14 }],
    pricesByRate: [{ activityRateId: 1, pricePerCategoryUnit: [{ id: 767927, amount: { amount: 199 } }, { id: 773211, amount: { amount: 175 } }] }],
    ...over,
  };
}

function privateTour(iso: string, over: Partial<BokunAvailability> = {}): BokunAvailability {
  return {
    date: day(iso),
    startTime: "09:00",
    availabilityCount: 1,
    bookedParticipants: 0,
    defaultRateId: 6,
    rates: [
      { id: 6, pricedPerPerson: false, maxPerBooking: 6 },
      { id: 12, pricedPerPerson: false, maxPerBooking: 12 },
    ],
    pricesByRate: [
      { activityRateId: 6, pricePerBooking: { amount: 999 } },
      { activityRateId: 12, pricePerBooking: { amount: 1699 } },
    ],
    ...over,
  };
}

/** A stub Bókun: availabilities per Bókun ID, nothing for the others. */
function stub(byId: Record<string, BokunAvailability[]>, calls: string[] = []): BokunAvailabilitySource {
  return {
    getAvailabilities: async (id, start, end) => {
      calls.push(`${id} ${start} ${end}`);
      return byId[id] ?? [];
    },
    getCategories: async () => SHARED_CATEGORIES,
  };
}

const SHARED_ID = PRODUCT_MAP.find((p) => p.slug === "banff-highlights-tour")!.bokunId!;
const PRIVATE_ID = PRODUCT_MAP.find((p) => p.slug === "banff-private-tour")!.bokunId!;
const deps = (slug: string, iso: string) => prisma.tourDeparture.findMany({ where: { tour: { slug }, date: dateOnly(iso) } });

describe("Bókun availability → departures", () => {
  it("maps adult and child prices, seats and status", () => {
    const m = mapAvailability(shared("2031-01-05"), "SHARED", SHARED_CATEGORIES)!;
    expect(m).toMatchObject({ date: "2031-01-05", time: "08:00", priceCents: 19900, childPriceCents: 17500, seatsLeft: 10, bookedInBokun: 4, status: "ACTIVE" });
    expect(mapAvailability(shared("2031-01-05", { soldOut: true }), "SHARED", SHARED_CATEGORIES)!.status).toBe("FULL");
    expect(mapAvailability(shared("2031-01-05", { availabilityCount: 0 }), "SHARED", SHARED_CATEGORIES)!.status).toBe("FULL");
    expect(mapAvailability(shared("2031-01-05", { unavailable: true }), "SHARED", SHARED_CATEGORIES)!.status).toBe("CANCELLED");
    expect(mapAvailability(shared("2031-01-05", { pricesByRate: [] }), "SHARED", SHARED_CATEGORIES)).toBeNull();
  });

  it("prices a private tour per vehicle from the default rate", () => {
    const m = mapAvailability(privateTour("2031-01-05"), "PRIVATE", [])!;
    expect(m).toMatchObject({ priceCents: 99900, childPriceCents: null, vehicleSeats: 6, time: "09:00" });
  });

  it("creates departures once, then updates them, and closes dates Bókun dropped", async () => {
    const from = "2031-02-01";
    const calls: string[] = [];
    const source = stub({ [SHARED_ID]: [shared("2031-02-01"), shared("2031-02-02")], [PRIVATE_ID]: [privateTour("2031-02-01")] }, calls);

    const first = await syncBokunAvailability({ source, from, days: 3 });
    expect(first.errors).toEqual([]);
    expect(first.created).toBe(3);
    expect(calls).toContain(`${SHARED_ID} 2031-02-01 2031-02-03`);

    const [sharedDep] = await deps("banff-highlights-tour", "2031-02-01");
    expect(sharedDep).toMatchObject({ price: 19900, childPrice: 17500, capacityTotal: 14, capacityBooked: 4, status: "ACTIVE" });
    expect(formatTimeOfDay(sharedDep.departureTime)).toBe("08:00");
    // 2 adults + 1 child at Bókun's prices
    expect(fareSubtotal({ ...sharedDep, tour: { category: "SHARED" } } as never, 2, 1)).toBe(2 * 19900 + 17500);

    const [privateDep] = await deps("banff-private-tour", "2031-02-01");
    expect(privateDep).toMatchObject({ price: 99900, capacityTotal: 6, capacityBooked: 0, status: "ACTIVE" });

    // Same data again: nothing new, nothing duplicated.
    const second = await syncBokunAvailability({ source, from, days: 3 });
    expect(second).toMatchObject({ created: 0, updated: 3, closed: 0 });
    expect(await deps("banff-highlights-tour", "2031-02-01")).toHaveLength(1);

    // Bókun sells out the 1st and drops the 2nd.
    const third = await syncBokunAvailability({
      source: stub({ [SHARED_ID]: [shared("2031-02-01", { availabilityCount: 0, bookedParticipants: 14, soldOut: true })], [PRIVATE_ID]: [privateTour("2031-02-01")] }),
      from,
      days: 3,
    });
    expect(third.closed).toBe(1);
    expect((await deps("banff-highlights-tour", "2031-02-01"))[0]).toMatchObject({ status: "FULL", capacityBooked: 14 });
    expect((await deps("banff-highlights-tour", "2031-02-02"))[0].status).toBe("CANCELLED");
  });

  it("keeps seats taken by bookings Bókun doesn't know about yet", async () => {
    const from = "2031-03-01";
    const source = stub({ [SHARED_ID]: [shared(from)], [PRIVATE_ID]: [privateTour(from)] });
    await syncBokunAvailability({ source, from, days: 1 });
    const [sharedDep] = await deps("banff-highlights-tour", from);
    const [privateDep] = await deps("banff-private-tour", from);

    const stamp = Date.now();
    for (const [dep, seats, tag] of [[sharedDep, 3, "S"], [privateDep, 2, "P"]] as const) {
      await prisma.booking.create({
        data: {
          bookingReference: `VC-AVS-${tag}-${stamp}`, customerName: "Guest", customerEmail: "guest@example.com", customerPhone: "+14035550100",
          tourDepartureId: dep.id, adultsCount: seats, childrenCount: 0, infantsCount: 0, totalSeats: seats,
          subtotal: 10000, tax: 0, totalAmount: 10000, currency: "CAD", status: "PAID_UNSYNCED", voucherCode: `VOUCH-AVS-${tag}-${stamp}`,
        },
      });
    }

    await syncBokunAvailability({ source, from, days: 1 });
    expect((await deps("banff-highlights-tour", from))[0].capacityBooked).toBe(4 + 3);
    expect((await deps("banff-private-tour", from))[0].capacityBooked).toBe(6); // the vehicle is taken

    // A booked departure stays open even when Bókun stops listing it.
    const result = await syncBokunAvailability({ source: stub({}), from, days: 1 });
    expect(result.closed).toBe(0);
    expect((await deps("banff-highlights-tour", from))[0].status).toBe("ACTIVE");
  });

  it("reports a failing product and carries on with the rest", async () => {
    const source: BokunAvailabilitySource = {
      getAvailabilities: async (id) => {
        if (id === SHARED_ID) throw new Error("Bókun 500");
        return id === PRIVATE_ID ? [privateTour("2031-04-01")] : [];
      },
      getCategories: async () => [],
    };
    const result = await syncBokunAvailability({ source, from: "2031-04-01", days: 1 });
    expect(result.errors).toEqual(["banff-highlights-tour: Bókun 500"]);
    expect(await deps("banff-private-tour", "2031-04-01")).toHaveLength(1);
  });
});
