import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { getBokunOperationsProvider } from "@/modules/bokun/bokun.provider";
import { PRODUCT_MAP, bokunReadiness, slugForBokunId } from "@/modules/bokun/product-map";

describe("Bókun Operations & Integration Layer", () => {
  it("lists the 13 live products from the mapping table, with pending Bokun IDs until provided", async () => {
    const provider = getBokunOperationsProvider();
    const products = await provider.fetchProducts();

    expect(products.length).toBe(13);
    for (const mapped of PRODUCT_MAP) {
      const product = products.find((p) => p.slug === mapped.slug);
      expect(product, mapped.slug).toBeDefined();
      expect(product?.id).toBe(mapped.bokunId ?? `pending:${mapped.slug}`);
      expect(slugForBokunId(product!.id)).toBe(mapped.slug);
      expect(product?.basePrice, mapped.slug).toBeGreaterThan(0);
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

  it("synchronizes incoming Bókun bookings and prevents duplicate records (Idempotency)", async () => {
    const provider = getBokunOperationsProvider();
    const uniqueSuffix = Date.now().toString().slice(-4);
    const testDate = `2026-11-${uniqueSuffix}`;

    // 1. Initial sync
    const firstSync = await provider.syncTodaysBookings(testDate);
    expect(firstSync.errors.length).toBe(0);
    expect(firstSync.syncedCount).toBeGreaterThan(0);

    // 2. Second sync for same date should update, not create duplicate bookings
    const secondSync = await provider.syncTodaysBookings(testDate);
    expect(secondSync.errors.length).toBe(0);
    expect(secondSync.syncedCount).toBe(0); // No new duplicates
    expect(secondSync.updatedCount).toBe(firstSync.syncedCount);

    // Verify sync log was recorded
    const log = await prisma.bokunSyncLog.findFirst({
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.status).toBe("SUCCESS");
  });
});
