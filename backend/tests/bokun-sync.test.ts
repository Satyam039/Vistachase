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

  it("syncs Bókun availability into departures without duplicating them (live provider, stubbed API)", async () => {
    const mapped = PRODUCT_MAP.find((p) => p.slug === "banff-highlights-tour")!;
    const original = mapped.bokunId;
    mapped.bokunId = "TEST-BOKUN-1";
    try {
      const live = new LiveBokunOperationsProvider();
      (live as any).client = {
        getAvailabilities: async () => [{ time: "07:45", capacity: 11 }],
      };
      live.fetchProducts = async () => [
        { id: "TEST-BOKUN-1", slug: mapped.slug, title: "Test", category: "SHARED", durationHours: 10, capacity: 12, basePrice: 199, currency: "CAD" },
      ];

      const first = await live.syncTodaysBookings("2027-03-09");
      expect(first).toEqual({ syncedCount: 1, updatedCount: 0, errors: [] });

      const second = await live.syncTodaysBookings("2027-03-09");
      expect(second).toEqual({ syncedCount: 0, updatedCount: 1, errors: [] });

      const departures = await prisma.tourDeparture.findMany({ where: { date: dateOnly("2027-03-09"), tour: { slug: mapped.slug } } });
      expect(departures).toHaveLength(1);
      expect(departures[0].price).toBe(19900); // $199 from Bókun, stored in cents
      expect(formatTimeOfDay(departures[0].departureTime)).toBe("07:45");
    } finally {
      mapped.bokunId = original;
    }
  });
});
