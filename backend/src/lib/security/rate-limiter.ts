import { getCacheProvider } from "@/lib/cache/cache.provider";

export interface RateLimitConfig {
  maxRequests: number; // e.g. 5 requests
  windowSeconds: number; // e.g. 60 seconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Fixed-window limit. The count is incremented in one atomic step (a Redis script, or in-process
 * counters when Redis is down), so simultaneous requests can't slip past the limit, and limits stay
 * on without Redis.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 20, windowSeconds: 60 }
): Promise<RateLimitResult> {
  const { count, ttl } = await getCacheProvider().incrWindow(`rate_limit:${key}`, config.windowSeconds);
  const resetSeconds = ttl > 0 ? ttl : config.windowSeconds;
  if (count > config.maxRequests) return { allowed: false, remaining: 0, resetSeconds };
  return { allowed: true, remaining: config.maxRequests - count, resetSeconds };
}
