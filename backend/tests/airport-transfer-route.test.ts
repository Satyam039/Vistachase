// Arrival and departure locations are independent (owner, 2026-11-19).
import { describe, it, expect } from "vitest";
import { airportTransferSchema, airportTransferSummary, departureRoute, transferLegs } from "@/modules/bookings/airport-transfer";

const base = { type: "ROUND_TRIP" as const, area: "BANFF" as const, arrivalDate: "2027-06-19", arrivalTime: "14:30", departureDate: "2027-06-23", departureTime: "18:05", from: "Calgary Airport (YYC)", to: "Fairmont Banff Springs" };

describe("airport transfer routes", () => {
  it("a round trip's departure leg uses its own From / Where to", () => {
    const t = airportTransferSchema.parse({ ...base, departureFrom: "Chateau Lake Louise", departureTo: "Calgary Airport (YYC)" });
    expect(departureRoute(t)).toEqual({ from: "Chateau Lake Louise", to: "Calgary Airport (YYC)" });
    const legs = transferLegs({ airportTransfer: { ...t, guests: 4 } });
    expect(legs.map((l) => [l.leg, l.from, l.to])).toEqual([
      ["ARRIVAL", "Calgary Airport (YYC)", "Fairmont Banff Springs"],
      ["DEPARTURE", "Chateau Lake Louise", "Calgary Airport (YYC)"],
    ]);
    expect(airportTransferSummary({ airportTransfer: { ...t, transfers: 2, unitCents: 36400 } })).toContain(
      "arrival Calgary Airport (YYC) to Fairmont Banff Springs; departure Chateau Lake Louise to Calgary Airport (YYC)",
    );
  });

  it("older bookings without departure fields still run the arrival route back", () => {
    const t = airportTransferSchema.parse(base);
    expect(departureRoute(t)).toEqual({ from: "Fairmont Banff Springs", to: "Calgary Airport (YYC)" });
  });
});
