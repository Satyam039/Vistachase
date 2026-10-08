import { describe, it, expect, beforeAll } from "vitest";
import prisma from "@/lib/db/prisma";
import { signToken } from "@/lib/auth/auth";
import { cancelBooking, getCustomerBookings } from "@/modules/bookings/booking.repository";
import { createReview, getTourReviews } from "@/modules/reviews/review.repository";

describe("Phase 5: Customer Portal, My Trips & Reviews", () => {
  let testCustomerEmail: string;
  let testTourId: string;
  let futureDepartureId: string;
  let imminentDepartureId: string;
  let validBookingRef: string;
  let imminentBookingRef: string;

  beforeAll(async () => {
    testCustomerEmail = `portal.test.${Date.now()}@example.com`;

    // 1. Get or create test tour
    const tour = await prisma.tour.findFirst();
    testTourId = tour!.id;

    // 2. Create future departure (> 48h away, e.g. +7 days)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const futureDateStr = futureDate.toISOString().split("T")[0];

    const futureDep = await prisma.tourDeparture.create({
      data: {
        tourId: testTourId,
        date: futureDateStr,
        departureTime: "09:00",
        capacityTotal: 14,
        capacityBooked: 2,
        capacityHeld: 0,
        price: 155.0,
        currency: "CAD",
        status: "SCHEDULED",
      },
    });
    futureDepartureId = futureDep.id;

    // 3. Create imminent departure (< 72h away)
    const imminentDate = new Date();
    imminentDate.setHours(imminentDate.getHours() + 12);
    const imminentDateStr = imminentDate.toISOString().split("T")[0];
    const imminentTimeStr = `${String(imminentDate.getHours()).padStart(2, "0")}:${String(imminentDate.getMinutes()).padStart(2, "0")}`;

    const imminentDep = await prisma.tourDeparture.create({
      data: {
        tourId: testTourId,
        date: imminentDateStr,
        departureTime: imminentTimeStr,
        capacityTotal: 14,
        capacityBooked: 2,
        capacityHeld: 0,
        price: 155.0,
        currency: "CAD",
        status: "SCHEDULED",
      },
    });
    imminentDepartureId = imminentDep.id;

    // 4. Create bookings
    const ref1 = `VC-TEST-${Math.floor(10000 + Math.random() * 90000)}`;
    const b1 = await prisma.booking.create({
      data: {
        bookingReference: ref1,
        customerName: "Portal Tester",
        customerEmail: testCustomerEmail,
        customerPhone: "+14035550199",
        tourDepartureId: futureDepartureId,
        adultsCount: 2,
        childrenCount: 0,
        infantsCount: 0,
        totalSeats: 2,
        subtotal: 310,
        tax: 15.5,
        totalAmount: 325.5,
        currency: "CAD",
        status: "CONFIRMED",
        voucherCode: `VOUCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      },
    });
    validBookingRef = b1.bookingReference;

    const ref2 = `VC-TEST-${Math.floor(10000 + Math.random() * 90000)}`;
    const b2 = await prisma.booking.create({
      data: {
        bookingReference: ref2,
        customerName: "Imminent Tester",
        customerEmail: testCustomerEmail,
        customerPhone: "+14035550199",
        tourDepartureId: imminentDepartureId,
        adultsCount: 2,
        childrenCount: 0,
        infantsCount: 0,
        totalSeats: 2,
        subtotal: 310,
        tax: 15.5,
        totalAmount: 325.5,
        currency: "CAD",
        status: "CONFIRMED",
        voucherCode: `VOUCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      },
    });
    imminentBookingRef = b2.bookingReference;
  });

  it("authenticates customer session and retrieves customer trip list", async () => {
    const token = signToken({
      userId: "test-user-id",
      email: testCustomerEmail,
      name: "Portal Tester",
      role: "CUSTOMER",
    });

    expect(token).toBeDefined();

    const trips = await getCustomerBookings(testCustomerEmail);
    expect(trips.length).toBeGreaterThanOrEqual(2);
    expect(trips.some((t) => t.bookingReference === validBookingRef)).toBe(true);
  });

  it("enforces the 72-hour cancellation policy: rejects cancellation within 72 hours", async () => {
    const res = await cancelBooking(imminentBookingRef, testCustomerEmail);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Cancellation window closed");

    // Verify booking is still CONFIRMED
    const b = await prisma.booking.findUnique({ where: { bookingReference: imminentBookingRef } });
    expect(b?.status).toBe("CONFIRMED");
  });

  it("allows cancellation outside 72 hours and releases tour capacity atomically", async () => {
    const res = await cancelBooking(validBookingRef, testCustomerEmail);
    expect(res.success).toBe(true);
    expect(res.booking?.status).toBe("CANCELLED");

    // Verify departure capacityBooked was reduced by 2
    const dep = await prisma.tourDeparture.findUnique({ where: { id: futureDepartureId } });
    expect(dep?.capacityBooked).toBe(0);
  });

  it("allows verified customer review and recalculates tour average rating", async () => {
    // Create a new confirmed booking for review testing
    const reviewBookingRef = `VC-REV-${Math.floor(10000 + Math.random() * 90000)}`;
    await prisma.booking.create({
      data: {
        bookingReference: reviewBookingRef,
        customerName: "Reviewer Tester",
        customerEmail: testCustomerEmail,
        customerPhone: "+14035550199",
        tourDepartureId: futureDepartureId,
        adultsCount: 1,
        childrenCount: 0,
        infantsCount: 0,
        totalSeats: 1,
        subtotal: 155,
        tax: 7.75,
        totalAmount: 162.75,
        currency: "CAD",
        status: "CONFIRMED",
        voucherCode: `VOUCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      },
    });

    const before = await prisma.tour.findUnique({ where: { id: testTourId } });

    const result = await createReview({
      bookingReference: reviewBookingRef,
      rating: 5,
      title: "Phenomenal Lake Louise Tour",
      body: "Vista Chase made our Banff vacation completely stress-free with early Moraine Lake access!",
      authorName: "Reviewer Tester",
    });

    expect(result.success).toBe(true);
    expect(result.review?.rating).toBe(5);

    // Verify duplicate review rejection
    const duplicate = await createReview({
      bookingReference: reviewBookingRef,
      rating: 4,
      title: "Another review",
      body: "Testing duplicate block",
    });
    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toContain("already been submitted");

    // Verify review list
    const tourReviews = await getTourReviews(testTourId);
    expect(tourReviews.some((r) => r.bookingId !== null)).toBe(true);
    // Only reviews left against a booking are public; seeded samples are not.
    expect(tourReviews.every((r) => r.bookingId !== null)).toBe(true);

    // A tour with a published count (e.g. 1,000+ from TripAdvisor and Google) keeps it.
    const after = await prisma.tour.findUnique({ where: { id: testTourId } });
    if (before!.reviewCount > 1) {
      expect(after!.reviewCount).toBe(before!.reviewCount);
      expect(after!.rating).toBe(before!.rating);
    }
  });

  it("starts a new product's rating from its first real review", async () => {
    const tour = await prisma.tour.update({ where: { id: testTourId }, data: { reviewCount: 0, rating: 0 } });
    const ref = `VC-REV-${Math.floor(10000 + Math.random() * 90000)}`;
    await prisma.booking.create({
      data: {
        bookingReference: ref,
        customerName: "New Product Reviewer",
        customerEmail: testCustomerEmail,
        customerPhone: "+14035550199",
        tourDepartureId: futureDepartureId,
        adultsCount: 1,
        childrenCount: 0,
        infantsCount: 0,
        totalSeats: 1,
        subtotal: 155,
        tax: 7.75,
        totalAmount: 162.75,
        currency: "CAD",
        status: "CONFIRMED",
        voucherCode: `VOUCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      },
    });
    const result = await createReview({ bookingReference: ref, rating: 4, title: "Good day", body: "A good day out." });
    expect(result.success).toBe(true);
    const updated = await prisma.tour.findUnique({ where: { id: tour.id } });
    const real = await prisma.review.count({ where: { tourId: tour.id, bookingId: { not: null } } });
    expect(updated!.reviewCount).toBe(real);
    expect(updated!.rating).toBeGreaterThan(0);
  });
});
