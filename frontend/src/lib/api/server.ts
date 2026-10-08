import "server-only";
import { unstable_rethrow } from "next/navigation";

// Server-side calls from React Server Components go straight to the backend.
// Browser calls use relative /api/* paths, which next.config.mjs rewrites to the backend.
export const BACKEND_URL = (
  process.env.BACKEND_URL ||
  (process.env.RENDER ? "https://vistachase-backend.onrender.com" : "http://localhost:4000")
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiGet<T>(path: string, params?: Record<string, string | undefined>, headers?: Record<string, string>): Promise<T> {
  const url = new URL(`${BACKEND_URL}${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }

  // Render's free plan has slow moments (a busy database, a restart). Wait up to 10 seconds and
  // try once more on a timeout, network error or 5xx, instead of failing the whole page.
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
        headers,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(res.status, body?.error || `Backend request failed: ${res.status} ${path}`);
      }
      return (await res.json()) as T;
    } catch (error) {
      // Next.js signals "render this page per request" (live prices and seats) by throwing from
      // fetch during the build; let that through instead of treating it as the backend being down.
      unstable_rethrow(error);
      const retryable = !(error instanceof ApiError) || error.status >= 500;
      if (retryable && attempt < 2) continue;
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, (error as Error).message || "Backend service unavailable");
    }
  }
}

// Returns null on 404 or backend unavailable so pages can render fallbacks instead of crashing
export async function apiGetOrNull<T>(path: string, params?: Record<string, string | undefined>, headers?: Record<string, string>): Promise<T | null> {
  try {
    return await apiGet<T>(path, params, headers);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && (error.status === 404 || error.status === 503)) return null;
    return null;
  }
}
