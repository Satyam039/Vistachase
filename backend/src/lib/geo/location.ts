/**
 * @file location.ts
 * Captures traveler IP address and geographic location details from HTTP headers
 * or public geo-ip lookups.
 */

import type { Request } from "express";

export interface ClientLocationInfo {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  source: string;
  capturedAt?: string;
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) return cfIp.trim();
  return req.socket.remoteAddress || "127.0.0.1";
}

export function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.2") ||
    ip.startsWith("172.30.") ||
    ip.startsWith("172.31.") ||
    ip.startsWith("fc00:") ||
    ip.startsWith("fe80:")
  );
}

export async function detectClientLocation(req: Request): Promise<ClientLocationInfo> {
  const ip = extractClientIp(req);
  const capturedAt = new Date().toISOString();

  // 1. Check Cloudflare geo headers
  const cfCountry = req.headers["cf-ipcountry"];
  const cfCity = req.headers["cf-ipcity"];
  const cfRegion = req.headers["cf-region"];
  const cfTimezone = req.headers["cf-timezone"];
  const cfLat = req.headers["cf-iplatitude"];
  const cfLng = req.headers["cf-iplongitude"];

  if (typeof cfCountry === "string" && cfCountry && cfCountry !== "XX") {
    return {
      ip,
      country: cfCountry,
      countryCode: cfCountry,
      city: typeof cfCity === "string" ? decodeURIComponent(cfCity) : undefined,
      region: typeof cfRegion === "string" ? decodeURIComponent(cfRegion) : undefined,
      timezone: typeof cfTimezone === "string" ? cfTimezone : undefined,
      latitude: typeof cfLat === "string" ? parseFloat(cfLat) : undefined,
      longitude: typeof cfLng === "string" ? parseFloat(cfLng) : undefined,
      source: "cloudflare_headers",
      capturedAt,
    };
  }

  // 2. Check Vercel geo headers
  const vCountry = req.headers["x-vercel-ip-country"];
  const vCity = req.headers["x-vercel-ip-city"];
  const vRegion = req.headers["x-vercel-ip-country-region"];
  const vTimezone = req.headers["x-vercel-ip-timezone"];
  const vLat = req.headers["x-vercel-ip-latitude"];
  const vLng = req.headers["x-vercel-ip-longitude"];

  if (typeof vCountry === "string" && vCountry) {
    return {
      ip,
      country: vCountry,
      countryCode: vCountry,
      city: typeof vCity === "string" ? decodeURIComponent(vCity) : undefined,
      region: typeof vRegion === "string" ? decodeURIComponent(vRegion) : undefined,
      timezone: typeof vTimezone === "string" ? vTimezone : undefined,
      latitude: typeof vLat === "string" ? parseFloat(vLat) : undefined,
      longitude: typeof vLng === "string" ? parseFloat(vLng) : undefined,
      source: "vercel_headers",
      capturedAt,
    };
  }

  // 3. Private / Loopback / Test network fallback
  if (isPrivateIp(ip) || process.env.NODE_ENV === "test") {
    return {
      ip,
      city: "Banff / Calgary Region",
      region: "Alberta",
      country: "Canada",
      countryCode: "CA",
      timezone: "America/Edmonton",
      latitude: 51.1784,
      longitude: -115.5708,
      source: "local_network_fallback",
      capturedAt,
    };
  }

  // 4. Public IP lookup (with fast timeout)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as Record<string, any>;
      if (data && data.success !== false) {
        return {
          ip,
          city: typeof data.city === "string" ? data.city : undefined,
          region: typeof data.region === "string" ? data.region : undefined,
          country: typeof data.country === "string" ? data.country : undefined,
          countryCode: typeof data.country_code === "string" ? data.country_code : undefined,
          latitude: typeof data.latitude === "number" ? data.latitude : undefined,
          longitude: typeof data.longitude === "number" ? data.longitude : undefined,
          timezone: typeof data.timezone?.id === "string" ? data.timezone.id : undefined,
          source: "ipwhois_lookup",
          capturedAt,
        };
      }
    }
  } catch {
    // lookup timed out: fall through
  }

  return {
    ip,
    source: "ip_raw",
    capturedAt,
  };
}
