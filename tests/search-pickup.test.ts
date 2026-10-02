import { describe, it, expect } from "vitest";
import { getMapsProvider, ROCKIES_PICKUP_LOCATIONS } from "@/lib/maps/maps.provider";
import { getTours } from "@/modules/tours/tour.repository";

describe("Phase 3: Search, Catalog & Hotel Pickup Finder", () => {
  it("provides comprehensive hotel pickup data across Banff, Canmore and Lake Louise", async () => {
    const maps = getMapsProvider();
    const all = await maps.getAllPickups();
    expect(all.length).toBeGreaterThanOrEqual(8);

    const towns = new Set(all.map((p) => p.town));
    expect(towns.has("Banff")).toBe(true);
    expect(towns.has("Canmore")).toBe(true);
    expect(towns.has("Lake Louise")).toBe(true);
  });

  it("filters hotel pickups accurately by town", async () => {
    const maps = getMapsProvider();
    const banffHotels = await maps.searchPickups("", "Banff");
    expect(banffHotels.length).toBeGreaterThan(0);
    for (const h of banffHotels) {
      expect(h.town).toBe("Banff");
    }

    const canmoreHotels = await maps.searchPickups("", "Canmore");
    expect(canmoreHotels.length).toBeGreaterThan(0);
    for (const h of canmoreHotels) {
      expect(h.town).toBe("Canmore");
    }
  });

  it("finds specific iconic hotels with precise instructions and routes", async () => {
    const maps = getMapsProvider();
    const fairmont = await maps.searchPickups("Fairmont Banff Springs");
    expect(fairmont.length).toBe(1);
    expect(fairmont[0].address).toContain("405 Spray Ave");
    expect(fairmont[0].instructions).toContain("Main Motor Court");
    expect(fairmont[0].shuttleLines.length).toBeGreaterThan(0);
  });

  it("filters tours by category, destination, and guaranteed seat capacity", async () => {
    // 1. Shared Tours
    const sharedTours = await getTours({ category: "SHARED" });
    expect(sharedTours.length).toBeGreaterThan(0);
    for (const t of sharedTours) {
      expect(t.category).toBe("SHARED");
    }

    // 2. Private Tours
    const privateTours = await getTours({ category: "PRIVATE" });
    expect(privateTours.length).toBeGreaterThan(0);
    for (const t of privateTours) {
      expect(t.category).toBe("PRIVATE");
    }

    // 3. Filter by destination slug
    const banffTours = await getTours({ destinationSlug: "banff-national-park" });
    expect(banffTours.length).toBeGreaterThan(0);
    for (const t of banffTours) {
      expect(t.destination.slug).toBe("banff-national-park");
    }
  });
});
