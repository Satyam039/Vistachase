// Booking API. Create a booking (the server prices it and starts payment), read it for the voucher
// page (signed link, owner or staff only) and cancel it (owner only). The client never chooses
// the payment provider or sends prices.

import { Router, type Request } from "express";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { cancelBooking, createBooking, getBookingByReference, paymentState } from "@/modules/bookings/booking.repository";
import { getAuthenticatedStaff, getAuthenticatedUser, getSessionUser, ownsBooking } from "@/lib/auth/admin-guard";
import { signBookingLink, verifyBookingLink } from "@/lib/security/signed-links";
import { paymentSummary } from "@/modules/bookings/deposit";
import { startBalancePayment } from "@/modules/bookings/deposit-payments";
import { requestCancellation } from "@/modules/admin/booking-requests";
import { createPackageBooking, PACKAGES } from "@/modules/bookings/package-booking";
import { syncPendingPayments } from "@/modules/bookings/payment-sync";
import { itineraryPdf, voucherPdf } from "@/modules/bookings/voucher-pdf";
import { tripBookings, tripOf, tripSummary } from "@/modules/bookings/trip";
import { emailSchema, parseOr400, referenceSchema, z } from "@/lib/security/validate";
import { airportTransferSchema } from "@/modules/bookings/airport-transfer";

const router = Router();

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;

const count = (max: number) => z.coerce.number().int().min(0).max(max);
const createSchema = z.object({
  departureId: z.string().min(1).max(64),
  holdToken: z.string().max(128).optional(),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: emailSchema,
  customerPhone: z.string().trim().min(7).max(32),
  pickupStopId: z.string().max(64).optional(),
  pickupCustomText: z.string().trim().max(200).optional(),
  adultsCount: count(30).refine((n) => n >= 1, "At least one adult is required"),
  childrenCount: count(30).default(0),
  infantsCount: count(10).default(0),
  specialRequests: z.string().trim().max(1000).optional(),
  addOns: z.array(z.object({ id: z.string().max(40).optional(), name: z.string().max(120).optional() })).max(10).default([]),
  promoCode: z.string().trim().max(40).optional(),
  paymentPlan: z.enum(["FULL", "DEPOSIT"]).default("FULL"),
  airportTransfer: airportTransferSchema.optional(),
});

router.post("/", rateLimitMiddleware("booking_create", { maxRequests: 5, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const body = parseOr400(createSchema, req.body, res);
    if (!body) return;
    // Optional per-attempt key from the checkout: a retry with it returns the same booking.
    const rawKey = req.get("Idempotency-Key");
    if (rawKey !== undefined && !IDEMPOTENCY_KEY.test(rawKey)) {
      return res.status(400).json({ success: false, error: "Invalid Idempotency-Key header." });
    }
    const user = getAuthenticatedUser(req);
    const result = await createBooking({
      ...body,
      // Checkout no longer offers add-ons (2026-10-27); any sent by an old page are ignored, so
      // the total is the fare alone. Staff Quick Book still records add-ons.
      addOns: [],
      idempotencyKey: rawKey,
      customerId: user && user.email.toLowerCase() === body.customerEmail ? user.userId : undefined,
      // Partner referral: the frontend stores ?ref=<code> in this cookie for 30 days.
      affiliateCode: typeof req.cookies?.vc_ref === "string" ? req.cookies.vc_ref : undefined,
    });
    if (!result.success) return res.status(409).json({ success: false, error: result.error });
    return res.json({ success: true, booking: result.booking, payment: result.payment ?? null, nextStep: result.nextStep, replayed: result.replayed ?? false });
  } catch (error) {
    next(error);
  }
});

const packageSchema = z.object({
  packageSlug: z.enum(PACKAGES.map((p) => p.slug) as [string, ...string[]]),
  departureIds: z.array(z.string().min(1).max(64)).min(2).max(5),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: emailSchema,
  customerPhone: z.string().trim().min(7).max(32),
  pickupStopId: z.string().max(64).optional(),
  pickupCustomText: z.string().trim().max(200).optional(),
  adultsCount: count(30).refine((n) => n >= 1, "At least one adult is required"),
  childrenCount: count(30).default(0),
  infantsCount: count(10).default(0),
  specialRequests: z.string().trim().max(1000).optional(),
});

// A package (modules/bookings/package-booking.ts): one booking per day, one payment for all of them.
router.post("/package", rateLimitMiddleware("booking_create", { maxRequests: 5, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const body = parseOr400(packageSchema, req.body, res);
    if (!body) return;
    const rawKey = req.get("Idempotency-Key");
    if (rawKey !== undefined && !IDEMPOTENCY_KEY.test(rawKey)) {
      return res.status(400).json({ success: false, error: "Invalid Idempotency-Key header." });
    }
    const user = getAuthenticatedUser(req);
    const result = await createPackageBooking({
      ...body,
      idempotencyKey: rawKey,
      customerId: user && user.email.toLowerCase() === body.customerEmail ? user.userId : undefined,
      affiliateCode: typeof req.cookies?.vc_ref === "string" ? req.cookies.vc_ref : undefined,
    });
    if (!result.success) return res.status(409).json({ success: false, error: result.error });
    return res.json({ success: true, bookings: result.bookings, totalAmount: result.totalAmount, currency: result.currency, payment: result.payment ?? null, nextStep: result.nextStep, replayed: result.replayed ?? false });
  } catch (error) {
    next(error);
  }
});

const readSchema = z.object({ ref: referenceSchema, t: z.string().max(64).optional() });

/**
 * The booking, if this request may read it (voucher link, owner or staff). A payment still waiting
 * on Stripe's webhook is first checked with Stripe itself (modules/bookings/payment-sync.ts), so the
 * checkout and the voucher show a paid booking as confirmed even if the webhook never arrives.
 */
async function readableBooking(req: Request, ref: string, token: string | undefined) {
  let booking = await getBookingByReference(ref);
  const allowed =
    booking &&
    (verifyBookingLink(booking.bookingReference, "voucher", token) || ownsBooking(await getSessionUser(req), booking) || (await getAuthenticatedStaff(req)));
  if (!booking || !allowed) return null;
  if (booking.payments.some((p) => p.status === "PENDING") && (await syncPendingPayments(booking.bookingReference))) {
    booking = await getBookingByReference(ref);
  }
  return booking;
}

// The voucher as a PDF file, with the same access as the voucher itself. In-app browsers (Gmail,
// WhatsApp) can't print the voucher page, but they can download and open this.
router.get("/voucher.pdf", rateLimitMiddleware("booking_read", { maxRequests: 30, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const query = parseOr400(readSchema, req.query, res);
    if (!query) return;
    const booking = await readableBooking(req, query.ref, query.t);
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });
    // A day of a multi-day trip downloads the whole trip: the itinerary, then every day's voucher.
    const trip = tripOf(booking.priceSnapshot, booking.bookingReference);
    const file = trip ? await itineraryPdf(await tripBookings(booking.bookingReference), trip) : await voucherPdf(booking);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="vista-chase-${trip ? `itinerary-${trip.reference}` : `voucher-${booking.bookingReference}`}.pdf"`);
    res.setHeader("Content-Length", String(file.byteLength));
    res.setHeader("Cache-Control", "private, no-store");
    return res.end(Buffer.from(file));
  } catch (error) {
    next(error);
  }
});

// The voucher page: open with the signed link from the confirmation email, as the signed-in owner,
// or as staff. The reference alone is not enough.
router.get("/", rateLimitMiddleware("booking_read", { maxRequests: 30, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const query = parseOr400(readSchema, req.query, res);
    if (!query) return;
    const booking = await readableBooking(req, query.ref, query.t);
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });
    // The other days of a multi-day trip, each with its own voucher link (same guest, bought together).
    const trip = tripOf(booking.priceSnapshot, booking.bookingReference);
    const tripDays = trip ? await tripSummary(trip) : null;

    return res.json({
      success: true,
      booking: {
        trip: tripDays ? { ...tripDays, days: tripDays.days.map((d) => ({ ...d, voucherPath: `/booking/${encodeURIComponent(d.bookingReference)}/voucher?t=${signBookingLink(d.bookingReference, "voucher")}` })) } : null,
        bookingReference: booking.bookingReference,
        status: booking.status,
        paymentStatus: paymentState(booking, booking.payments),
        customerName: booking.customerName,
        adultsCount: booking.adultsCount,
        childrenCount: booking.childrenCount,
        infantsCount: booking.infantsCount,
        totalSeats: booking.totalSeats,
        pickupTime: booking.pickupTime,
        pickupCustomText: booking.pickupCustomText,
        specialRequests: booking.specialRequests,
        voucherCode: booking.voucherCode,
        qrCodeUrl: booking.qrCodeUrl,
        subtotal: booking.subtotal / 100,
        addOnsTotal: booking.addOnsTotal / 100,
        totalAmount: booking.totalAmount / 100,
        currency: booking.currency,
        ...paymentSummary(booking, booking.payments),
        items: booking.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price / 100 })),
        tourDeparture: {
          date: booking.tourDeparture.date,
          departureTime: booking.tourDeparture.departureTime,
          returnTime: booking.tourDeparture.returnTime,
          tour: booking.tourDeparture.tour ? { title: booking.tourDeparture.tour.title, slug: booking.tourDeparture.tour.slug, featuredImage: booking.tourDeparture.tour.featuredImage } : null,
          shuttleRoute: booking.tourDeparture.shuttleRoute ? { name: booking.tourDeparture.shuttleRoute.name } : null,
        },
        pickupStop: booking.pickupStop
          ? { name: booking.pickupStop.name, town: booking.pickupStop.town, address: booking.pickupStop.address, instructions: booking.pickupStop.instructions, latitude: booking.pickupStop.latitude, longitude: booking.pickupStop.longitude }
          : null,
        createdAt: booking.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// `email` is still accepted from older pages but proves nothing on its own, so it is ignored.
const cancelSchema = z.object({ bookingReference: referenceSchema, email: emailSchema.optional(), t: z.string().max(64).optional() });

// Cancel: the signed-in owner (ownsBooking) or the voucher link's signed token. An email address
// alone is not enough: anyone who knows a guest's email and reference could cancel their trip.
router.post("/cancel", rateLimitMiddleware("booking_cancel", { maxRequests: 5, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const body = parseOr400(cancelSchema, req.body, res);
    if (!body) return;
    const booking = await getBookingByReference(body.bookingReference);
    const allowed = booking && (verifyBookingLink(booking.bookingReference, "voucher", body.t) || ownsBooking(await getSessionUser(req), booking));
    if (!booking || !allowed) {
      return res.status(403).json({ success: false, error: "Open the cancel link in your confirmation email, or sign in to the account that made the booking." });
    }
    const result = await cancelBooking(body.bookingReference, booking.customerEmail);
    if (!result.success) return res.status(400).json({ success: false, error: result.error });
    return res.json({ success: true, message: result.message, refundedAmount: result.refundedAmount, booking: { bookingReference: result.booking!.bookingReference, status: result.booking!.status } });
  } catch (error) {
    next(error);
  }
});

const requestCancelSchema = z.object({ bookingReference: referenceSchema, reason: z.string().trim().max(500).default(""), t: z.string().max(64).optional() });

// Ask staff to cancel (My trips): the signed-in owner or the voucher link's signed token, as for
// /cancel. Nothing changes until staff approve or decline it in admin (docs/ADMIN.md "Requests").
router.post("/request-cancel", rateLimitMiddleware("booking_request_cancel", { maxRequests: 5, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const body = parseOr400(requestCancelSchema, req.body, res);
    if (!body) return;
    const booking = await getBookingByReference(body.bookingReference);
    const user = await getSessionUser(req);
    const allowed = booking && (verifyBookingLink(booking.bookingReference, "voucher", body.t) || ownsBooking(user, booking));
    if (!booking || !allowed) {
      return res.status(403).json({ success: false, error: "Open the link in your confirmation email, or sign in to the account that made the booking." });
    }
    const result = await requestCancellation(booking.bookingReference, body.reason, user?.userId ?? null);
    if (result.status !== 201) return res.status(result.status).json({ success: false, error: result.error });
    return res.status(201).json({ success: true, request: result.request });
  } catch (error) {
    next(error);
  }
});

const payBalanceSchema = z.object({ bookingReference: referenceSchema, t: z.string().max(64).optional() });

// Deposit bookings: pay what is still owed, from the voucher page (its signed token) or as the
// signed-in owner (ownsBooking) or staff. Returns the card form's client secret, or paid: true when nothing is due.
router.post("/pay-balance", rateLimitMiddleware("booking_pay_balance", { maxRequests: 10, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const body = parseOr400(payBalanceSchema, req.body, res);
    if (!body) return;
    const booking = await getBookingByReference(body.bookingReference);
    const allowed =
      booking &&
      (verifyBookingLink(booking.bookingReference, "voucher", body.t) ||
        ownsBooking(await getSessionUser(req), booking) ||
        (await getAuthenticatedStaff(req)));
    if (!booking || !allowed) return res.status(404).json({ success: false, error: "Booking not found" });
    const result = await startBalancePayment(booking.bookingReference);
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
