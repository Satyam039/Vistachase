// Promo code check for the checkout: returns the discount the server will apply, in dollars.
// The booking itself re-prices everything (modules/pricing/booking-pricing.ts).

import { Router } from "express";
import prisma from "@/lib/db/prisma";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { parseOr400, z } from "@/lib/security/validate";
import { priceBooking } from "@/modules/pricing/booking-pricing";
import { lookupPromo, promoLabel } from "@/modules/pricing/promo-codes";
import { findActiveAffiliateByCode } from "@/modules/affiliates/affiliate.repository";

const router = Router();

const quoteSchema = z.object({
  departureId: z.string().min(1).max(64),
  adultsCount: z.coerce.number().int().min(1).max(30),
  childrenCount: z.coerce.number().int().min(0).max(30).default(0),
  infantsCount: z.coerce.number().int().min(0).max(10).default(0),
  promoCode: z.string().trim().min(1).max(40),
});

router.post("/quote", rateLimitMiddleware("promo_quote", { maxRequests: 20, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const body = parseOr400(quoteSchema, req.body, res);
    if (!body) return;
    const found = await lookupPromo(body.promoCode);
    if (!found.ok) {
      // A partner's voucher code: accepted (it credits the partner) but takes nothing off.
      const partner = found.reason === "unknown" ? await findActiveAffiliateByCode(body.promoCode) : null;
      if (partner) {
        return res.json({
          success: true,
          promoCode: partner.code,
          discountPercent: 0,
          amountOff: 0,
          discountAmount: 0,
          isPartnerVoucher: true,
          partnerName: partner.name,
          message: `Partner code ${partner.code} applied.`,
        });
      }
      return res.status(404).json({ success: false, error: found.error });
    }

    const departure = await prisma.tourDeparture.findUnique({ where: { id: body.departureId }, include: { tour: true } });
    if (!departure) return res.status(404).json({ success: false, error: "Departure not found" });

    const totals = priceBooking(departure, { adults: body.adultsCount, children: body.childrenCount, infants: body.infantsCount }, [], found.promo);
    return res.json({
      success: true,
      promoCode: found.promo.code,
      // Percent codes: discountPercent; fixed-amount codes: amountOff (dollars, at most the fare).
      discountPercent: found.promo.percentOff ?? 0,
      amountOff: (found.promo.amountOffCents ?? 0) / 100,
      discountAmount: totals.discountCents / 100,
      message: `Code ${found.promo.code} applied: ${promoLabel(found.promo)}.`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
