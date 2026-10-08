// The worker's scheduled jobs (src/jobs/tasks.ts).

import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { expireHoldsAndUnpaidBookings, reconcileBookings, sendReviewRequests } from "@/jobs/tasks";
import { dateOnly, timeOfDay, todayInMountainTime } from "@/lib/utils/time";

async function departure(day: string, capacityHeld = 0) {
  const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED" } });
  return prisma.tourDeparture.create({
    data: { tourId: tour.id, date: dateOnly(day), departureTime: timeOfDay("09:00"), capacityTotal: 12, capacityBooked: 0, capacityHeld, price: 10000, status: "ACTIVE" },
  });
}

describe("worker jobs", () => {
  it("frees seats held by expired holds, once", async () => {
    const dep = await departure("2027-06-01", 3);
    await prisma.reservationHold.create({
      data: { holdToken: `hold_job_${Date.now()}`, tourDepartureId: dep.id, seatsCount: 3, customerName: "H", customerEmail: "h@example.com", expiresAt: new Date(Date.now() - 1000), status: "ACTIVE" },
    });
    await expireHoldsAndUnpaidBookings();
    await expireHoldsAndUnpaidBookings(); // a second run changes nothing
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: dep.id } })).capacityHeld).toBe(0);
  });

  it("asks yesterday's guests for a review once, with a signed link", async () => {
    const yesterday = todayInMountainTime(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const dep = await departure(yesterday);
    const booking = await prisma.booking.create({
      data: {
        bookingReference: `VC-JOB-${Date.now()}`, customerName: "Reviewer", customerEmail: "reviewer@example.com", customerPhone: "+14035550100",
        tourDepartureId: dep.id, adultsCount: 1, childrenCount: 0, infantsCount: 0, totalSeats: 1,
        subtotal: 10000, tax: 0, totalAmount: 10000, currency: "CAD", status: "CONFIRMED", voucherCode: `VOUCH-JOB-${Date.now()}`,
      },
    });
    expect(await sendReviewRequests()).toBeGreaterThanOrEqual(1);
    expect(await sendReviewRequests()).toBe(0);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.status).toBe("COMPLETED");
    expect(after.reviewRequestedAt).not.toBeNull();
  });

  it("flags paid bookings that never reached Bókun", async () => {
    const dep = await departure("2027-06-02");
    const ref = `VC-UNSYNC-${Date.now()}`;
    await prisma.booking.create({
      data: {
        bookingReference: ref, customerName: "U", customerEmail: "u@example.com", customerPhone: "+14035550100",
        tourDepartureId: dep.id, adultsCount: 1, childrenCount: 0, infantsCount: 0, totalSeats: 1,
        subtotal: 10000, tax: 0, totalAmount: 10000, currency: "CAD", status: "PAID_UNSYNCED", voucherCode: `VOUCH-UNS-${Date.now()}`,
      },
    });
    const issues = await reconcileBookings();
    expect(issues.some((i) => i.bookingReference === ref && /Bókun/.test(i.problem))).toBe(true);
  });
});
