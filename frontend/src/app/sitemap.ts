import type { MetadataRoute } from "next";
import { seoFetch, siteOrigin } from "@/lib/seo/server";
import { ACTIVITY_TICKETS } from "@/lib/activityTickets";

// Built per request (cached a minute) from the SEO data: published, indexable pages whose canonical
// is themselves, plus every tour and destination. Redirect sources, sign-in, checkout and search
// pages are left out by the backend (backend/src/modules/seo/seo.public.ts).
export const dynamic = "force-dynamic";

interface Entry {
  path: string;
  lastModified: string;
  priority: number | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const body = await seoFetch<{ entries: Entry[] }>("/sitemap", 8000);
  if (!body) return [{ url: `${origin}/`, priority: 1 }]; // backend down: never serve an error page to crawlers
  // Ticket pages redirect to the operator's booking site (app/[slug]/page.tsx), so they're not listed.
  return body.entries.filter((e) => !(e.path.slice(1) in ACTIVITY_TICKETS)).map((e) => ({
    url: `${origin}${e.path === "/" ? "/" : e.path}`,
    lastModified: e.lastModified,
    ...(e.priority != null ? { priority: e.priority } : {}),
  }));
}
