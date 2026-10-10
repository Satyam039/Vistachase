// Media CDN (CloudFront in front of the S3 media bucket). Site media keeps its /media/... paths
// everywhere (catalog data, components, tour.featuredImage); mediaUrl() is applied where the
// browser loads media directly: background clips and posters (AmbientVideo). Images stay on
// next/image, which serves public/media from disk and resizes per screen.
//
//   NEXT_PUBLIC_MEDIA_CDN_URL unset  →  /media/... as today (Next proxies it to the backend)
//   NEXT_PUBLIC_MEDIA_CDN_URL set    →  the base that replaces "/media", e.g.
//                                        "https://<id>.cloudfront.net/media" when the bucket keeps
//                                        the media/ prefix, "https://<id>.cloudfront.net" when not
//
// It is read at build time (NEXT_PUBLIC_ values are inlined), so changing it needs a rebuild.
// Only /media/... paths change: external URLs, data: URIs and other paths pass through untouched.

export const MEDIA_CDN_URL = (process.env.NEXT_PUBLIC_MEDIA_CDN_URL || "").trim().replace(/\/+$/, "");

export function mediaUrl<T extends string | null | undefined>(src: T): T {
  if (!MEDIA_CDN_URL || typeof src !== "string" || !src.startsWith("/media/")) return src;
  return `${MEDIA_CDN_URL}${src.slice("/media".length)}` as T;
}
