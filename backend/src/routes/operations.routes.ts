import { Router } from "express";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import {
  getOperationsDashboard,
  createOrUpdateRun,
  updateRunStatus,
  assignBookingToRun,
  optimizePickupSequence,
  toggleRunPassengerBoarding,
  getRunManifest,
} from "@/modules/operations/operations.repository";
import { getBokunOperationsProvider } from "@/modules/bokun/bokun.provider";
import prisma from "@/lib/db/prisma";

const router = Router();

// Staff authentication guard middleware for all operations routes
router.use((req, res, next) => {
  const staff = getAuthenticatedStaff(req, ["ADMIN", "OPERATOR", "DISPATCHER"]);
  if (!staff) {
    return res.status(403).json({ error: "Access denied. Operations staff privileges required." });
  }
  next();
});

// 1. Operations Dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const data = await getOperationsDashboard(date);
    return res.json({ success: true, ...data });
  } catch (error: any) {
    console.error("Operations dashboard error:", error);
    return res.status(500).json({ error: error.message || "Failed to load operations dashboard." });
  }
});

// 2. Get Single Run Manifest
router.get("/runs/:runId", async (req, res) => {
  try {
    const run = await getRunManifest(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }
    return res.json({ success: true, run });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load run manifest." });
  }
});

// 3. Create or Update Operational Run
router.post("/runs", async (req, res) => {
  try {
    const { name, date, tourDepartureId, departureTime, vehicleId, driverId, status, notes, runId } = req.body ?? {};

    if (!name || !date || !tourDepartureId) {
      return res.status(400).json({ error: "name, date, and tourDepartureId are required." });
    }

    const run = await createOrUpdateRun(
      {
        name,
        date,
        tourDepartureId,
        departureTime,
        vehicleId,
        driverId,
        status,
        notes,
      },
      runId
    );

    return res.json({ success: true, run });
  } catch (error: any) {
    console.error("Create/update run error:", error);
    return res.status(500).json({ error: error.message || "Failed to save operational run." });
  }
});

// 4. Update Run Operational Status
router.post("/runs/:runId/status", async (req, res) => {
  try {
    const { status, notes } = req.body ?? {};
    if (!status) {
      return res.status(400).json({ error: "Status is required." });
    }

    const updated = await updateRunStatus(req.params.runId, status, notes);
    return res.json({ success: true, run: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to update run status." });
  }
});

// 5. Assign Booking to Run
router.post("/runs/:runId/assign-booking", async (req, res) => {
  try {
    const { bookingId, pickupOrder } = req.body ?? {};
    if (!bookingId) {
      return res.status(400).json({ error: "bookingId is required." });
    }

    const assignment = await assignBookingToRun(req.params.runId, bookingId, pickupOrder);
    return res.json({ success: true, assignment });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to assign booking to run." });
  }
});

// 6. Optimize Pickup Sequence
router.post("/runs/:runId/optimize-pickups", async (req, res) => {
  try {
    const sequence = await optimizePickupSequence(req.params.runId);
    return res.json({ success: true, sequence });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to optimize pickups." });
  }
});

// 7. Passenger Boarding Check-in
router.post("/runs/check-in", async (req, res) => {
  try {
    const { runBookingId, isBoarded } = req.body ?? {};
    if (!runBookingId || typeof isBoarded !== "boolean") {
      return res.status(400).json({ error: "runBookingId and boolean isBoarded are required." });
    }

    const updated = await toggleRunPassengerBoarding(runBookingId, isBoarded);
    return res.json({ success: true, runBooking: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to toggle boarding." });
  }
});

// 8. Trigger Bókun Synchronization
router.post("/sync-bokun", async (req, res) => {
  try {
    const date = (req.body?.date as string) || new Date().toISOString().split("T")[0];
    const bokunProvider = getBokunOperationsProvider();
    const result = await bokunProvider.syncTodaysBookings(date);
    return res.json({ success: true, result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Bókun sync failed." });
  }
});

// 9. Fleet List
router.get("/fleet", async (_req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { name: "asc" },
    });
    return res.json({ success: true, vehicles });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load fleet." });
  }
});

// 10. Drivers List
router.get("/drivers", async (_req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      orderBy: { name: "asc" },
    });
    return res.json({ success: true, drivers });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load drivers." });
  }
});

export default router;
