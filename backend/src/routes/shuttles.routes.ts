import { Router } from "express";
import { getShuttleRoutes, getShuttleBySlug } from "@/modules/shuttles/shuttle.repository";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const routes = await getShuttleRoutes();
    return res.json({ success: true, count: routes.length, routes });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: (error as Error).message || "Failed to load shuttles" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const route = await getShuttleBySlug(req.params.slug);
    if (!route) {
      return res.status(404).json({ success: false, error: "Shuttle route not found" });
    }
    return res.json({ success: true, route });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: (error as Error).message || "Failed to load shuttle" });
  }
});

export default router;
