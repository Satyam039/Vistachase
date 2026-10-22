import { Router } from "express";
import { verifyToken } from "@/lib/auth/auth";
import { getRequestToken } from "@/lib/auth/admin-guard";
import { getCustomerBookings } from "@/modules/bookings/booking.repository";
import { paymentSummary } from "@/modules/bookings/deposit";

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

    const rows = await getCustomerBookings(payload.email);
    // Amounts in dollars, like GET /api/bookings (the database keeps cents).
    const bookings = rows.map(({ payments, ...b }) => ({
      ...b,
      subtotal: b.subtotal / 100,
      addOnsTotal: b.addOnsTotal / 100,
      totalAmount: b.totalAmount / 100,
      ...paymentSummary(b, payments),
    }));
    return res.json({ success: true, bookings });
  } catch (error) {
    console.error("Fetch trips error:", error);
    return res.status(500).json({ error: "Failed to load customer trips." });
  }
});

export default router;
