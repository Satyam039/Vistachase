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
    "shared-tours-heart-of-banff",
    "shared-tours-banff-yoho",
    "shared-tours-icefields-jasper",
    "winter-special",
    "winter-signature-private-tour",
    "sunrise-shuttle-to-moraine-lake-and-lake-louise",
    "full-day-at-lake-louise-and-moraine-lake",
  ];

  it("preserves every live vistachase.com product URL with its page content", async () => {
    for (const slug of PRESERVED_SLUGS) {
      const tour = await getTourBySlug(slug);
      expect(tour, `Tour with slug ${slug} must exist`).not.toBeNull();
      expect(tour?.title.length).toBeGreaterThan(5);
      expect(tour?.basePrice).toBeGreaterThan(0);
      expect(tour?.metaTitle, `${slug} meta title`).toBeTruthy();
      expect(tour?.facts.length, `${slug} facts`).toBeGreaterThan(0);
      expect(tour?.tabs.length, `${slug} tabs`).toBeGreaterThanOrEqual(3);
      expect(tour?.faqs.length, `${slug} FAQs`).toBeGreaterThan(0);
      expect(tour?.featuredImage).toMatch(/^https:\/\//);
    }
  });

  it("sells private tours and the multi-day package per group, everything else per guest", async () => {
    for (const slug of PRESERVED_SLUGS) {
      const tour = await getTourBySlug(slug);
      const perGroup = tour?.category === "PRIVATE" || tour?.category === "MULTIDAY";
      expect(tour?.priceUnit, slug).toBe(perGroup ? "GROUP" : "PERSON");
      expect(tour?.vehicleOptions.length, slug).toBe(perGroup ? 2 : 0);
    }
  });

  it("marks products without a Bokun experience as enquiry-only", async () => {
    for (const slug of PRESERVED_SLUGS) {
      const tour = await getTourBySlug(slug);
      expect(tour?.bookingMode, slug).toBe(tour?.bokunExperienceId ? "BOKUN" : "ENQUIRY");
    }
    expect((await getTourBySlug("multi-day-tour-package-for-banff"))?.bookingMode).toBe("ENQUIRY");
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
