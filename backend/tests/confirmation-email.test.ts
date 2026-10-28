// Booking confirmation email with the PDF itinerary: sent once, only for confirmed bookings,
// failures recorded and retried, and a multi-day trip gets one email listing every day.

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import request from "supertest";
import { PDFDocument } from "pdf-lib";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { getEmailProvider, type EmailPayload } from "@/lib/email/email.provider";
import { setPaymentProviderForTests, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { signBookingLink } from "@/lib/security/signed-links";
import { createBooking } from "@/modules/bookings/booking.repository";
import { createPackageBooking } from "@/modules/bookings/package-booking";
import { retryFailedConfirmationEmails, sendConfirmationEmail } from "@/modules/bookings/confirmation-email";
import { linkTripBookings, tripOf } from "@/modules/bookings/trip";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

const sent: EmailPayload[] = [];
let fail = false;
const confirmations = () => sent.filter((e) => e.subject.startsWith("Your Vista Chase booking is confirmed"));

beforeAll(() => {
  vi.spyOn(getEmailProvider(), "sendEmail").mockImplementation(async (payload) => {
    if (fail) return { success: false, error: "provider down" };
    sent.push(payload);
    return { success: true, messageId: `m_${sent.length}` };
  });
});
afterEach(() => {
  sent.length = 0;
  fail = false;
  setPaymentProviderForTests(null);
});

async function departure(slug: string, date: string, price = 18900) {
  const tour = await prisma.tour.findUniqueOrThrow({ where: { slug } });
  return prisma.tourDeparture.create({
    data: { inventorySource: "LOCAL", tourId: tour.id, date: dateOnly(date), departureTime: timeOfDay("08:30"), capacityTotal: 12, capacityBooked: 0, capacityHeld: 0, price, status: "ACTIVE" },
  });
}

const guest = (email: string, departureId: string) => ({
  departureId,
  customerName: "Itinerary Guest",
  customerEmail: email,
  customerPhone: "+1 403 555 0199",
  adultsCount: 2,
  childrenCount: 0,
  infantsCount: 0,
  pickupCustomText: "Moxy Banff",
});

const pages = async (payload: EmailPayload) => (await PDFDocument.load(payload.attachments![0].content)).getPageCount();

describe("confirmation email", () => {
  it("goes out once, after confirmation, with the PDF itinerary attached", async () => {
    const dep = await departure("banff-highlights-tour", "2028-05-02");
    const { booking } = await createBooking(guest("one@example.com", dep.id)); // the test payment provider pays at once
    expect(booking?.status).toBe("CONFIRMED");
    const ref = booking!.bookingReference;

    expect(confirmations()).toHaveLength(1);
    const email = confirmations()[0];
    expect(email.to).toBe("one@example.com");
    expect(email.subject).toContain(ref);
    expect(email.text).toContain("Pickup: Moxy Banff");
    expect(email.attachments?.[0].filename).toBe(`Vista-Chase-itinerary-${ref}.pdf`);
    expect(email.attachments?.[0].content.subarray(0, 4).toString()).toBe("%PDF");
    expect(await pages(email)).toBe(2); // itinerary + voucher

    // A webhook retry or a second confirmation doesn't send it again.
    expect(await sendConfirmationEmail(ref)).toBe("already-sent");
    expect(confirmations()).toHaveLength(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { bookingReference: ref } })).confirmationEmailSentAt).not.toBeNull();
  });

  it("is never sent for a booking that isn't confirmed", async () => {
    const waiting: IPaymentProvider = {
      name: "stripe",
      async createPaymentIntent(req) {
        return { clientSecret: "pi_wait_secret", intentId: `pi_wait_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: false };
      },
      async refundPayment() {
        return { success: true, refundId: "re" };
      },
    };
    setPaymentProviderForTests(waiting);
    const dep = await departure("banff-highlights-tour", "2028-05-03");
    const { booking } = await createBooking(guest("pending@example.com", dep.id));
    expect(booking?.status).toBe("PENDING_PAYMENT");
    expect(await sendConfirmationEmail(booking!.bookingReference)).toBe("not-confirmed");
    expect(confirmations()).toHaveLength(0);
  });

  it("records a failed send and retries it later", async () => {
    fail = true;
    const dep = await departure("banff-highlights-tour", "2028-05-04");
    const { booking } = await createBooking(guest("retry@example.com", dep.id));
    expect(booking?.status).toBe("CONFIRMED"); // the booking stands even though the email failed
    const stored = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: booking!.bookingReference } });
    expect(stored.confirmationEmailSentAt).toBeNull();
    expect(stored.confirmationEmailError).toBe("provider down");
    expect(await prisma.auditLog.count({ where: { entityId: stored.id, action: "CONFIRMATION_EMAIL_FAILED" } })).toBe(1);

    fail = false;
    expect(await retryFailedConfirmationEmails()).toBeGreaterThanOrEqual(1);
    expect(confirmations().filter((e) => e.to === "retry@example.com")).toHaveLength(1);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: stored.id } });
    expect(after.confirmationEmailError).toBeNull();
    expect(after.confirmationEmailSentAt).not.toBeNull();
  });
});

describe("multi-day trips", () => {
  it("sends one email for a two-day package, listing both days under Day 1's reference", async () => {
    const d1 = await departure("banff-highlights-tour", "2028-06-10");
    const d2 = await departure("shared-tours-icefields-jasper", "2028-06-11", 22900);
    const result = await createPackageBooking({ ...guest("pkg@example.com", d1.id), packageSlug: "two-day-rockies-explorer", departureIds: [d1.id, d2.id] });
    expect(result.success).toBe(true);
    const [ref1, ref2] = result.bookings!.map((b) => b.bookingReference);

    expect(confirmations()).toHaveLength(1);
    const email = confirmations()[0];
    expect(email.subject).toContain(ref1);
    expect(email.text).toContain("Day 1:");
    expect(email.text).toContain("Day 2:");
    expect(email.text).toContain(ref2);
    if (process.env.SAVE_ITINERARY_PDF) (await import("node:fs")).writeFileSync(process.env.SAVE_ITINERARY_PDF, email.attachments![0].content);
    expect(await pages(email)).toBe(3); // itinerary + one voucher per day

    const day2 = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: ref2 } });
    expect(tripOf(day2.priceSnapshot, ref2)).toMatchObject({ reference: ref1, day: 2, days: 2 });
  });

  it("lets staff link a private multi-day trip and shows every day on the voucher", async () => {
    const tour = await prisma.tour.findFirstOrThrow({ where: { category: "PRIVATE" } });
    const refs: string[] = [];
    for (const date of ["2028-07-03", "2028-07-01", "2028-07-02"]) {
      const dep = await departure(tour.slug, date, 99900);
      const { booking } = await createBooking({ ...guest("private@example.com", dep.id), adultsCount: 4 });
      refs.push(booking!.bookingReference);
    }
    const other = await departure(tour.slug, "2028-07-04", 99900);
    const stranger = (await createBooking(guest("someone-else@example.com", other.id))).booking!.bookingReference;
    sent.length = 0;
    expect(await linkTripBookings([refs[0], stranger], "Three-Day Rockies Discovery")).toEqual({ error: "These bookings are for different guests (emails don't match)." });

    const linked = await linkTripBookings(refs, "Three-Day Rockies Discovery");
    expect("references" in linked && linked.references).toEqual([refs[1], refs[2], refs[0]]); // ordered by date
    expect(await sendConfirmationEmail(refs[0], { force: true })).toBe("sent");
    expect(confirmations()).toHaveLength(1);
    expect(confirmations()[0].subject).toContain(refs[1]); // Day 1 = July 1
    expect(confirmations()[0].text).toContain("Day 3:");
    expect(await pages(confirmations()[0])).toBeGreaterThanOrEqual(4); // itinerary (may run to two pages) + 3 vouchers

    const res = await request(createApp()).get("/api/bookings").query({ ref: refs[2], t: signBookingLink(refs[2], "voucher") });
    expect(res.status).toBe(200);
    expect(res.body.booking.trip).toMatchObject({ title: "Three-Day Rockies Discovery", reference: refs[1], day: 2 });
    expect(res.body.booking.trip.days.map((d: { bookingReference: string }) => d.bookingReference)).toEqual([refs[1], refs[2], refs[0]]);
    expect(res.body.booking.trip.days[0].voucherPath).toMatch(/^\/booking\/VC-.+\/voucher\?t=/);
  });
});
