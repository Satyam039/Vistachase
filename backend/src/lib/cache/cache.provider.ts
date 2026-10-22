import Redis from "ioredis";

export interface ICacheProvider {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  /** Adds one to a counter in a single step; the window starts with the first hit. */
  incrWindow(key: string, windowSeconds: number): Promise<{ count: number; ttl: number }>;
}

class MemoryCacheProvider implements ICacheProvider {
  private store = new Map<string, { val: string; expiresAt: number | null }>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    try {
      return JSON.parse(item.val) as T;
    } catch {
      return item.val as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { val: serialized, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = await this.get(key);
    return item !== null;
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item || !item.expiresAt) return -1;
    const remaining = Math.max(0, Math.floor((item.expiresAt - Date.now()) / 1000));
    return remaining;
  }

  // Synchronous between reads and writes, so it is atomic within this process.
  async incrWindow(key: string, windowSeconds: number) {
    const now = Date.now();
    const item = this.store.get(key);
    const live = item && (!item.expiresAt || item.expiresAt > now) ? item : null;
    const count = (live ? parseInt(live.val, 10) || 0 : 0) + 1;
    const expiresAt = live?.expiresAt ?? now + windowSeconds * 1000;
    this.store.set(key, { val: String(count), expiresAt });
    return { count, ttl: Math.max(1, Math.ceil((expiresAt - now) / 1000)) };
  }
}

/** Counters for when Redis can't be reached: per process, but limits stay on. */
const fallbackCounters = new MemoryCacheProvider();

// INCR and the first EXPIRE in one script, so concurrent requests can't both read the old count.
const INCR_WINDOW = `local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local t = redis.call('TTL', KEYS[1])
if t < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]); t = tonumber(ARGV[1]) end
return {c, t}`;

class RedisCacheProvider implements ICacheProvider {
  private client: Redis;

  constructor(redisUrl?: string) {
    this.client = new Redis(redisUrl || process.env.REDIS_URL || "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.client.connect().catch((err) => {
      console.warn("[RedisCacheProvider] Redis connection error, falling back:", err.message);
    });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      try {
        return JSON.parse(data) as T;
      } catch {
        return data as unknown as T;
      }
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = typeof value === "string" ? value : JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (e) {
      console.error("[RedisCacheProvider] Failed to set key:", key, e);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (e) {
      console.error("[RedisCacheProvider] Failed to del key:", key, e);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const count = await this.client.exists(key);
      return count > 0;
    } catch {
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch {
      return -1;
    }
  }

  async incrWindow(key: string, windowSeconds: number) {
    try {
      const [count, ttl] = (await this.client.eval(INCR_WINDOW, 1, key, String(windowSeconds))) as [number, number];
      return { count: Number(count), ttl: Number(ttl) };
    } catch {
      return fallbackCounters.incrWindow(key, windowSeconds);
    }
  }
}

let cacheInstance: ICacheProvider | null = null;

export function getCacheProvider(): ICacheProvider {
  if (cacheInstance) return cacheInstance;

  const providerType = process.env.CACHE_PROVIDER || "memory";
  if (providerType === "redis" && process.env.REDIS_URL) {
    cacheInstance = new RedisCacheProvider(process.env.REDIS_URL);
  } else {
    cacheInstance = new MemoryCacheProvider();
  }
  return cacheInstance;
}
