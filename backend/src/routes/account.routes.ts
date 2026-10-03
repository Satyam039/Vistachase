import { Router } from "express";
import { verifyToken } from "@/lib/auth/auth";
import { getRequestToken } from "@/lib/auth/admin-guard";
import { getCustomerBookings } from "@/modules/bookings/booking.repository";

const router = Router();

router.get("/trips", async (req, res) => {
  try {
    const token = getRequestToken(req);
    if (!token) {
      return res.status(401).json({ error: "Unauthorized. Please sign in." });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    const bookings = await getCustomerBookings(payload.email);
    return res.json({ success: true, bookings });
  } catch (error) {
    console.error("Fetch trips error:", error);
    return res.status(500).json({ error: "Failed to load customer trips." });
  }
});

export default router;
