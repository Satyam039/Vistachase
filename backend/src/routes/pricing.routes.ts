// Promo code check for the checkout: returns the discount the server will apply, in dollars.
// The booking itself re-prices everything (modules/pricing/booking-pricing.ts).

import { Router } from "express";
import prisma from "@/lib/db/prisma";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { parseOr400, z } from "@/lib/security/validate";
import { priceBooking } from "@/modules/pricing/booking-pricing";
import { lookupPromo, promoLabel } from "@/modules/pricing/promo-codes";
import { findActiveAffiliateByCode } from "@/modules/affiliates/affiliate.repository";
import { findPackage, packageCategories } from "@/modules/bookings/package-booking";

const router = Router();

const quoteSchema = z.object({
  departureId: z.string().min(1).max(64),
  adultsCount: z.coerce.number().int().min(1).max(30),
  childrenCount: z.coerce.number().int().min(0).max(30).default(0),
  infantsCount: z.coerce.number().int().min(0).max(10).default(0),
  promoCode: z.string().trim().min(1).max(40),
});

// A promo code on its own (package checkouts, which price several days): what it takes off.
// `packageSlug` (optional): checks the code's "Where does it apply" against the package's tours.
const promoSchema = z.object({ promoCode: z.string().trim().min(1).max(40), packageSlug: z.string().trim().max(80).optional() });
router.post("/promo", rateLimitMiddleware("promo_quote", { maxRequests: 20, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const body = parseOr400(promoSchema, req.body, res);
    if (!body) return;
    const pkg = body.packageSlug ? findPackage(body.packageSlug) : null;
    const found = await lookupPromo(body.promoCode, prisma, new Date(), pkg ? await packageCategories(pkg) : undefined);
    if (!found.ok) {
      const partner = found.reason === "unknown" ? await findActiveAffiliateByCode(body.promoCode) : null;
      if (partner) {
        return res.json({ success: true, promoCode: partner.code, discountPercent: 0, amountOff: 0, isPartnerVoucher: true, message: `Partner code ${partner.code} applied.` });
      }
      return res.status(404).json({ success: false, error: found.error });
    }
    return res.json({
      success: true,
      promoCode: found.promo.code,
      discountPercent: found.promo.percentOff ?? 0,
      amountOff: (found.promo.amountOffCents ?? 0) / 100,
      message: `Code ${found.promo.code} applied: ${promoLabel(found.promo)}.`,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/quote", rateLimitMiddleware("promo_quote", { maxRequests: 20, windowSeconds: 60 }), async (req, res, next) => {
  try {
    const body = parseOr400(quoteSchema, req.body, res);
    if (!body) return;
    const departure = await prisma.tourDeparture.findUnique({ where: { id: body.departureId }, include: { tour: true } });
    const found = await lookupPromo(body.promoCode, prisma, new Date(), departure ? [departure.tour?.category] : undefined);
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
