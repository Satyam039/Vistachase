import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import accountRoutes from "@/routes/account.routes";
import adminRoutes from "@/routes/admin.routes";
import authRoutes from "@/routes/auth.routes";
import bookingsRoutes from "@/routes/bookings.routes";
import conciergeRoutes from "@/routes/concierge.routes";
import departuresRoutes from "@/routes/departures.routes";
import destinationsRoutes from "@/routes/destinations.routes";
import healthRoutes from "@/routes/health.routes";
import pickupsRoutes from "@/routes/pickups.routes";
import reservationsRoutes from "@/routes/reservations.routes";
import reviewsRoutes from "@/routes/reviews.routes";
import shuttlesRoutes from "@/routes/shuttles.routes";
import toursRoutes from "@/routes/tours.routes";
import operationsRoutes from "@/routes/operations.routes";
import trackingRoutes from "@/routes/tracking.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // The frontend proxies /api/* to this server, so browser calls are same-origin.
  // CORS is only needed when a client calls the backend directly.
  const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(cors({ origin: allowedOrigins, credentials: true }));

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use("/api/account", accountRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/bookings", bookingsRoutes);
  app.use("/api/concierge", conciergeRoutes);
  app.use("/api/departures", departuresRoutes);
  app.use("/api/destinations", destinationsRoutes);
  app.use("/api/health", healthRoutes);
  app.use("/api/pickups", pickupsRoutes);
  app.use("/api/reservations", reservationsRoutes);
  app.use("/api/reviews", reviewsRoutes);
  app.use("/api/shuttles", shuttlesRoutes);
  app.use("/api/tours", toursRoutes);
  app.use("/api/operations", operationsRoutes);
  app.use("/api/track", trackingRoutes);

  app.use("/api", (_req, res) => {
    res.status(404).json({ success: false, error: "Not found" });
  });

  app.use((err: Error & { status?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ success: false, error: "Invalid JSON body" });
    }
    console.error("Unhandled API error:", err);
    return res.status(err.status || 500).json({ success: false, error: "Internal server error" });
  });

  return app;
}
