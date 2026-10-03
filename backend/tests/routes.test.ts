import { describe, it, expect } from "vitest";
import { getTourBySlug } from "@/modules/tours/tour.repository";
import { getShuttleRoutes } from "@/modules/shuttles/shuttle.repository";
import prisma from "@/lib/db/prisma";

describe("Phase 2: URL Preservation & Customer Experience", () => {
  const PRESERVED_SLUGS = [
    "banff-highlights-tour",
    "banff-private-tour",
    "banff-yoho-custom-private-tour",
    "icefields-jasper-private-tour",
    "jasper-custom-private-tour",
    "multi-day-tour-package-for-banff",
  ];

  it("preserves all critical existing Vista Chase tour URLs", async () => {
    for (const slug of PRESERVED_SLUGS) {
      const tour = await getTourBySlug(slug);
      expect(tour, `Tour with slug ${slug} must exist`).not.toBeNull();
      expect(tour?.title.length).toBeGreaterThan(5);
      expect(tour?.basePrice).toBeGreaterThan(0);
      expect(tour?.inclusions.length).toBeGreaterThan(0);
    }
  });

  it("provides shuttle products with guaranteed access details", async () => {
    const shuttles = await getShuttleRoutes();
    expect(shuttles.length).toBeGreaterThanOrEqual(2);
    const sunrise = shuttles.find((s) => s.slug === "moraine-lake-sunrise-shuttle");
    expect(sunrise).toBeDefined();
    expect(sunrise?.description).toContain("Guaranteed sunrise departure");
  });

  it("loads all core Canadian Rockies destinations", async () => {
    const destinations = await prisma.destination.findMany();
    const slugs = destinations.map((d) => d.slug);
    expect(slugs).toContain("banff-national-park");
    expect(slugs).toContain("moraine-lake");
    expect(slugs).toContain("lake-louise");
    expect(slugs).toContain("jasper-national-park");
  });
});
