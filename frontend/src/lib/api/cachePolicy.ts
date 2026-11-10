import "server-only";
import { cache } from "react";

// Public catalog pages (home, tours, destinations, category and package pages) are served from the
// cache and refreshed in the background (fix recheck, 10 Nov 2026, N2/R2: 2.7-10 s responses and 5xx
// errors under a crawl). Such a page calls cachePublicData() first, in its generateMetadata and in
// the page itself; apiGet then lets Next.js cache backend reads for that many seconds. Every other
// page (checkout, search, accounts) reads the backend live, as before. The setting lives for one
// request only (React cache()).
const policy = cache(() => ({ revalidate: 0 }));

export function cachePublicData(seconds = 60) {
  policy().revalidate = seconds;
}

export function publicDataRevalidate(): number {
  return policy().revalidate;
}
