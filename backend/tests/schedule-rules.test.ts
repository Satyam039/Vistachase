// Owner, 2026-11-12: the four day tours depart at 8:00 AM only, and shuttles take 14 guests a
// departure. Other times are never listed, held, booked or put back on sale by the Bókun sync.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/db/prisma";
import { FIXED_START_TIMES, SHUTTLE_CAPACITY, isScheduledStartTime, setFixedStartTimesForTests, startTimeError } from "@/modules/departures/schedule-rules";
import { setBokunClientForTests, type BokunApi } from "@/modules/bokun/config";
import { setBokunAutoRunForTests } from "@/modules/bokun/bokun-sync";
import { syncBokunSeats } from "@/modules/bokun/availability-sync";
import { createBooking } from "@/modules/bookings/booking.repository";
import { createReservationHold } from "@/modules/reservations/reservation.repository";
import { getTourBySlug } from "@/modules/tours/tour.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";
import { DEFAULT_SCHEDULES, alignCapacity, capSharedDepartures, retireOffScheduleDepartures } from "../scripts/seed-departures";

const DAY = "2036-02-12";
const SLUG = "banff-highlights-tour"; // Bókun 796650
const SHUTTLE = "full-day-at-lake-louise-and-moraine-lake"; // Bókun 1344805

let slots: Record<string, any[]> = {};
const fakeBokun = {
  getAvailabilities: async (id: string) => slots[id] ?? [],
  fetch: async () => null,
} as unknown as BokunApi;
const slot = (id: string, time: string, left: number, booked = 0) =>
  (slots[id] ??= []).push({ date: Date.parse(`${DAY}T00:00:00Z`), startTime: time, startTimeId: 1, availabilityCount: left, bookedParticipants: booked, defaultRateId: 5, rates: [{ id: 5 }] });

async function dep(slug: string, time: string, capacity = 12) {
  const tour = await prisma.tour.findUniqueOrThrow({ where: { slug } });
  return prisma.tourDeparture.create({
    data: { tourId: tour.id, date: dateOnly(DAY), departureTime: timeOfDay(time), capacityTotal: capacity, price: 22000, status: "ACTIVE", inventorySource: "LOCAL" },
  });
}

beforeAll(() => {
  setFixedStartTimesForTests(FIXED_START_TIMES);
  setBokunAutoRunForTests(false);
});
beforeEach(() => {
  slots = {};
  setBokunClientForTests(fakeBokun);
});
afterAll(() => {
  setFixedStartTimesForTests(null);
  setBokunClientForTests(null);
  setBokunAutoRunForTests(true);
});

describe("8:00 AM only on the four day tours", () => {
  it("covers both Banff & Yoho and both Columbia Icefield tours, and nothing else", () => {
    expect(FIXED_START_TIMES).toEqual({
      "banff-highlights-tour": "08:00",
      "shared-tours-icefields-jasper": "08:00",
      "banff-private-tour": "08:00",
      "icefields-jasper-private-tour": "08:00",
    });
    expect(isScheduledStartTime("banff-private-tour", "07:00")).toBe(false);
    expect(isScheduledStartTime("shared-tours-icefields-jasper", "07:30")).toBe(false);
    expect(isScheduledStartTime("banff-highlights-tour", "08:30")).toBe(false);
    expect(isScheduledStartTime("banff-highlights-tour", "08:00")).toBe(true);
    expect(isScheduledStartTime(SHUTTLE, "06:30")).toBe(true);
    expect(startTimeError("icefields-jasper-private-tour", "07:00")).toMatch(/8:00 AM only/);
  });

  it("seeds only 8:00 for those tours", () => {
    for (const slug of Object.keys(FIXED_START_TIMES)) {
      const times = DEFAULT_SCHEDULES.find((s) => s.slug === slug)!.times.map((t) => (typeof t === "string" ? t : t.time));
      expect(times).toEqual(["08:00"]);
    }
  });

  it("lists only the 8:00 departure, and refuses holds and bookings at another time", async () => {
    const eight = await dep(SLUG, "08:00");
    const half = await dep(SLUG, "08:30");
    slot("796650", "08:30", 12); // Bókun would sell it: our own rule must refuse it
    const tour = await getTourBySlug(SLUG);
    const listed = tour!.departures.filter((d) => d.date === DAY).map((d) => d.departureTime);
    expect(listed).toEqual(["08:00"]);

    const hold = await createReservationHold({ departureId: half.id, seatsCount: 2, customerName: "Ada Lovelace", customerEmail: "ada.times@example.com" } as any);
    expect(hold.success).toBe(false);
    const booking = await createBooking({ departureId: half.id, customerName: "Ada Lovelace", customerEmail: "ada.times@example.com", customerPhone: "+1 403 555 0100", adultsCount: 2, childrenCount: 0, infantsCount: 0 });
    expect(booking.success).toBe(false);
    expect(booking.error).toMatch(/8:00 AM only/);
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: half.id } })).capacityHeld).toBe(0);
    expect(eight.id).toBeTruthy();
  });

  it("the Bókun sync never puts another time back on sale, even for a start Bókun runs without a clock", async () => {
    const seven = await dep("banff-private-tour", "07:00", 13);
    await prisma.tourDeparture.update({ where: { id: seven.id }, data: { inventorySource: "UNVERIFIED" } });
    slot("1167962", "00:00", 1);
    await syncBokunSeats({ from: DAY, days: 1 });
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: seven.id } })).inventorySource).toBe("UNVERIFIED");
  });
});

describe("shuttles take 14 guests a departure", () => {
  it("is the seeded capacity of both shuttles", () => {
    expect(SHUTTLE_CAPACITY).toBe(14);
    for (const s of DEFAULT_SCHEDULES.filter((x) => x.seasonEndsMonth)) expect(s.capacity).toBe(14);
  });

  it("the Bókun sync never lists more than 14 seats, whatever Bókun's capacity", async () => {
    const d = await dep(SHUTTLE, "10:15", 14);
    slot("1344805", "10:15", 20, 4); // Bókun: 24 seats, 4 sold
    await syncBokunSeats({ from: DAY, days: 1 });
    const after = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: d.id } });
    expect(after.capacityTotal).toBe(14);
    expect(after.capacityBooked).toBe(4);
  });

  it("the Bókun sync never lists more than 15 seats on a shared tour (one 15-passenger van)", async () => {
    const d = await dep(SLUG, "08:00", 12);
    slot("796650", "08:00", 236, 4); // Bókun: 240 seats, 4 sold
    await syncBokunSeats({ from: DAY, days: 1 });
    const after = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: d.id } });
    expect(after.capacityTotal).toBe(15);
    expect(after.capacityBooked).toBe(4);
  });
});

describe("the deploy's clean-up (seed-departures)", () => {
  it("cancels unbooked departures at other times and keeps one a guest has booked", async () => {
    const tour = await prisma.tour.findUniqueOrThrow({ where: { slug: "icefields-jasper-private-tour" } });
    const day = "2036-03-03";
    const mk = (time: string) => prisma.tourDeparture.create({ data: { tourId: tour.id, date: dateOnly(day), departureTime: timeOfDay(time), capacityTotal: 13, price: 124000, status: "ACTIVE", inventorySource: "LOCAL" } });
    const [free, booked, eight] = [await mk("07:00"), await mk("07:30"), await mk("08:00")];
    setFixedStartTimesForTests(null); // a booking made before the rule
    setBokunClientForTests(null);
    const made = await createBooking({ departureId: booked.id, customerName: "Ada Lovelace", customerEmail: "ada.keep@example.com", customerPhone: "+1 403 555 0100", adultsCount: 2, childrenCount: 0, infantsCount: 0 });
    setFixedStartTimesForTests(FIXED_START_TIMES);
    setBokunClientForTests(fakeBokun);
    expect(made.success).toBe(true);
    await retireOffScheduleDepartures({ from: "2036-03-03", to: "2036-03-03" }); // only this test's day: other test files share the database
    const status = async (id: string) => (await prisma.tourDeparture.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(free.id)).toBe("CANCELLED");
    expect(await status(booked.id)).toBe("ACTIVE");
    expect(await status(eight.id)).toBe("ACTIVE");
  });

  it("sets shuttles to 14 seats and private day tours to 13, never below what is already sold", async () => {
    const shuttle = await prisma.tour.findUniqueOrThrow({ where: { slug: SHUTTLE } });
    const priv = await prisma.tour.findUniqueOrThrow({ where: { slug: "banff-private-tour" } });
    const day = "2036-07-07";
    const s24 = await prisma.tourDeparture.create({ data: { tourId: shuttle.id, date: dateOnly(day), departureTime: timeOfDay("11:30"), capacityTotal: 24, capacityBooked: 3, price: 10800, status: "ACTIVE", inventorySource: "LOCAL" } });
    const full = await prisma.tourDeparture.create({ data: { tourId: shuttle.id, date: dateOnly(day), departureTime: timeOfDay("14:00"), capacityTotal: 24, capacityBooked: 20, price: 10800, status: "ACTIVE", inventorySource: "LOCAL" } });
    const p14 = await prisma.tourDeparture.create({ data: { tourId: priv.id, date: dateOnly(day), departureTime: timeOfDay("08:00"), capacityTotal: 14, price: 175000, status: "ACTIVE", inventorySource: "LOCAL" } });
    await alignCapacity({ from: "2036-07-07", to: "2036-07-07" });
    const seats = async (id: string) => (await prisma.tourDeparture.findUniqueOrThrow({ where: { id } })).capacityTotal;
    expect(await seats(s24.id)).toBe(14);
    expect(await seats(full.id)).toBe(24); // 20 already sold: left for staff
    expect(await seats(p14.id)).toBe(13);
    expect((await prisma.tour.findUniqueOrThrow({ where: { slug: SHUTTLE } })).maxGroupSize).toBe(14);
    expect((await prisma.tour.findUniqueOrThrow({ where: { slug: "banff-private-tour" } })).maxGroupSize).toBe(13);
  });

  it("lowers shared departures above 15 seats, never below what is already sold, and never raises one", async () => {
    const shared = await prisma.tour.findUniqueOrThrow({ where: { slug: SLUG } });
    const day = "2036-07-08";
    const make = (capacityTotal: number, capacityBooked: number) =>
      prisma.tourDeparture.create({ data: { tourId: shared.id, date: dateOnly(day), departureTime: timeOfDay("08:00"), capacityTotal, capacityBooked, price: 22000, status: "ACTIVE", inventorySource: "LOCAL" } });
    const big = await make(240, 5);
    const sold = await make(240, 18);
    const small = await make(12, 0);
    await capSharedDepartures({ from: "2036-07-08", to: "2036-07-08" });
    const seats = async (id: string) => (await prisma.tourDeparture.findUniqueOrThrow({ where: { id } })).capacityTotal;
    expect(await seats(big.id)).toBe(15);
    expect(await seats(sold.id)).toBe(240); // 18 already sold: left for staff
    expect(await seats(small.id)).toBe(12);
  });
});
