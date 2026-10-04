import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { getBokunOperationsProvider, BOKUN_CATALOG_PRODUCTS } from "@/modules/bokun/bokun.provider";

describe("Bókun Operations & Integration Layer", () => {
  it("maintains authoritative mapping for all 13 Bókun catalog products from Roadmap", async () => {
    const provider = getBokunOperationsProvider();
    const products = await provider.fetchProducts();

    expect(products.length).toBe(13);

    // Verify key Bókun IDs from Roadmap p.4
    const banffHighlights = products.find((p) => p.id === "1142134");
    expect(banffHighlights).toBeDefined();
    expect(banffHighlights?.title).toContain("Banff Highlights");
    expect(banffHighlights?.category).toBe("SHARED");

    const banffPrivate = products.find((p) => p.id === "1167962");
    expect(banffPrivate).toBeDefined();
    expect(banffPrivate?.category).toBe("PRIVATE");

    const sunriseShuttle = products.find((p) => p.id === "928996");
    expect(sunriseShuttle).toBeDefined();
    expect(sunriseShuttle?.category).toBe("SHUTTLE");
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
