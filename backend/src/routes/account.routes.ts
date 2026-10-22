import { Router } from "express";
import { getSessionUser } from "@/lib/auth/admin-guard";
import { getCustomerBookings } from "@/modules/bookings/booking.repository";
import { paymentSummary } from "@/modules/bookings/deposit";

const router = Router();

router.get("/trips", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized. Please sign in." });
    }

    const rows = await getCustomerBookings(user);
    // Amounts in dollars, like GET /api/bookings (the database keeps cents). emailVerified: false
    // tells the page to offer the confirmation link, which brings in bookings made with this email
    // before the account existed.
    const bookings = rows.map(({ payments, ...b }) => ({
      ...b,
      totalAmount: b.totalAmount / 100,
      ...paymentSummary(b, payments),
    }));
    return res.json({ success: true, bookings, emailVerified: user.emailVerified });
  } catch (error) {
    console.error("Fetch trips error:", error);
    return res.status(500).json({ error: "Failed to load customer trips." });
  }
});

export default router;
