// Requests staff decide on (docs/ADMIN.md "Requests"): a guest's cancellation request from My
// trips (approved with the policy refund as of the request, or declined), and staff approving a
// booking left waiting for payment, including a card payment that finishes afterwards.

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { confirmPaidBooking, createBooking } from "@/modules/bookings/booking.repository";
import { setPaymentProviderForTests, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { dateOnly, timeOfDay } from "@/lib/utils/time";
import { requestCancellation } from "@/modules/admin/booking-requests";

const app = createApp();
let adminCookie = "";
let dispatcherCookie = "";
let customer = { id: "", email: "", name: "", role: "CUSTOMER" };
let customerCookie = "";
let otherCookie = "";
let tourId = "";
let n = 0;

const cookieFor = (u: { id: string; email: string; role: string; name: string }) =>
  `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role as never, name: u.name })}`;

/** A LOCAL departure `daysAhead` days from now (from 2 hours ahead when 0), on its own tour time. */
async function departure(daysAhead: number) {
  n += 1;
  const at = new Date(Date.now() + daysAhead * 86_400_000 + 2 * 3_600_000);
  const date = at.toISOString().slice(0, 10);
  const minute = String(n % 60).padStart(2, "0");
  return prisma.tourDeparture.create({
    data: { tourId, date: dateOnly(date), departureTime: timeOfDay(`23:${minute}`), capacityTotal: 8, price: 10000, status: "ACTIVE", inventorySource: "LOCAL" },
  });
}

async function book(daysAhead: number, opts: { paid?: boolean } = {}) {
  const dep = await departure(daysAhead);
  setPaymentProviderForTests(opts.paid === false ? unpaidProvider : null);
  const result = await createBooking({
    departureId: dep.id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: "+1 403 555 0142",
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    customerId: customer.id,
  });
  expect(result.success).toBe(true);
  setPaymentProviderForTests(null);
  return { dep, booking: await prisma.booking.findUniqueOrThrow({ where: { id: result.booking!.id }, include: { payments: true } }) };
}

const unpaidProvider: IPaymentProvider = {
  name: "stripe",
  async createPaymentIntent(req) {
    return { clientSecret: `pi_req_${req.bookingReference}_secret`, intentId: `pi_req_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: false };
  },
  async refundPayment(transactionId) {
    return { success: true, refundId: `re_${transactionId}` };
  },
};

const seats = async (id: string) => (await prisma.tourDeparture.findUniqueOrThrow({ where: { id } })).capacityBooked;

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const dispatcher = await prisma.user.findFirstOrThrow({ where: { role: "DISPATCHER" } });
  adminCookie = cookieFor(admin);
  dispatcherCookie = cookieFor(dispatcher);
  const c = await prisma.user.create({ data: { email: "request.guest@example.com", passwordHash: "x", name: "Request Guest", role: "CUSTOMER", emailVerified: true } });
  customer = { id: c.id, email: c.email, name: c.name, role: "CUSTOMER" };
  customerCookie = cookieFor(customer);
  const other = await prisma.user.create({ data: { email: "someone.else@example.com", passwordHash: "x", name: "Someone Else", role: "CUSTOMER" } });
  otherCookie = cookieFor({ ...other, role: "CUSTOMER" });
  const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED" } });
  tourId = tour.id;
});

afterEach(() => setPaymentProviderForTests(null));

describe("guest cancellation requests", () => {
  it("records one request per booking, shows it on My trips, and only the owner may ask", async () => {
    const { booking } = await book(10);
    const ask = (cookie: string) => request(app).post("/api/bookings/request-cancel").set("Cookie", cookie).send({ bookingReference: booking.bookingReference, reason: "Flight changed" });

    expect((await ask(otherCookie)).status).toBe(403);
    const first = await ask(customerCookie);
    expect(first.status).toBe(201);
    expect((await ask(customerCookie)).status).toBe(409);

    const flag = await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId: booking.id, type: "CANCEL_REQUEST" } });
    expect(flag).toMatchObject({ status: "OPEN", amountCents: 20000 });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CONFIRMED");

    const trips = await request(app).get("/api/account/trips").set("Cookie", customerCookie);
    const trip = trips.body.bookings.find((b: { bookingReference: string }) => b.bookingReference === booking.bookingReference);
    expect(trip.cancelRequest).toMatchObject({ status: "PENDING" });

    const list = await request(app).get("/api/admin/requests").set("Cookie", adminCookie);
    expect(list.status).toBe(200);
    expect(list.body.cancellations.some((r: { id: string }) => r.id === flag.id)).toBe(true);
  });

  it("approve cancels the booking, frees the seats and records the policy refund owed", async () => {
    const { dep, booking } = await book(10);
    expect((await requestCancellation(booking.bookingReference, "", customer.id)).status).toBe(201); // the route is rate limited
    const flag = await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId: booking.id, type: "CANCEL_REQUEST" } });
    expect(await seats(dep.id)).toBe(2);

    expect((await request(app).post(`/api/admin/requests/${flag.id}/approve`).set("Cookie", dispatcherCookie).send({ refund: "POLICY" })).status).toBe(403);
    const res = await request(app).post(`/api/admin/requests/${flag.id}/approve`).set("Cookie", adminCookie).send({ refund: "POLICY", notifyGuest: false });
    expect(res.status).toBe(200);
    expect(res.body.refundOwed).toBe(200);
    expect(await seats(dep.id)).toBe(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CANCELLED");
    expect((await prisma.bookingFlag.findUniqueOrThrow({ where: { id: flag.id } })).status).toBe("RESOLVED");
    expect(await prisma.bookingFlag.findFirst({ where: { bookingId: booking.id, type: "REFUND_DUE", amountCents: 20000 } })).not.toBeNull();

    expect((await request(app).post(`/api/admin/requests/${flag.id}/approve`).set("Cookie", adminCookie).send({ refund: "POLICY" })).status).toBe(409);
  });

  it("a private tour request inside its 72-hour deadline gets nothing back by the policy", async () => {
    const { dep, booking } = await book(1);
    const privateTour = await prisma.tour.findFirstOrThrow({ where: { category: "PRIVATE" } });
    await prisma.tourDeparture.update({ where: { id: dep.id }, data: { tourId: privateTour.id } });
    expect((await requestCancellation(booking.bookingReference, "", customer.id)).status).toBe(201); // the route is rate limited
    const flag = await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId: booking.id, type: "CANCEL_REQUEST" } });
    expect(flag.amountCents).toBe(0);
    const res = await request(app).post(`/api/admin/requests/${flag.id}/approve`).set("Cookie", adminCookie).send({ refund: "POLICY", notifyGuest: false });
    expect(res.status).toBe(200);
    expect(res.body.refundOwed).toBe(0);
    expect(await prisma.bookingFlag.findFirst({ where: { bookingId: booking.id, type: "REFUND_DUE" } })).toBeNull();
  });

  it("decline keeps the booking and tells My trips why", async () => {
    const { dep, booking } = await book(10);
    expect((await requestCancellation(booking.bookingReference, "", customer.id)).status).toBe(201); // the route is rate limited
    const flag = await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId: booking.id, type: "CANCEL_REQUEST" } });

    expect((await request(app).post(`/api/admin/flags/${flag.id}/resolve`).set("Cookie", adminCookie).send({ resolution: "done" })).status).toBe(400);
    const res = await request(app).post(`/api/admin/requests/${flag.id}/decline`).set("Cookie", adminCookie).send({ reason: "Private charter already arranged", notifyGuest: false });
    expect(res.status).toBe(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CONFIRMED");
    expect(await seats(dep.id)).toBe(2);

    const trips = await request(app).get("/api/account/trips").set("Cookie", customerCookie);
    const trip = trips.body.bookings.find((b: { bookingReference: string }) => b.bookingReference === booking.bookingReference);
    expect(trip.cancelRequest).toMatchObject({ status: "DECLINED", reason: "Private charter already arranged" });

    // A new request is allowed after a decline.
    expect((await request(app).post("/api/bookings/request-cancel").set("Cookie", customerCookie).send({ bookingReference: booking.bookingReference })).status).toBe(201);
  });
});

describe("staff approve a booking waiting for payment", () => {
  it("confirms it with an offline payment and catches a card payment that finishes afterwards", async () => {
    const { booking } = await book(10, { paid: false });
    expect(booking.status).toBe("PENDING_PAYMENT");

    const list = await request(app).get("/api/admin/requests").set("Cookie", adminCookie);
    expect(list.body.awaitingApproval.some((b: { id: string }) => b.id === booking.id)).toBe(true);

    expect((await request(app).post(`/api/admin/bookings/${booking.id}/approve`).set("Cookie", dispatcherCookie).send({ payment: { method: "CASH" } })).status).toBe(403);
    const res = await request(app).post(`/api/admin/bookings/${booking.id}/approve`).set("Cookie", adminCookie).send({ payment: { method: "ETRANSFER", reference: "ET-1" }, notifyGuest: false });
    expect(res.status).toBe(200);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { payments: true } });
    expect(after.status).toBe("CONFIRMED");
    expect(after.payments.find((p) => p.provider === "offline")).toMatchObject({ status: "SUCCEEDED", amount: 20000 });
    expect(after.payments.find((p) => p.provider !== "offline")?.status).toBe("FAILED");

    expect((await request(app).post(`/api/admin/bookings/${booking.id}/approve`).set("Cookie", adminCookie).send({ payment: { method: "CASH" } })).status).toBe(409);

    // The guest's card payment goes through later: paid twice, so staff are flagged.
    const intent = after.payments.find((p) => p.provider !== "offline")!;
    await confirmPaidBooking(booking.bookingReference, { amount: 20000, currency: "CAD", transactionId: intent.transactionId });
    await confirmPaidBooking(booking.bookingReference, { amount: 20000, currency: "CAD", transactionId: intent.transactionId });
    expect(await prisma.bookingFlag.count({ where: { bookingId: booking.id, type: "LATE_PAYMENT" } })).toBe(1);
  });

  it("confirms it unpaid with a payment due that a later card payment settles", async () => {
    const { booking } = await book(10, { paid: false });
    const res = await request(app).post(`/api/admin/bookings/${booking.id}/approve`).set("Cookie", adminCookie).send({ payment: { method: "UNPAID" }, notifyGuest: false });
    expect(res.status).toBe(200);
    const due = await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId: booking.id, type: "PAYMENT_DUE" } });
    expect(due).toMatchObject({ status: "OPEN", amountCents: 20000 });

    await confirmPaidBooking(booking.bookingReference, { amount: 20000, currency: "CAD", transactionId: booking.payments[0].transactionId });
    expect((await prisma.bookingFlag.findUniqueOrThrow({ where: { id: due.id } })).status).toBe("RESOLVED");
    expect(await prisma.bookingFlag.count({ where: { bookingId: booking.id, type: "LATE_PAYMENT" } })).toBe(0);
  });
});
