import { Request, Response, NextFunction } from "express";
import { checkRateLimit, RateLimitConfig } from "./rate-limiter";

export function rateLimitMiddleware(action: string, config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const key = `${action}:${ip}`;

    try {
      const result = await checkRateLimit(key, config);
      if (!result.allowed) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please try again later.",
          retryAfter: result.resetSeconds
        });
      }
      next();
    } catch (error) {
      console.error(`Rate limit error for ${key}:`, error);
      // Fail open if Redis is down
      next();
    }
  };
}
