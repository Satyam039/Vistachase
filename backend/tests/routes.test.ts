import { describe, it, expect } from "vitest";
import { getTourBySlug } from "@/modules/tours/tour.repository";
import { PRODUCT_MAP } from "@/modules/bokun/product-map";
import fs from "node:fs";
import path from "node:path";
import { MEDIA_DIR, getMediaAssets } from "@/modules/media/media.repository";
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
      expect(tour?.featuredImage).toMatch(/^\/media\//);
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

  it("takes booking mode and Bokun ID from the product mapping table", async () => {
    for (const product of PRODUCT_MAP) {
      const tour = await getTourBySlug(product.slug);
      expect(tour?.bookingMode, product.slug).toBe(product.bookingMode);
      expect(tour?.bokunId ?? null, product.slug).toBe(product.bokunId);
    }
    for (const slug of ["banff-yoho-custom-private-tour", "jasper-custom-private-tour", "multi-day-tour-package-for-banff"]) {
      expect((await getTourBySlug(slug))?.bookingMode, slug).toBe("ENQUIRY");
    }
  });

  it("gives tours clips of the places they visit, in season, from backend media", async () => {
    const media = new Map(getMediaAssets().map((a) => [a.src, a]));
    for (const slug of PRESERVED_SLUGS) {
      const tour = await getTourBySlug(slug);
      for (const video of tour!.videos) {
        const asset = media.get(video.src);
        expect(asset?.collection, `${slug}: ${video.src}`).toBe("videos");
        expect(fs.existsSync(path.join(MEDIA_DIR, video.poster.replace(/^\/media\//, ""))), `${slug}: ${video.poster}`).toBe(true);
      }
    }
    const winter = await getTourBySlug("winter-special");
    expect(winter!.videos.length).toBeGreaterThan(0);
    for (const v of winter!.videos) expect(media.get(v.src)?.tags).toContain("winter");
    const summer = await getTourBySlug("shared-tours-icefields-jasper");
    for (const v of summer!.videos) expect(media.get(v.src)?.tags).not.toContain("winter");
  });

  it("maps every live product once, and serves every tour image from backend media", async () => {
    expect(PRODUCT_MAP.map((p) => p.slug).sort()).toEqual([...PRESERVED_SLUGS].sort());
    const media = new Set(getMediaAssets().map((a) => a.src));
    for (const slug of PRESERVED_SLUGS) {
      const tour = await getTourBySlug(slug);
      for (const src of [tour!.featuredImage, ...tour!.galleryImages]) {
        expect(src, slug).toMatch(/^\/media\//);
        expect(media.has(src), `${slug}: ${src}`).toBe(true);
      }
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
