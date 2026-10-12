import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { apiJsonReplacer } from "../src/lib/utils/time";

// The frontend shows departure dates and times exactly as the API sends them ("2026-10-08",
// "08:30"). Stored values are Date objects (lib/utils/time.ts), so every response must convert
// them; a raw timestamp would show the time as "1970-".
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

describe("API date and time format", () => {
  const app = createApp();

  it("lists tour departures as YYYY-MM-DD and HH:MM, with prices in dollars", async () => {
    const res = await request(app).get("/api/tours/banff-highlights-tour");
    expect(res.status).toBe(200);
    const tour = res.body.tour ?? res.body;
    expect(tour.departures.length).toBeGreaterThan(0);
    for (const d of tour.departures) {
      expect(d.date).toMatch(DATE);
      expect(d.departureTime).toMatch(TIME);
      if (d.returnTime !== null) expect(d.returnTime).toMatch(TIME);
      // Dollars, not cents: shared seats on this tour sell for a few hundred dollars at most.
      expect(d.price).toBeGreaterThan(0);
      expect(d.price).toBeLessThan(1000);
    }
  });

  it("formats departures in the checkout response too (raw database rows)", async () => {
    const tour = (await request(app).get("/api/tours/banff-highlights-tour")).body;
    const departureId = (tour.tour ?? tour).departures[0].id;
    const res = await request(app).get(`/api/departures/checkout?departureId=${departureId}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("1970-01-01T");
    expect(body).not.toMatch(/"date":"\d{4}-\d{2}-\d{2}T00:00:00\.000Z"/);
  });
});

describe("checkout departure price", () => {
  it("is in dollars, like the rest of the API", async () => {
    const app = createApp();
    const tour = (await request(app).get("/api/tours/banff-highlights-tour")).body;
    const dep = (tour.tour ?? tour).departures[0];
    const res = await request(app).get(`/api/departures/checkout?departureId=${dep.id}`);
    expect(res.body.departure.price).toBe(dep.price);
    expect(res.body.departure.price).toBeLessThan(1000);
  });
});

describe("pickup time fallback", () => {
  it("sends a pickup time that fell back to the departure time as HH:MM, not a 1970 timestamp", () => {
    const body = JSON.parse(JSON.stringify({ pickupTime: new Date("1970-01-01T09:00:00.000Z"), note: "1970-01-01T09:00:00.000Z" }, apiJsonReplacer));
    expect(body.pickupTime).toBe("09:00");
    // Other fields that happen to hold such a string are left alone.
    expect(body.note).toBe("1970-01-01T09:00:00.000Z");
    // A pickup time a guest or staff typed passes through unchanged.
    expect(JSON.parse(JSON.stringify({ pickupTime: "05:00 AM" }, apiJsonReplacer)).pickupTime).toBe("05:00 AM");
  });
});
