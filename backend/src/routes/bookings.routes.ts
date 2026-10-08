import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { Router } from "express";
import {
  createBooking,
  getBookingByReference,
  cancelBooking,
} from "@/modules/bookings/booking.repository";
import { getAuthenticatedUser } from "@/lib/auth/admin-guard";

const router = Router();

router.post("/", rateLimitMiddleware("booking_create", { maxRequests: 5, windowSeconds: 60 }), async (req, res) => {
  try {
    const {
      departureId,
      holdToken,
      customerName,
      customerEmail,
      customerPhone,
      pickupStopId,
      pickupCustomText,
      adultsCount,
      childrenCount,
      infantsCount,
      specialRequests,
      addOns,
      paymentProvider,
    } = req.body ?? {};

    if (!departureId || !customerName || !customerEmail) {
      return res.status(400).json({ success: false, error: "Missing required booking details" });
    }

    const result = await createBooking({
      departureId,
      holdToken,
      customerName,
      customerEmail,
      customerPhone: customerPhone || "+1-000-000-0000",
      pickupStopId,
      pickupCustomText,
      adultsCount: parseInt(adultsCount || "1", 10),
      childrenCount: parseInt(childrenCount || "0", 10),
      infantsCount: parseInt(infantsCount || "0", 10),
      specialRequests,
      addOns: addOns || [],
      // Partner referral: the frontend stores ?ref=<code> in this cookie for 30 days.
      affiliateCode: typeof req.cookies?.vc_ref === "string" ? req.cookies.vc_ref : undefined,
      paymentProvider: paymentProvider || "mock",
    });

    if (!result.success) {
      return res.status(409).json({ success: false, error: result.error });
    }

    return res.json({ success: true, booking: result.booking });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Booking failed" });
  }
});

router.get("/", async (req, res) => {
  try {
    const ref = req.query.ref as string | undefined;

    if (!ref) {
      return res.status(400).json({ success: false, error: "Missing booking reference" });
    }

    const booking = await getBookingByReference(ref);
    if (!booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    // Public by reference (voucher page), restrict PII
    const publicBooking = {
      bookingReference: booking.bookingReference,
      status: booking.status,
      customerName: booking.customerName,
      adultsCount: booking.adultsCount,
      childrenCount: booking.childrenCount,
      infantsCount: booking.infantsCount,
      totalSeats: booking.totalSeats,
      pickupTime: booking.pickupTime,
      specialRequests: booking.specialRequests,
      voucherCode: booking.voucherCode,
      qrCodeUrl: booking.qrCodeUrl,
      tourDeparture: booking.tourDeparture,
      pickupStop: booking.pickupStop,
      createdAt: booking.createdAt,
    };
    return res.json({ success: true, booking: publicBooking });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Failed to retrieve booking" });
  }
});

router.post("/cancel", rateLimitMiddleware("booking_cancel", { maxRequests: 5, windowSeconds: 60 }), async (req, res) => {
  try {
    const { bookingReference, email } = req.body ?? {};

    if (!bookingReference) {
      return res.status(400).json({ error: "Booking reference is required." });
    }

    // Optional auth check: if user is logged in, use their email; otherwise use email from body
    const payload = getAuthenticatedUser(req);
    const customerEmail = payload?.email ?? email;

    const result = await cancelBooking(bookingReference, customerEmail);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      success: true,
      message: result.message,
      booking: result.booking,
    });
  } catch (error) {
    console.error("Cancellation API error:", error);
    return res.status(500).json({ error: "Failed to process cancellation." });
  }
});

export default router;
