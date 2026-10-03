import { Router } from "express";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import {
  getAdminMetrics,
  getDispatchManifest,
  toggleBoardingStatus,
  updateDepartureCapacity,
} from "@/modules/admin/admin.repository";

const router = Router();

router.get("/metrics", async (req, res) => {
  try {
    const staff = getAuthenticatedStaff(req, ["ADMIN", "OPERATOR", "DISPATCHER"]);
    if (!staff) {
      return res.status(403).json({ error: "Access denied. Staff privileges required." });
    }

    const metrics = await getAdminMetrics();
    return res.json({ success: true, metrics });
  } catch (error) {
    console.error("Admin metrics error:", error);
    return res.status(500).json({ error: "Failed to load metrics." });
  }
});

router.get("/dispatch", async (req, res) => {
  try {
    const staff = getAuthenticatedStaff(req, ["ADMIN", "OPERATOR", "DISPATCHER"]);
    if (!staff) {
      return res.status(403).json({ error: "Access denied. Dispatcher privileges required." });
    }

    const date = (req.query.date as string | undefined) || new Date().toISOString().split("T")[0];

    const manifests = await getDispatchManifest(date);
    return res.json({ success: true, date, manifests });
  } catch (error) {
    console.error("Admin dispatch error:", error);
    return res.status(500).json({ error: "Failed to load dispatch manifest." });
  }
});

router.post("/dispatch/check-in", async (req, res) => {
  try {
    const staff = getAuthenticatedStaff(req, ["ADMIN", "OPERATOR", "DISPATCHER"]);
    if (!staff) {
      return res.status(403).json({ error: "Access denied. Dispatcher privileges required." });
    }

    const { bookingId, isBoarded } = req.body ?? {};

    if (!bookingId || typeof isBoarded !== "boolean") {
      return res.status(400).json({ error: "bookingId and boolean isBoarded are required." });
    }

    const updated = await toggleBoardingStatus(bookingId, isBoarded);
    return res.json({ success: true, booking: updated });
  } catch (error) {
    console.error("Boarding check-in error:", error);
    return res.status(500).json({ error: "Failed to update boarding status." });
  }
});

router.post("/departures/capacity", async (req, res) => {
  try {
    const staff = getAuthenticatedStaff(req, ["ADMIN", "OPERATOR"]);
    if (!staff) {
      return res.status(403).json({ error: "Access denied. Admin or Operator privileges required." });
    }

    const { departureId, newTotalCapacity } = req.body ?? {};

    if (!departureId || typeof newTotalCapacity !== "number") {
      return res.status(400).json({ error: "departureId and numeric newTotalCapacity are required." });
    }

    const result = await updateDepartureCapacity(departureId, newTotalCapacity);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true, departure: result.departure });
  } catch (error) {
    console.error("Update capacity error:", error);
    return res.status(500).json({ error: "Failed to update departure capacity." });
  }
});

export default router;
