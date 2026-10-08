import { Router } from "express";
import { getLiveTrackingProvider } from "@/lib/tracking/tracking.provider";
import { dispatchShuttleTrackingAlert } from "@/lib/whatsapp/whatsapp.provider";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";

const router = Router();

// GET /api/track/:token
router.get("/:token", async (req, res) => {
  try {
    const token = req.params.token;
    if (!token) {
      return res.status(400).json({ success: false, error: "Tracking token is required." });
    }

    const provider = getLiveTrackingProvider();
    const telemetry = await provider.getTrackingTelemetry(token);

    if (!telemetry) {
      return res.status(404).json({
        success: false,
        error: "Tracking session expired or not found. Please contact Vista Chase concierge.",
      });
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    return res.json({ success: true, telemetry });
  } catch (error: any) {
    console.error("Tracking telemetry error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to retrieve telemetry." });
  }
});

// POST /api/track/:token/notify (Simulate/Trigger T-60 WhatsApp message)
// Staff only: it issues the tracking token and messages the guest, so it must never be open to
// anyone holding a booking reference.
router.post("/:token/notify", async (req, res) => {
  try {
    if (!getAuthenticatedStaff(req, ["ADMIN", "OPERATOR", "DISPATCHER"])) {
      return res.status(403).json({ success: false, error: "Access denied. Staff privileges required." });
    }
    const token = req.params.token;
    const origin = req.headers.origin || "http://localhost:3000";
    const result = await dispatchShuttleTrackingAlert(token, origin);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: "WhatsApp live tracking alert dispatched successfully",
      trackingUrl: result.trackingUrl,
      trackingToken: result.trackingToken,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
