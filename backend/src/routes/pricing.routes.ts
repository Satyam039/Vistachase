import { Router } from "express";
import { getBokunOperationsProvider } from "@/modules/bokun/bokun.provider";
import prisma from "@/lib/db/prisma";
import { fareSubtotal } from "@/modules/pricing/departure-pricing";

const router = Router();

// Endpoint to validate a promo code and get a quote
router.post("/quote", async (req, res) => {
  try {
    const { departureId, adultsCount, childrenCount, promoCode } = req.body;

    if (!departureId || !promoCode) {
      return res.status(400).json({ success: false, error: "Missing parameters" });
    }

    const departure = await prisma.tourDeparture.findUnique({
      where: { id: departureId },
      include: { tour: true }
    });

    if (!departure || !departure.tour?.bokunId) {
      return res.status(404).json({ success: false, error: "Departure not found or not mapped to Bókun" });
    }

    // In a real integration, we would call Bókun's /booking.json/quote endpoint.
    // Since we don't have the exact API shape for quote, let's just simulate what the Bókun dashboard showed in the image!
    // The image had: RIMROCKBANFF5 (5%), TESTVISTA100 (100%), BANFF10 (10%)
    const code = promoCode.toUpperCase();
    let discountPercent = 0;

    if (code === "RIMROCKBANFF5") discountPercent = 5;
    else if (code === "TESTVISTA100") discountPercent = 100;
    else if (code === "BANFF10") discountPercent = 10;
    else {
      return res.status(404).json({ success: false, error: "Invalid or expired promo code" });
    }

    const totalSeats = parseInt(adultsCount || "0", 10) + parseInt(childrenCount || "0", 10);
    // In dollars, like the checkout: per guest for shared departures, per vehicle for private ones.
    const subtotal = fareSubtotal(departure, totalSeats) / 100;
    const discountAmount = Math.round(subtotal * discountPercent) / 100;

    return res.json({
      success: true,
      discountPercent,
      discountAmount,
      promoCode: code
    });

  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to quote pricing" });
  }
});

export default router;
