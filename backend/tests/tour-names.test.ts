// Tour names with their type in front (owner, 2026-11-27): "SHARED - COLUMBIA ICEFIELD ADVENTURE",
// "PRIVATE - …", "MULTI-DAY …", everywhere the website, emails, PDFs and admin show a tour.
import { describe, expect, it } from "vitest";
import { DAY_TOUR_NAMES, PACKAGE_NAMES, baseTourName, packageDisplayName, privateOptionName, tourDisplayName } from "@site/tourNames";
import { TOUR_ITINERARIES } from "@site/itineraries";
import { experienceTitle } from "@/modules/bookings/tour-itinerary";
import { tripOf } from "@/modules/bookings/trip";
import { PACKAGES } from "@/modules/bookings/package-booking";

describe("tour names with type prefix", () => {
  it("names the four day tours as the owner asked", () => {
    expect(DAY_TOUR_NAMES["shared-tours-icefields-jasper"]).toBe("SHARED - COLUMBIA ICEFIELD ADVENTURE");
    expect(DAY_TOUR_NAMES["icefields-jasper-private-tour"]).toBe("PRIVATE - COLUMBIA ICEFIELD ADVENTURE");
    expect(DAY_TOUR_NAMES["banff-highlights-tour"]).toBe("SHARED - BANFF & YOHO DISCOVERY");
    expect(DAY_TOUR_NAMES["banff-private-tour"]).toBe("PRIVATE - BANFF & YOHO DISCOVERY");
  });

  it("gives every multi-day journey a MULTI-DAY name, one per backend package", () => {
    for (const pkg of PACKAGES) expect(PACKAGE_NAMES[pkg.slug], pkg.slug).toMatch(/^MULTI-DAY (SHARED|PRIVATE) - /);
    expect(PACKAGE_NAMES["two-day-rockies-explorer"]).toBe("MULTI-DAY SHARED - TWO-DAY ROCKIES EXPLORER");
    expect(PACKAGE_NAMES["three-day-rockies-discovery"]).toBe("MULTI-DAY PRIVATE - THREE-DAY ROCKIES DISCOVERY");
  });

  it("keeps the itinerary file (import-free) in step with the names", () => {
    for (const [slug, name] of Object.entries(DAY_TOUR_NAMES)) expect(TOUR_ITINERARIES[slug].title).toBe(name);
  });

  it("never doubles the type and leaves shuttles and tickets alone", () => {
    expect(baseTourName("Private Columbia Icefield Adventure")).toBe("Columbia Icefield Adventure");
    expect(baseTourName("Banff & Yoho Discovery (Shared Tour)")).toBe("Banff & Yoho Discovery");
    expect(baseTourName("Two-Day Rockies Explorer – Shared Tour")).toBe("Two-Day Rockies Explorer");
    expect(baseTourName("SHARED - COLUMBIA ICEFIELD ADVENTURE")).toBe("COLUMBIA ICEFIELD ADVENTURE");
    expect(tourDisplayName({ slug: "winter-special", title: "Winter Special Shared Tour", category: "SHARED" })).toBe("SHARED - WINTER SPECIAL");
    expect(tourDisplayName({ slug: "banff-highlights-tour", title: "Our Best Selling Banff Shared Tour", category: "SHARED" })).toBe("SHARED - BANFF & YOHO DISCOVERY");
    expect(tourDisplayName({ slug: "x", title: "Sunrise Shuttle", category: "SHUTTLE" })).toBe("Sunrise Shuttle");
    expect(tourDisplayName({ slug: "x", title: "Banff Gondola", category: "TICKET" })).toBe("Banff Gondola");
    expect(privateOptionName({ id: "two-day-rockies-private", title: "Two-Day Rockies Explorer" })).toBe("MULTI-DAY PRIVATE - TWO-DAY ROCKIES EXPLORER");
  });

  it("emails, PDFs and admin use the typed name, also for trips booked before the change", () => {
    expect(experienceTitle({ tour: { slug: "banff-private-tour", title: "Standard Banff Private Best Selling Tour", category: "PRIVATE" } })).toBe("PRIVATE - BANFF & YOHO DISCOVERY");
    const old = tripOf({ package: { slug: "three-day-rockies-discovery", title: "Three-Day Rockies Discovery", day: 1, references: ["A", "B", "C"] } });
    expect(old?.title).toBe("MULTI-DAY PRIVATE - THREE-DAY ROCKIES DISCOVERY");
    expect(tripOf({ package: { slug: "staff-linked-trip", title: "Smith family week", day: 1, references: ["A", "B"] } })?.title).toBe("Smith family week");
    expect(packageDisplayName(undefined, "Multi-day trip")).toBe("Multi-day trip");
  });
});
