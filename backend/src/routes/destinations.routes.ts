import { Router } from "express";
import { getDestinations, getDestinationBySlug } from "@/modules/destinations/destination.repository";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const destinations = await getDestinations();
    return res.json({ success: true, count: destinations.length, destinations });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: (error as Error).message || "Failed to load destinations" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const destination = await getDestinationBySlug(req.params.slug);
    if (!destination) {
      return res.status(404).json({ success: false, error: "Destination not found" });
    }
    return res.json({ success: true, destination });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: (error as Error).message || "Failed to load destination" });
  }
});

export default router;
