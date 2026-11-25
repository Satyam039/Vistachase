import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  SHUTTLE_DEPARTURES,
  SHUTTLE_PRODUCT_NAME,
  departuresFor,
  inSeason,
  shuttleDepartureForTime,
  shuttleFareCad,
} from "@site/shuttleSchedule";
import { pickupError } from "@/modules/bookings/pickup-rules";
import { bookingItinerary, experienceTitle } from "@/modules/bookings/tour-itinerary";

describe("shuttle schedule updates", () => {
  it("uses the unified shuttle product name", () => {
    expect(SHUTTLE_PRODUCT_NAME).toBe("Moraine Lake & Lake Louise Shuttle");
  });

  it("operates June 1 to October 12 with departures 1–7 through July 31 and 2–6 from August 1", () => {
    expect(inSeason("2027-05-31")).toBe(false);
    expect(inSeason("2027-06-01")).toBe(true);
    expect(inSeason("2027-07-31")).toBe(true);
    expect(inSeason("2027-08-01")).toBe(true);
    expect(inSeason("2027-10-12")).toBe(true);
    expect(inSeason("2027-10-13")).toBe(false);

    expect(departuresFor("2027-07-31").map((d) => d.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(departuresFor("2027-08-01").map((d) => d.number)).toEqual([2, 3, 4, 5, 6]);
    expect(departuresFor("2027-10-12").map((d) => d.number)).toEqual([2, 3, 4, 5, 6]);
    expect(departuresFor("2027-10-13")).toEqual([]);
  });

  it("includes Samson Mall estimated return times for every departure", () => {
    expect(SHUTTLE_DEPARTURES.map((d) => [d.number, d.returnSamson])).toEqual([
      [1, "08:15"],
      [2, "09:45"],
      [3, "12:15"],
      [4, "15:00"],
      [5, "17:15"],
      [6, "19:45"],
      [7, "21:15"],
    ]);
  });

  it("prices departures 1–2 at CAD $135, 3–4 at $120, and 5–7 at $108", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(shuttleFareCad)).toEqual([135, 135, 120, 120, 108, 108, 108]);
    expect(shuttleDepartureForTime("03:15")?.number).toBe(1);
    expect(shuttleDepartureForTime("04:15")?.number).toBe(2);
  });
});

describe("custom pickup address restrictions", () => {
  it("refuses custom pickup addresses for shuttles and shared tours unless overridden by staff", () => {
    expect(pickupError({ category: "SHARED" }, null, "Moxy Banff")).toMatch(/not available for shuttles or shared tours/);
    expect(pickupError({ category: "SHUTTLE" }, null, "Samson Mall Airbnb")).toMatch(/not available for shuttles or shared tours/);
    expect(pickupError({ category: "SHARED" }, null, "Moxy Banff", { allowCustomPickup: true })).toBeNull();
  });

  it("allows custom pickup addresses for private tours in Canmore and Banff only", () => {
    expect(pickupError({ category: "PRIVATE" }, null, "123 Bow Valley Trail, Canmore")).toBeNull();
    expect(pickupError({ category: "PRIVATE" }, null, "Moxy Banff, Banff Ave")).toBeNull();
    expect(pickupError({ category: "PRIVATE" }, null, "Jasper: Whistlers Inn")).toBeNull();
    expect(pickupError({ category: "PRIVATE" }, null, "Fairmont Chateau Lake Louise")).toMatch(/Canmore and Banff only/);
    expect(pickupError({ category: "PRIVATE" }, null, "Calgary Downtown Hotel")).toMatch(/Canmore and Banff only/);
  });
});

describe("shuttle itineraries & titles", () => {
  it("maps both shuttle product slugs to Moraine Lake & Lake Louise Shuttle", () => {
    const scheduleSrc = fs.readFileSync(path.resolve(__dirname, "../../frontend/src/lib/shuttleSchedule.ts"), "utf8");
    expect(scheduleSrc).not.toMatch(/^\s*import\s/m);
    expect(experienceTitle({ tour: { slug: "sunrise-shuttle-to-moraine-lake-and-lake-louise", title: "Old Title", category: "SHUTTLE" } })).toBe(
      "Moraine Lake & Lake Louise Shuttle",
    );
    expect(experienceTitle({ tour: { slug: "full-day-at-lake-louise-and-moraine-lake", title: "Old Day Title", category: "SHUTTLE" } })).toBe(
      "Moraine Lake & Lake Louise Shuttle",
    );
  });

  it("includes Samson Mall return time and October 12 operating window in bookingItinerary", () => {
    const okOct12 = bookingItinerary({
      tourDeparture: {
        date: "2027-10-12",
        departureTime: "04:15",
        tour: { slug: "sunrise-shuttle-to-moraine-lake-and-lake-louise", category: "SHUTTLE" },
      },
    });
    expect(okOct12.ok).toBe(true);
    if (okOct12.ok) {
      expect(okOct12.itinerary.heading).toBe("Departure 2 · Early Morning");
      expect(okOct12.itinerary.steps.map((s) => `${s.time} ${s.text}`).join("\n")).toContain("Samson Mall 9:45 AM");
    }

    const outOfSeason = bookingItinerary({
      tourDeparture: {
        date: "2027-10-13",
        departureTime: "04:15",
        tour: { slug: "sunrise-shuttle-to-moraine-lake-and-lake-louise", category: "SHUTTLE" },
      },
    });
    expect(outOfSeason.ok).toBe(false);
  });
});
