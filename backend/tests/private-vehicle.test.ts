import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { createReservationHold } from "@/modules/reservations/reservation.repository";
import { cancelBooking, createBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";
import { airportTransferPriceCents, airportTransferSchema, airportTransferSummary } from "@/modules/bookings/airport-transfer";

async function createPrivateDeparture(date: string) {
  const tour = await prisma.tour.findFirstOrThrow({ where: { category: "PRIVATE" } });
  return prisma.tourDeparture.create({
    data: { inventorySource: "LOCAL",
      tourId: tour.id,
      date: dateOnly(date),
      departureTime: timeOfDay("08:00"),
      capacityTotal: 6,
      capacityBooked: 0,
      capacityHeld: 0,
      price: 125000, // $1,250 per vehicle, in cents
      status: "ACTIVE",
    },
  });
}

describe("Private tours are priced and reserved per vehicle", () => {
  it("holds the whole vehicle, charges one vehicle price, and blocks a second party", async () => {
    const departure = await createPrivateDeparture("2027-06-10");

    const hold = await createReservationHold({
      departureId: departure.id,
      seatsCount: 2,
      customerName: "Vehicle Guest",
      customerEmail: "vehicle.guest@example.com",
    });
    expect(hold.success).toBe(true);
    expect(hold.isVehicle).toBe(true);
    expect(hold.seatsHeld).toBe(6);

    const secondHold = await createReservationHold({
      departureId: departure.id,
      seatsCount: 1,
      customerName: "Other Party",
      customerEmail: "other.party@example.com",
    });
    expect(secondHold.success).toBe(false);

    const booking = await createBooking({
      departureId: departure.id,
      holdToken: hold.holdToken,
      customerName: "Vehicle Guest",
      customerEmail: "vehicle.guest@example.com",
      customerPhone: "+1 403 555 0100",
      adultsCount: 4,
      childrenCount: 0,
      infantsCount: 0,
    });
    expect(booking.success).toBe(true);
    // One vehicle price, not 4 × 1250 (no sales tax is added)
    expect(booking.booking?.totalAmount).toBe(1250);

    const afterBooking = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: departure.id } });
    expect(afterBooking.capacityBooked).toBe(6);
    expect(afterBooking.capacityHeld).toBe(0);

    const stored = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: booking.booking!.bookingReference } });
    expect(stored.totalSeats).toBe(4); // manifests still count the real guests
    expect(stored.subtotal).toBe(125000); // stored in cents

    const secondBooking = await createBooking({
      departureId: departure.id,
      customerName: "Other Party",
      customerEmail: "other.party@example.com",
      customerPhone: "+1 403 555 0101",
      adultsCount: 1,
      childrenCount: 0,
      infantsCount: 0,
    });
    expect(secondBooking.success).toBe(false);

    const cancelled = await cancelBooking(booking.booking!.bookingReference, "vehicle.guest@example.com");
    expect(cancelled.success).toBe(true);
    const afterCancel = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: departure.id } });
    expect(afterCancel.capacityBooked).toBe(0);
  });

  it("rejects a party larger than the vehicle", async () => {
    const departure = await createPrivateDeparture("2027-06-11");
    const result = await createBooking({
      departureId: departure.id,
      customerName: "Big Party",
      customerEmail: "big.party@example.com",
      customerPhone: "+1 403 555 0102",
      adultsCount: 7,
      childrenCount: 0,
      infantsCount: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("seats up to 6");
  });

  it("refuses a hold that belongs to a different departure", async () => {
    const holdDeparture = await createPrivateDeparture("2027-06-12");
    const otherDeparture = await createPrivateDeparture("2027-06-13");
    const hold = await createReservationHold({
      departureId: holdDeparture.id,
      seatsCount: 2,
      customerName: "Mixed Up",
      customerEmail: "mixed.up@example.com",
    });
    const result = await createBooking({
      departureId: otherDeparture.id,
      holdToken: hold.holdToken,
      customerName: "Mixed Up",
      customerEmail: "mixed.up@example.com",
      customerPhone: "+1 403 555 0103",
      adultsCount: 2,
      childrenCount: 0,
      infantsCount: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("different departure");
  });
});

describe("Airport transfer with a private tour", () => {
  const transfer = { arrivalDate: "2027-06-19", arrivalTime: "14:30", departureDate: "2027-06-23", departureTime: "18:05", from: "Calgary Airport (YYC)", to: "Fairmont Banff Springs" };

  const book = (date: string, extra: Record<string, unknown>, adults = 3) =>
    createPrivateDeparture(date).then((departure) =>
      createBooking({
        departureId: departure.id,
        customerName: "Flying In",
        customerEmail: `flying.in.${date}@example.com`,
        customerPhone: "+1 403 555 0104",
        adultsCount: adults,
        childrenCount: 0,
        infantsCount: 0,
        specialRequests: "Child seat please",
        airportTransfer: { ...transfer, ...extra } as never,
      }),
    );

  it("charges a round trip as two transfers at CAD 850 (Banff), owner 2026-11-17", async () => {
    const result = await book("2027-06-20", { type: "ROUND_TRIP", area: "BANFF" });
    expect(result.success).toBe(true);
    expect(result.booking?.totalAmount).toBe(1250 + 2 * 850);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: result.booking!.bookingReference }, include: { items: true } });
    expect(stored.items).toEqual([expect.objectContaining({ name: "Calgary Airport transfer, round trip (Banff)", price: 85000, quantity: 2 })]);
    expect(stored.specialRequests).toBe(
      "Airport transfer requested (round trip): from Calgary Airport (YYC) to Fairmont Banff Springs, staying in Banff, arrival 2027-06-19 14:30, departure 2027-06-23 18:05 (2 x CAD 850.00 = CAD 1,700.00, paid with the tour).\nChild seat please",
    );
    expect((stored.priceSnapshot as { airportTransfer?: unknown }).airportTransfer).toEqual({
      ...transfer,
      type: "ROUND_TRIP",
      area: "BANFF",
      transfers: 2,
      unitCents: 85000,
      priceCents: 170000,
    });
    expect(airportTransferSummary(stored.priceSnapshot)).toBe(
      "Round trip (Calgary Airport (YYC) to Fairmont Banff Springs and back), arrival 2027-06-19 14:30, departure 2027-06-23 18:05, 2 x CAD 850.00 = CAD 1,700.00",
    );
  });

  it("charges one transfer for arrival only or departure only (Lake Louise CAD 895)", async () => {
    const arrival = await book("2027-06-21", { type: "ARRIVAL", area: "LAKE_LOUISE", departureDate: undefined, departureTime: undefined });
    expect(arrival.success).toBe(true);
    expect(arrival.booking?.totalAmount).toBe(1250 + 895);
    const departure = await book("2027-06-22", { type: "DEPARTURE", area: "CANMORE", arrivalDate: undefined, arrivalTime: undefined, from: "Canmore hotel", to: "YYC" });
    expect(departure.success).toBe(true);
    expect(departure.booking?.totalAmount).toBe(1250 + 850);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: departure.booking!.bookingReference } });
    expect(stored.specialRequests).toContain("(departure only): from Canmore hotel to YYC, staying in Canmore, departure 2027-06-23 18:05 (CAD 850.00, paid with the tour)");
  });

  it("an older page (no type, both flights) is a round trip", async () => {
    const result = await book("2027-06-24", { area: "LAKE_LOUISE" });
    expect(result.success).toBe(true);
    expect(result.booking?.totalAmount).toBe(1250 + 2 * 895);
  });

  it("needs where the guest stays for the price", async () => {
    const result = await book("2027-06-25", { type: "ROUND_TRIP" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("where you're staying");
  });

  it("is priced per transfer by area, 2 to 12 guests (up-to-6 price not confirmed: same price)", () => {
    const rt = { type: "ROUND_TRIP" as const };
    expect(airportTransferPriceCents({ ...rt, area: "BANFF" }, 2)).toBe(170000);
    expect(airportTransferPriceCents({ ...rt, area: "CANMORE" }, 6)).toBe(170000);
    expect(airportTransferPriceCents({ ...rt, area: "LAKE_LOUISE" }, 12)).toBe(179000);
    expect(airportTransferPriceCents({ type: "ARRIVAL", area: "LAKE_LOUISE" }, 7)).toBe(89500);
    expect(airportTransferPriceCents({ type: "DEPARTURE", area: "BANFF" }, 4)).toBe(85000);
    expect(airportTransferPriceCents({ ...rt, area: "BANFF" }, 13)).toBeNull();
    expect(airportTransferPriceCents({ ...rt, area: "BANFF" }, 1)).toBeNull();
    expect(airportTransferPriceCents({ ...rt }, 4)).toBeNull();
  });

  it("reads an old booking's flat transfer as one transfer", () => {
    expect(airportTransferSummary({ airportTransfer: { ...transfer, priceCents: 36400 } })).toBe(
      "Round trip (Calgary Airport (YYC) to Fairmont Banff Springs and back), arrival 2027-06-19 14:30, departure 2027-06-23 18:05, CAD 364.00",
    );
    expect(airportTransferSummary({})).toBeNull();
  });

  it("is refused on a shared tour", async () => {
    const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED" } });
    const departure = await prisma.tourDeparture.create({
      data: { inventorySource: "LOCAL", tourId: tour.id, date: dateOnly("2027-06-21"), departureTime: timeOfDay("08:00"), capacityTotal: 12, price: 18900, status: "ACTIVE" },
    });
    const result = await createBooking({
      departureId: departure.id,
      customerName: "Shared Guest",
      customerEmail: "shared.guest@example.com",
      customerPhone: "+1 403 555 0105",
      adultsCount: 2,
      childrenCount: 0,
      infantsCount: 0,
      airportTransfer: transfer,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("private tours only");
  });

  it("needs a departure after the arrival", () => {
    expect(airportTransferSchema.safeParse(transfer).success).toBe(true);
    expect(airportTransferSchema.safeParse({ ...transfer, departureDate: "2027-06-19", departureTime: "09:00" }).success).toBe(false);
    expect(airportTransferSchema.safeParse({ ...transfer, arrivalTime: "2:30 PM" }).success).toBe(false);
  });

  it("asks only for the flight the transfer needs", () => {
    const { departureDate: _d, departureTime: _t, ...arrivalOnly } = transfer;
    expect(airportTransferSchema.safeParse({ ...arrivalOnly, type: "ARRIVAL" }).success).toBe(true);
    expect(airportTransferSchema.safeParse({ ...arrivalOnly, type: "DEPARTURE" }).success).toBe(false);
    expect(airportTransferSchema.safeParse({ ...arrivalOnly, type: "ROUND_TRIP" }).success).toBe(false);
  });

  it("needs where the transfer is from and where it goes", () => {
    expect(airportTransferSchema.safeParse({ ...transfer, from: " " }).success).toBe(false);
    const { to: _to, ...noDestination } = transfer;
    expect(airportTransferSchema.safeParse(noDestination).success).toBe(false);
  });
});
