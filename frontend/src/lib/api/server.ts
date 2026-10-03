import "server-only";

// Server-side calls from React Server Components go straight to the backend.
// Browser calls use relative /api/* paths, which next.config.mjs rewrites to the backend.
export const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiGet<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${BACKEND_URL}${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }

  // Seat availability changes constantly, so never serve cached catalog data
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error || `Backend request failed: ${res.status} ${path}`);
  }
  return (await res.json()) as T;
}

// Returns null on 404 so pages can call notFound()
export async function apiGetOrNull<T>(path: string, params?: Record<string, string | undefined>): Promise<T | null> {
  try {
    return await apiGet<T>(path, params);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
