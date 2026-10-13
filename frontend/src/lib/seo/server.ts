import "server-only";
import type { Metadata } from "next";
import { BACKEND_URL } from "@/lib/api/server";

// Published SEO overrides from the admin SEO dashboard (/admin/seo). Each public page keeps its
// metadata in code as the default; a published override replaces only the fields it sets. When
// the backend is slow or down, pages render with their code defaults.

export interface SeoMeta {
  path: string;
  pageType: string;
  seoTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  breadcrumbLabel: string | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
  updatedAt: string;
}

/** The public site's address, for absolute links in the sitemap, robots.txt and JSON-LD. */
export function siteOrigin(): string {
  const raw = process.env.SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.vistachase.com";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://www.vistachase.com";
  }
}

/** GET a public SEO endpoint, cached for a minute; null on any failure. */
export async function seoFetch<T>(path: string, timeoutMs = 3000): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/seo/public${path}`, {
      next: { revalidate: 60, tags: ["seo"] },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getSeoMeta(path: string): Promise<SeoMeta | null> {
  const body = await seoFetch<{ meta: SeoMeta | null }>(`/meta?path=${encodeURIComponent(path)}`);
  return body?.meta ?? null;
}

/** Merges the published override for `path` over the page's own metadata. */
export async function withSeo(path: string, defaults: Metadata): Promise<Metadata> {
  const meta = await getSeoMeta(path);
  return mergeSeo(defaults, meta);
}

export function mergeSeo(defaults: Metadata, meta: SeoMeta | null): Metadata {
  if (!meta) return defaults;
  const title = meta.seoTitle ?? undefined;
  const description = meta.metaDescription ?? undefined;
  const merged: Metadata = { ...defaults };
  if (title) merged.title = { absolute: title };
  if (description) merged.description = description;
  if (meta.canonicalUrl) merged.alternates = { ...defaults.alternates, canonical: meta.canonicalUrl };
  if (!meta.robotsIndex || !meta.robotsFollow) {
    merged.robots = { index: meta.robotsIndex, follow: meta.robotsFollow };
  }

  const ogTitle = meta.ogTitle ?? title;
  const ogDescription = meta.ogDescription ?? description;
  const ogImage = meta.ogImage ?? meta.featuredImage;
  if (ogTitle || ogDescription || ogImage) {
    merged.openGraph = {
      ...defaults.openGraph,
      ...(ogTitle ? { title: ogTitle } : {}),
      ...(ogDescription ? { description: ogDescription } : {}),
      ...(ogImage ? { images: [{ url: ogImage, alt: meta.featuredImageAlt ?? ogTitle ?? undefined }] } : {}),
    };
  }
  const twTitle = meta.twitterTitle ?? ogTitle;
  const twDescription = meta.twitterDescription ?? ogDescription;
  const twImage = meta.twitterImage ?? ogImage;
  if (meta.twitterTitle || meta.twitterDescription || meta.twitterImage) {
    merged.twitter = {
      ...defaults.twitter,
      card: "summary_large_image",
      ...(twTitle ? { title: twTitle } : {}),
      ...(twDescription ? { description: twDescription } : {}),
      ...(twImage ? { images: [twImage] } : {}),
    };
  }
  return merged;
}
