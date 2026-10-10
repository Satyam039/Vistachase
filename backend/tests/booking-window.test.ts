import { afterEach, describe, expect, it } from "vitest";
import prisma from "@/lib/db/prisma";
import { createReservationHold } from "@/modules/reservations/reservation.repository";
import { createBooking } from "@/modules/bookings/booking.repository";
import { getTourBySlug } from "@/modules/tours/tour.repository";
import { bookingClosedError, bookingCutoffMinutes } from "@/modules/departures/booking-window";
import { dateOnly, timeOfDay, todayInMountainTime } from "@/lib/utils/time";

// Mountain-time wall clock ("YYYY-MM-DD", "HH:MM") for an instant, the way departures are stored.
function mountainWallClock(instant: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// A shuttle product: tests elsewhere pick "the earliest shared departure", so the past departures
// made here stay out of their way even while these tests run in parallel.
async function sharedTour() {
  return prisma.tour.findFirstOrThrow({ where: { bookingMode: "BOKUN", category: "SHUTTLE" } });
}

// Departures made here are deleted after each test: other test files pick "the earliest active
// departure" from the same database and must never get one of these past ones.
const created: string[] = [];
async function departureAt(tourId: string, date: string, time: string) {
  const departure = await prisma.tourDeparture.create({
    data: { tourId, date: dateOnly(date), departureTime: timeOfDay(time), capacityTotal: 10, capacityBooked: 0, capacityHeld: 0, price: 19900, status: "ACTIVE" },
  });
  created.push(departure.id);
  return departure;
}

const guest = { customerName: "Window Test", customerEmail: "window.test@example.com" };

describe("Booking window: past and closing departures can't be booked", () => {
  const original = process.env.BOOKING_CUTOFF_MINUTES;
  afterEach(async () => {
    if (original === undefined) delete process.env.BOOKING_CUTOFF_MINUTES;
    else process.env.BOOKING_CUTOFF_MINUTES = original;
    await prisma.tourDeparture.deleteMany({ where: { id: { in: created.splice(0) } } });
  });

  it("refuses a hold and a booking for a departure that has already left", async () => {
    const tour = await sharedTour();
    const yesterday = mountainWallClock(new Date(Date.now() - 86_400_000)).date;
    const past = await departureAt(tour.id, yesterday, "08:00");

    const hold = await createReservationHold({ departureId: past.id, seatsCount: 2, ...guest });
    expect(hold.success).toBe(false);
    expect(hold.error).toMatch(/closed|left/i);

    const booking = await createBooking({ departureId: past.id, ...guest, customerPhone: "+14035550100", adultsCount: 2, childrenCount: 0, infantsCount: 0 });
    expect(booking.success).toBe(false);
    expect(booking.error).toMatch(/closed|left/i);

    const fresh = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: past.id } });
    expect(fresh.capacityHeld).toBe(0);
    expect(fresh.capacityBooked).toBe(0);
  });

  it("closes online booking BOOKING_CUTOFF_MINUTES before departure (default 60)", async () => {
    delete process.env.BOOKING_CUTOFF_MINUTES;
    expect(bookingCutoffMinutes()).toBe(60);
    const tour = await sharedTour();
    const soon = mountainWallClock(new Date(Date.now() + 30 * 60_000));
    const departure = await departureAt(tour.id, soon.date, soon.time);

    const hold = await createReservationHold({ departureId: departure.id, seatsCount: 1, ...guest });
    expect(hold.success).toBe(false);
    expect(hold.error).toMatch(/60 minutes/);

    // With no cutoff the same departure (30 minutes away) is still bookable.
    process.env.BOOKING_CUTOFF_MINUTES = "0";
    expect(bookingClosedError(departure)).toBeNull();
    const allowed = await createReservationHold({ departureId: departure.id, seatsCount: 1, ...guest });
    expect(allowed.success).toBe(true);
  });

  it("lists only departures that can still be booked", async () => {
    delete process.env.BOOKING_CUTOFF_MINUTES;
    const tour = await sharedTour();
    const yesterday = mountainWallClock(new Date(Date.now() - 86_400_000)).date;
    const soon = mountainWallClock(new Date(Date.now() + 30 * 60_000));
    const past = await departureAt(tour.id, yesterday, "09:15");
    const closing = await departureAt(tour.id, soon.date, soon.time);
    const future = await departureAt(tour.id, "2031-06-01", "08:00");

    const listed = (await getTourBySlug(tour.slug))!.departures.map((d) => d.id);
    expect(listed).not.toContain(past.id);
    expect(listed).not.toContain(closing.id);
    expect(listed).toContain(future.id);
    // Nothing listed is dated before today in Banff.
    const today = todayInMountainTime();
    expect((await getTourBySlug(tour.slug))!.departures.every((d) => d.date >= today)).toBe(true);
  });
});
