// Manage booking (modules/bookings/manage-booking.ts) and the itinerary on the voucher
// (modules/bookings/tour-itinerary.ts): the guest changes the lead name and phone with the emailed
// link, asks for a new date (a request staff answer), and the PDFs carry the tour's itinerary.

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { createBooking, getBookingByReference } from "@/modules/bookings/booking.repository";
import { signBookingLink } from "@/lib/security/signed-links";
import { dateOnly, timeOfDay } from "@/lib/utils/time";
import { tourItinerary, WEBSITE_ITINERARIES } from "@/modules/bookings/tour-itinerary";
import { voucherPdf } from "@/modules/bookings/voucher-pdf";

const app = createApp();
let tourId = "";
let n = 0;

async function book() {
  n += 1;
  const date = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  const dep = await prisma.tourDeparture.create({
    data: { tourId, date: dateOnly(date), departureTime: timeOfDay(`22:${String(n).padStart(2, "0")}`), capacityTotal: 8, price: 10000, status: "ACTIVE", inventorySource: "LOCAL" },
  });
  const result = await createBooking({
    departureId: dep.id,
    customerName: "Manage Guest",
    customerEmail: "manage.guest@example.com",
    customerPhone: "+1 403 555 0100",
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
  });
  expect(result.success).toBe(true);
  return result.booking!.bookingReference;
}

beforeAll(async () => {
  const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED" } });
  tourId = tour.id;
});

describe("Manage booking", () => {
  it("changes the lead guest's name and phone with the voucher link, and logs it", async () => {
    const ref = await book();
    const t = signBookingLink(ref, "voucher");
    const res = await request(app).post("/api/bookings/manage/details").send({ bookingReference: ref, t, customerName: "Asha Verma", customerPhone: "+91 98765 43210" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, changed: true, booking: { customerName: "Asha Verma", customerPhone: "+91 98765 43210" } });
    const row = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: ref } });
    expect(row.customerName).toBe("Asha Verma");
    expect(row.customerEmail).toBe("manage.guest@example.com");
    expect(await prisma.auditLog.count({ where: { action: "GUEST_DETAILS_CHANGED", entityId: row.id } })).toBe(1);
  });

  it("refuses without the signed link", async () => {
    const ref = await book();
    const res = await request(app).post("/api/bookings/manage/details").send({ bookingReference: ref, t: "nope", customerName: "Someone Else" });
    expect(res.status).toBe(403);
    expect((await prisma.booking.findUniqueOrThrow({ where: { bookingReference: ref } })).customerName).toBe("Manage Guest");
  });

  it("raises one change request for staff and leaves the booking as it is", async () => {
    const ref = await book();
    const t = signBookingLink(ref, "voucher");
    const newDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const first = await request(app).post("/api/bookings/manage/change-date").send({ bookingReference: ref, t, newDate, preferredTime: "7:30 AM", note: "Flight moved" });
    expect(first.status).toBe(201);
    const row = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: ref }, include: { flags: true } });
    expect(row.flags).toHaveLength(1);
    expect(row.flags[0]).toMatchObject({ type: "OTHER", status: "OPEN" });
    expect(row.flags[0].note).toContain(`to ${newDate} (7:30 AM)`);
    const again = await request(app).post("/api/bookings/manage/change-date").send({ bookingReference: ref, t, newDate });
    expect(again.status).toBe(409);
    const past = await request(app).post("/api/bookings/manage/change-date").send({ bookingReference: ref, t, newDate: "2020-01-01" });
    expect([400, 409]).toContain(past.status);
  });
});

describe("Itinerary on the voucher", () => {
  it("uses the website's steps for the doc tours and the catalog tab for the rest", () => {
    expect(tourItinerary({ slug: "shared-tours-icefields-jasper", tabs: [] })?.steps).toBe(WEBSITE_ITINERARIES["shared-tours-icefields-jasper"]);
    const fromTab = tourItinerary({
      slug: "some-tour",
      tabs: [{ label: "Itinerary", sections: [{ steps: [{ time: "9 AM", text: "Lake Louise" }], items: ["Moraine Lake"], note: "Order may change." }] }],
    });
    expect(fromTab).toEqual({ steps: [{ time: "9 AM", text: "Lake Louise" }, { time: "", text: "Moraine Lake" }], note: "Order may change." });
    expect(tourItinerary({ slug: "x", tabs: [{ label: "Overview", sections: [] }] })).toBeNull();
  });

  it("builds the voucher PDF with the itinerary section", async () => {
    const ref = await book();
    const bytes = await voucherPdf((await getBookingByReference(ref))!);
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
