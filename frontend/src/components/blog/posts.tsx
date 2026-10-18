// Shared pieces for the magazine-style blog (/blog and /blog-post/<slug>): post types, the image
// rules and the cards. Everything shown comes from the SEO portal's published posts (written there or
// synced from Webflow's CMS); nothing here is sample content.
//
// Images: site media (/media/…, including portal uploads) render with next/image. Posts synced from
// Webflow keep their images on Webflow's CDN until the media library has a copy, so those render as a
// plain <img>, the same way post bodies already do. Any other address is not shown.

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface PostSummary {
  path: string;
  label: string;
  excerpt: string | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
  thumbnailImage: string | null;
  thumbnailAlt: string | null;
  featured: boolean;
  datePublished: string | null;
}

const WEBFLOW_CDN = /^https:\/\/([a-z0-9-]+\.)*(website-files\.com|webflow\.com|webflow\.io)\/[^\s\\"'()<>]+$/i;

/** The image address if the site may show it (site media or Webflow's CDN), else null. */
export function postImageSrc(src: string | null | undefined): string | null {
  const s = src?.trim();
  if (!s) return null;
  if (/^\/media\/[^\s\\]+$/.test(s)) return s;
  return WEBFLOW_CDN.test(s) ? s : null;
}

/** Card image: the Webflow "Thumbnail Image" (made for the post grid), else the main image. */
export function cardImageOf(p: PostSummary) {
  const thumb = postImageSrc(p.thumbnailImage);
  if (thumb) return { src: thumb, alt: p.thumbnailAlt ?? "" };
  const main = postImageSrc(p.featuredImage);
  return main ? { src: main, alt: p.featuredImageAlt ?? "" } : null;
}

/** Lead image: the main image, else the thumbnail. */
export function leadImageOf(p: PostSummary) {
  const main = postImageSrc(p.featuredImage);
  if (main) return { src: main, alt: p.featuredImageAlt ?? "" };
  const thumb = postImageSrc(p.thumbnailImage);
  return thumb ? { src: thumb, alt: p.thumbnailAlt ?? "" } : null;
}

// Shown when a post has no usable image (decorative only).
export const FALLBACK_IMAGE = "/media/photos/moraine-lake-perfect-reflection.webp";

export const postDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Edmonton" });

/** Fills its (relative, sized) parent. */
export function PostImage({ src, alt, sizes, priority = false, className = "" }: { src: string; alt: string; sizes: string; priority?: boolean; className?: string }) {
  if (src.startsWith("/media/")) return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />;
  return (
    // Webflow CDN image: no dimensions are known, so next/image (and its image optimiser) isn't used.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" className={`absolute inset-0 h-full w-full object-cover ${className}`} />
  );
}

function Meta({ post, tone = "light" }: { post: PostSummary; tone?: "light" | "dark" }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-[0.18em] ${tone === "dark" ? "text-white/70" : "text-slate-600"}`}>
      {post.featured && <span className={tone === "dark" ? "text-summit-200" : "text-ocean-600"}>Featured</span>}
      {post.datePublished && <time dateTime={post.datePublished}>{postDate(post.datePublished)}</time>}
    </p>
  );
}

/** The lead story on /blog: large image beside the headline, on the dark band. */
export function LeadStory({ post }: { post: PostSummary }) {
  const img = leadImageOf(post) ?? { src: FALLBACK_IMAGE, alt: "" };
  return (
    <article className="group relative grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
      <div className="relative aspect-[16/10] overflow-hidden bg-obsidian-900 lg:col-span-7">
        <span className="absolute inset-0 block transition-transform duration-[1.4s] ease-out group-hover:scale-[1.03]">
          <PostImage src={img.src} alt={img.alt} sizes="(min-width: 1024px) 44rem, 100vw" priority />
        </span>
      </div>
      <div className="lg:col-span-5">
        <Meta post={post} tone="dark" />
        <h2 className="mt-4 text-balance text-3xl font-light leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
          <Link href={post.path} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-summit-200">
            {post.label}
          </Link>
        </h2>
        {post.excerpt && <p className="mt-5 line-clamp-4 text-lg font-light leading-relaxed text-white/80">{post.excerpt}</p>}
        <p className="mt-7 inline-flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-summit-200" aria-hidden="true">
          Read the story
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </p>
      </div>
    </article>
  );
}

/** A story card: image on top, date, headline and summary below. "large" for the featured row. */
export function PostCard({ post, size = "regular", headingLevel = 3 }: { post: PostSummary; size?: "regular" | "large"; headingLevel?: 2 | 3 }) {
  const img = cardImageOf(post) ?? { src: FALLBACK_IMAGE, alt: "" };
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative flex h-full flex-col">
      <div className={`relative overflow-hidden bg-obsidian-100 ${size === "large" ? "aspect-[4/5]" : "aspect-[3/2]"}`}>
        <span className="absolute inset-0 block transition-transform duration-[1.4s] ease-out group-hover:scale-[1.04]">
          <PostImage src={img.src} alt={img.alt} sizes={size === "large" ? "(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw" : "(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"} />
        </span>
      </div>
      <div className="flex flex-1 flex-col pt-5">
        <Meta post={post} />
        <H className={`mt-3 text-balance font-light leading-snug tracking-tight text-obsidian-900 ${size === "large" ? "text-2xl" : "text-xl"}`}>
          <Link href={post.path} className="after:absolute after:inset-0 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-ocean-600">
            {post.label}
          </Link>
        </H>
        {post.excerpt && <p className="mt-3 line-clamp-3 text-base font-light leading-relaxed text-slate-700">{post.excerpt}</p>}
      </div>
    </article>
  );
}
