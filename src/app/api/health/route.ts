import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCacheProvider } from "@/lib/cache/cache.provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "ok";
  let cacheStatus = "ok";

  // Check Database
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = "error";
  }

  // Check Cache
  try {
    const cache = getCacheProvider();
    await cache.set("healthcheck_test", "1", 5);
    const readBack = await cache.get("healthcheck_test");
    if (readBack !== "1") {
      cacheStatus = "error";
    }
  } catch (err) {
    cacheStatus = "error";
  }

  const isHealthy = dbStatus === "ok" && cacheStatus === "ok";
  const latencyMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      service: "Vista Chase Custom Travel Booking Platform",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime ? Math.round(process.uptime()) : 0,
      latencyMs,
      checks: {
        database: dbStatus,
        cache: cacheStatus,
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
