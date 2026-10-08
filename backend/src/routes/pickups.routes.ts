import { Router } from "express";
import { getMapsProvider } from "@/lib/maps/maps.provider";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const query = (req.query.q as string | undefined) || "";
    const town = (req.query.town as string | undefined) || undefined;

    const maps = getMapsProvider();
    const pickups = await maps.searchPickups(query, town);

    return res.json({ success: true, count: pickups.length, pickups });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Failed to fetch pickups" });
  }
});

export default router;
