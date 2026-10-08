import { Router } from "express";
import { getCheckoutDeparture } from "@/modules/departures/departure.repository";

const router = Router();

// Checkout data for the /book page: departure (or the next active one) plus active pickup stops
router.get("/checkout", async (req, res) => {
  try {
    const departureId = req.query.departureId as string | undefined;
    const checkout = await getCheckoutDeparture(departureId);
    if (!checkout) {
      return res.status(404).json({ success: false, error: "Departure not found" });
    }
    return res.json({ success: true, ...checkout });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Failed to load departure" });
  }
});

export default router;
