// Promo code check for the checkout: returns the discount the server will apply, in dollars.
// The booking itself re-prices everything (modules/pricing/booking-pricing.ts).

import { Router } from "express";
import prisma from "@/lib/db/prisma";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { parseOr400, z } from "@/lib/security/validate";
import { priceBooking, promoPercent } from "@/modules/pricing/booking-pricing";

const router = Router();

const quoteSchema = z.object({
  departureId: z.string().min(1).max(64),
  adultsCount: z.coerce.number().int().min(1).max(30),
  childrenCount: z.coerce.number().int().min(0).max(30).default(0),
  promoCode: z.string().trim().min(1).max(40),
});

router.post("/quote", rateLimitMiddleware("promo_quote", { maxRequests: 20, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const body = parseOr400(quoteSchema, req.body, res);
    if (!body) return;
    const percent = promoPercent(body.promoCode);
    if (percent === null) return res.status(404).json({ success: false, error: "Invalid or expired promo code" });

    const departure = await prisma.tourDeparture.findUnique({ where: { id: body.departureId }, include: { tour: true } });
    if (!departure) return res.status(404).json({ success: false, error: "Departure not found" });

    const totals = priceBooking(departure, { adults: body.adultsCount, children: body.childrenCount }, [], body.promoCode);
    return res.json({
      success: true,
      promoCode: body.promoCode.toUpperCase(),
      discountPercent: percent,
      discountAmount: totals.discountCents / 100,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
