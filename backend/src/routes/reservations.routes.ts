import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { Router } from "express";
import prisma from "@/lib/db/prisma";
import { emailSchema, parseOr400, z } from "@/lib/security/validate";
import {
  createReservationHold,
  getHoldStatus,
  releaseHold,
} from "@/modules/reservations/reservation.repository";

const router = Router();

const holdSchema = z.object({
  departureId: z.string().min(1).max(64),
  seatsCount: z.coerce.number().int().min(1).max(30),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: emailSchema,
  customerPhone: z.string().trim().max(32).optional(),
});
// A real guest needs one hold at a time (a second tab, a changed date). More than this per email
// is someone locking seats they won't buy; holds still expire on their own after 10 minutes.
const MAX_ACTIVE_HOLDS_PER_EMAIL = 3;
const holdToken = z.string().regex(/^hold_[a-f0-9]{32}$/);

router.post("/hold", rateLimitMiddleware("hold_create", { maxRequests: 10, windowSeconds: 60 }), async (req, res) => {
  try {
    const body = parseOr400(holdSchema, req.body ?? {}, res);
    if (!body) return;
    const { departureId, seatsCount, customerName, customerEmail, customerPhone } = body;

    const active = await prisma.reservationHold.count({
      where: { customerEmail: { equals: customerEmail, mode: "insensitive" }, status: "ACTIVE", expiresAt: { gt: new Date() } },
    });
    if (active >= MAX_ACTIVE_HOLDS_PER_EMAIL) {
      return res.status(429).json({ success: false, error: "You already have seats on hold. Finish that booking, or wait a few minutes for the hold to end." });
    }

    const result = await createReservationHold({
      departureId,
      seatsCount,
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
    const parsed = holdToken.safeParse(req.query.token);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Missing or invalid hold token" });
    }
    const token = parsed.data;

    const status = await getHoldStatus(token);
    return res.json({ success: true, ...status });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Failed to check hold status" });
  }
});

router.delete("/hold", async (req, res) => {
  try {
    const parsed = holdToken.safeParse(req.query.token);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Missing or invalid hold token" });
    }
    const token = parsed.data;

    const released = await releaseHold(token);
    return res.json({ success: true, released });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Failed to release hold" });
  }
});

export default router;
