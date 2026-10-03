import { Router } from "express";
import prisma from "@/lib/db/prisma";
import { getCacheProvider } from "@/lib/cache/cache.provider";

const router = Router();

router.get("/", async (_req, res) => {
  const startTime = Date.now();
  let dbStatus = "ok";
  let cacheStatus = "ok";

  // Check Database
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }

  // Check Cache
  try {
    const cache = getCacheProvider();
    await cache.set("healthcheck_test", "1", 5);
    const readBack = await cache.get("healthcheck_test");
    if (String(readBack) !== "1") {
      cacheStatus = "error";
    }
  } catch {
    cacheStatus = "error";
  }

  const isHealthy = dbStatus === "ok" && cacheStatus === "ok";
  const latencyMs = Date.now() - startTime;

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "degraded",
    service: "Vista Chase Custom Travel Booking Platform",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    latencyMs,
    checks: {
      database: dbStatus,
      cache: cacheStatus,
    },
  });
});

export default router;
