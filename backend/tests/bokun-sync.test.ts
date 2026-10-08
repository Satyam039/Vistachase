import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { getBokunOperationsProvider, LiveBokunOperationsProvider } from "@/modules/bokun/bokun.provider";
import { dateOnly, formatTimeOfDay } from "@/lib/utils/time";
import { PRODUCT_MAP, bokunReadiness, slugForBokunId } from "@/modules/bokun/product-map";

describe("Bókun Operations & Integration Layer", () => {
  it("lists every mapped product (13 live + 4 tickets), with pending Bokun IDs until provided", async () => {
    const provider = getBokunOperationsProvider();
    const products = await provider.fetchProducts();

    expect(products.length).toBe(PRODUCT_MAP.length);
    for (const mapped of PRODUCT_MAP) {
      const product = products.find((p) => p.slug === mapped.slug);
      expect(product, mapped.slug).toBeDefined();
      expect(product?.id).toBe(mapped.bokunId ?? `pending:${mapped.slug}`);
      expect(slugForBokunId(product!.id)).toBe(mapped.slug);
      if (mapped.category !== "TICKET") expect(product?.basePrice, mapped.slug).toBeGreaterThan(0);
    }

    const sunriseShuttle = products.find((p) => p.slug === "sunrise-shuttle-to-moraine-lake-and-lake-louise");
    expect(sunriseShuttle?.category).toBe("SHUTTLE");
    expect(sunriseShuttle?.basePrice).toBe(125);
  });

  it("reports what is missing before the site can call Bokun", () => {
    const readiness = bokunReadiness();
    const bokunProducts = PRODUCT_MAP.filter((p) => p.bookingMode === "BOKUN");
    expect(readiness.productIdsMissing.length).toBe(bokunProducts.filter((p) => !p.bokunId).length);
    if (readiness.productIdsMissing.length > 0) expect(readiness.ready).toBe(false);
  });

  it("never invents bookings or departures while Bókun isn't connected (mock provider)", async () => {
    const before = await prisma.tourDeparture.count();
    const result = await getBokunOperationsProvider().syncTodaysBookings("2026-11-20");
    expect(result).toEqual({ syncedCount: 0, updatedCount: 0, errors: [] });
    expect(await prisma.tourDeparture.count()).toBe(before);
  });

  it("syncs one day of Bókun availability into departures without duplicating them (live provider, stubbed API)", async () => {
    const mapped = PRODUCT_MAP.find((p) => p.slug === "banff-highlights-tour")!;
    const live = new LiveBokunOperationsProvider();
    (live as any).client = {
      getAvailabilities: async (id: string) =>
        id === mapped.bokunId
          ? [{ date: Date.parse("2027-03-09T00:00:00Z"), startTime: "07:45", availabilityCount: 11, bookedParticipants: 0, defaultRateId: 1, rates: [{ id: 1 }], pricesByRate: [{ activityRateId: 1, pricePerCategoryUnit: [{ id: 1, amount: { amount: 199 } }] }] }]
          : [],
      fetch: async () => ({ pricingCategories: [{ id: 1, title: "Adults" }] }),
    };

    const first = await live.syncTodaysBookings("2027-03-09");
    expect(first).toEqual({ syncedCount: 1, updatedCount: 0, errors: [] });

    const second = await live.syncTodaysBookings("2027-03-09");
    expect(second).toEqual({ syncedCount: 0, updatedCount: 1, errors: [] });

    const departures = await prisma.tourDeparture.findMany({ where: { date: dateOnly("2027-03-09"), tour: { slug: mapped.slug } } });
    expect(departures).toHaveLength(1);
    expect(departures[0].price).toBe(19900); // $199 from Bókun, stored in cents
    expect(formatTimeOfDay(departures[0].departureTime)).toBe("07:45");
  });
});
