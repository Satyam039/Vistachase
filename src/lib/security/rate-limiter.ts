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

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 20, windowSeconds: 60 }
): Promise<RateLimitResult> {
  const cache = getCacheProvider();
  const cacheKey = `rate_limit:${key}`;

  const currentCountStr = await cache.get<string>(cacheKey);
  const currentCount = currentCountStr ? parseInt(String(currentCountStr), 10) : 0;

  if (currentCount >= config.maxRequests) {
    const ttl = await cache.ttl(cacheKey);
    return {
      allowed: false,
      remaining: 0,
      resetSeconds: ttl > 0 ? ttl : config.windowSeconds,
    };
  }

  const nextCount = currentCount + 1;
  const ttl = await cache.ttl(cacheKey);
  const expiry = ttl > 0 ? ttl : config.windowSeconds;

  await cache.set(cacheKey, nextCount.toString(), expiry);

  return {
    allowed: true,
    remaining: config.maxRequests - nextCount,
    resetSeconds: expiry,
  };
}
