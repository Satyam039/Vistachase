import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

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
