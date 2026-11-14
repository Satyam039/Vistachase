/**
 * @file location.ts
 * Captures traveler client IP and geographic location on the frontend
 * for personalized concierge recommendations and session persistence.
 */

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

const LOCATION_STORAGE_KEY = "vc_traveler_location";
const ONE_HOUR_MS = 60 * 60 * 1000;

export function getStoredClientLocation(): ClientLocationInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.ip === "string") {
      return parsed as ClientLocationInfo;
    }
  } catch {
    // storage unavailable or malformed
  }
  return null;
}

export function cacheClientLocation(info: ClientLocationInfo): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(info));
  } catch {
    // storage quota or blocked
  }
}

/**
 * Captures the traveler's client IP and geographical location.
 * Fetches from `/api/concierge/location`, caches the result,
 * and attempts GPS augmentation if permission is granted.
 */
export async function captureClientLocation(): Promise<ClientLocationInfo> {
  const cached = getStoredClientLocation();
  if (cached && cached.capturedAt) {
    const age = Date.now() - new Date(cached.capturedAt).getTime();
    if (age < ONE_HOUR_MS) {
      return cached;
    }
  }

  let location: ClientLocationInfo = {
    ip: "127.0.0.1",
    source: "client_default",
    capturedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch("/api/concierge/location", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.location?.ip) {
        location = {
          ...data.location,
          capturedAt: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn("[location] could not query /api/concierge/location:", err);
  }

  // Augment with browser geolocation coordinates if available and granted
  if (typeof navigator !== "undefined" && "geolocation" in navigator) {
    try {
      const coords = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 3500, maximumAge: 300000, enableHighAccuracy: false },
        );
      });

      if (coords) {
        location = {
          ...location,
          latitude: coords.latitude,
          longitude: coords.longitude,
          source: location.source === "client_default" ? "browser_gps" : `${location.source}+gps`,
        };
      }
    } catch {
      // Permission denied or timed out
    }
  }

  cacheClientLocation(location);
  return location;
}
