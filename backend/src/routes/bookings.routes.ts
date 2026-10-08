// Booking API. Create a booking (the server prices it and starts payment), read it for the voucher
// page (signed link, owner or staff only) and cancel it (owner only). The client never chooses
// the payment provider or sends prices.

import { Router } from "express";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { cancelBooking, createBooking, getBookingByReference } from "@/modules/bookings/booking.repository";
import { getAuthenticatedStaff, getAuthenticatedUser } from "@/lib/auth/admin-guard";
import { verifyBookingLink } from "@/lib/security/signed-links";
import { emailSchema, parseOr400, referenceSchema, z } from "@/lib/security/validate";

const router = Router();

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
});

router.post("/", rateLimitMiddleware("booking_create", { maxRequests: 5, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const body = parseOr400(createSchema, req.body, res);
    if (!body) return;
    const user = getAuthenticatedUser(req);
    const result = await createBooking({
      ...body,
      customerId: user && user.email.toLowerCase() === body.customerEmail ? user.userId : undefined,
      // Partner referral: the frontend stores ?ref=<code> in this cookie for 30 days.
      affiliateCode: typeof req.cookies?.vc_ref === "string" ? req.cookies.vc_ref : undefined,
    });
    if (!result.success) return res.status(409).json({ success: false, error: result.error });
    return res.json({ success: true, booking: result.booking, payment: result.payment ?? null });
  } catch (error) {
    next(error);
  }
});

const readSchema = z.object({ ref: referenceSchema, t: z.string().max(64).optional() });

// The voucher page: open with the signed link from the confirmation email, as the signed-in owner,
// or as staff. The reference alone is not enough.
router.get("/", rateLimitMiddleware("booking_read", { maxRequests: 30, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const query = parseOr400(readSchema, req.query, res);
    if (!query) return;
    const booking = await getBookingByReference(query.ref);
    const user = getAuthenticatedUser(req);
    const allowed =
      booking &&
      (verifyBookingLink(booking.bookingReference, "voucher", query.t) ||
        (user && user.email.toLowerCase() === booking.customerEmail.toLowerCase()) ||
        getAuthenticatedStaff(req));
    if (!booking || !allowed) return res.status(404).json({ success: false, error: "Booking not found" });

    return res.json({
      success: true,
      booking: {
        bookingReference: booking.bookingReference,
        status: booking.status,
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
        items: booking.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price / 100 })),
        tourDeparture: {
          date: booking.tourDeparture.date,
          departureTime: booking.tourDeparture.departureTime,
          returnTime: booking.tourDeparture.returnTime,
          tour: booking.tourDeparture.tour ? { title: booking.tourDeparture.tour.title, slug: booking.tourDeparture.tour.slug } : null,
          shuttleRoute: booking.tourDeparture.shuttleRoute ? { name: booking.tourDeparture.shuttleRoute.name } : null,
        },
        pickupStop: booking.pickupStop ? { name: booking.pickupStop.name, address: booking.pickupStop.address, instructions: booking.pickupStop.instructions } : null,
        createdAt: booking.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

const cancelSchema = z.object({ bookingReference: referenceSchema, email: emailSchema.optional(), t: z.string().max(64).optional() });

// Cancel: the signed-in owner, the booking's email, or the voucher link's token.
router.post("/cancel", rateLimitMiddleware("booking_cancel", { maxRequests: 5, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const body = parseOr400(cancelSchema, req.body, res);
    if (!body) return;
    const user = getAuthenticatedUser(req);
    let customerEmail = user?.email ?? body.email;
    if (!customerEmail && verifyBookingLink(body.bookingReference, "voucher", body.t)) {
      customerEmail = (await getBookingByReference(body.bookingReference))?.customerEmail;
    }
    if (!customerEmail) {
      return res.status(400).json({ success: false, error: "Enter the email address used for the booking." });
    }
    const result = await cancelBooking(body.bookingReference, customerEmail);
    if (!result.success) return res.status(400).json({ success: false, error: result.error });
    return res.json({ success: true, message: result.message, refundedAmount: result.refundedAmount, booking: { bookingReference: result.booking!.bookingReference, status: result.booking!.status } });
  } catch (error) {
    next(error);
  }
});

export default router;
