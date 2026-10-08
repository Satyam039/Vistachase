import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { Router } from "express";
import {
  createReservationHold,
  getHoldStatus,
  releaseHold,
} from "@/modules/reservations/reservation.repository";

const router = Router();

router.post("/hold", rateLimitMiddleware("hold_create", { maxRequests: 10, windowSeconds: 60 }), async (req, res) => {
  try {
    const { departureId, seatsCount, customerName, customerEmail, customerPhone } = req.body ?? {};

    if (!departureId || !seatsCount || !customerName || !customerEmail) {
      return res.status(400).json({ success: false, error: "Missing required hold parameters" });
    }

    const result = await createReservationHold({
      departureId,
      seatsCount: parseInt(seatsCount, 10),
      customerName,
      customerEmail,
      customerPhone,
      holdDurationSeconds: 600, // 10 minutes
    });

    if (!result.success) {
      return res.status(409).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      holdToken: result.holdToken,
      expiresAt: result.expiresAt,
      remainingSeconds: result.remainingSeconds,
      seatsHeld: result.seatsHeld,
      isVehicle: result.isVehicle,
    });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Failed to create reservation hold" });
  }
});

router.get("/hold", async (req, res) => {
  try {
    const token = req.query.token as string | undefined;

    if (!token) {
      return res.status(400).json({ success: false, error: "Missing hold token" });
    }

    const status = await getHoldStatus(token);
    return res.json({ success: true, ...status });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Failed to check hold status" });
  }
});

router.delete("/hold", async (req, res) => {
  try {
    const token = req.query.token as string | undefined;

    if (!token) {
      return res.status(400).json({ success: false, error: "Missing hold token" });
    }

    const released = await releaseHold(token);
    return res.json({ success: true, released });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Failed to release hold" });
  }
});

export default router;
