// Blog index: posts migrated from the Webflow blog (and new ones written in the SEO portal), each at
// its Webflow address /blog-post/<slug>. Featured posts first, then newest by original publish date.
// Guides keep their own list at /guides.

import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { MediaCard } from "@/components/cards/MediaCard";
import { seoFetch, siteOrigin, withSeo } from "@/lib/seo/server";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";

interface PostSummary {
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

export const dynamic = "force-dynamic";

// Shown on a card when the post has no local image (decorative only).
const FALLBACK_IMAGE = "/media/photos/moraine-lake-perfect-reflection.webp";

export async function generateMetadata(): Promise<Metadata> {
  return withSeo("/blog", {
    title: "Banff blog | Vista Chase",
    description: "Stories, tips and seasonal updates for Banff and the Canadian Rockies from the Vista Chase team.",
    alternates: { canonical: "/blog" },
  });
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Edmonton" });

function cardImage(p: PostSummary) {
  if (p.thumbnailImage?.startsWith("/media/")) return { src: p.thumbnailImage, alt: p.thumbnailAlt ?? "" };
  if (p.featuredImage?.startsWith("/media/")) return { src: p.featuredImage, alt: p.featuredImageAlt ?? "" };
  return { src: FALLBACK_IMAGE, alt: "" };
}

export default async function BlogPage() {
  const body = await seoFetch<{ posts: PostSummary[] }>("/blog", 5000);
  const posts = body?.posts ?? [];

  return (
    <>
      <PageSeoExtras path="/blog" />
    <div className="bg-obsidian-50 text-obsidian-900">
      <BreadcrumbJsonLd origin={siteOrigin()} items={[{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]} />
      <section aria-label="Introduction" className="border-b border-obsidian-900/[0.06] bg-white">
        <div className="mx-auto max-w-3xl px-page pb-10 pt-10 text-center sm:pt-14">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
              <li>
                <Link href="/" className="hover:text-obsidian-900 hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-obsidian-900">
                Blog
              </li>
            </ol>
          </nav>
          <h1 className="text-balance text-4xl font-light tracking-tight text-obsidian-900 sm:text-5xl">The Vista Chase blog</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-light leading-relaxed text-slate-700">Stories and planning tips from Banff and the Canadian Rockies.</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-page py-12">
        {posts.length === 0 ? (
          <p className="text-center text-slate-700">
            No posts are published here yet. Our <Link href="/guides" className="text-ocean-600 underline">travel guides</Link> and <Link href="/faq" className="text-ocean-600 underline">FAQ</Link> cover the common planning questions.
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => {
              const img = cardImage(p);
              return (
                <li key={p.path}>
                  <MediaCard
                    href={p.path}
                    image={img.src}
                    imageAlt={img.alt}
                    sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
                    aspect="aspect-[16/10]"
                    eyebrow={p.datePublished ? date(p.datePublished) : "Blog"}
                    eyebrowIcon={CalendarDays}
                    title={p.label}
                    description={p.excerpt ?? undefined}
                    cta="Read the post"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
    </>
  );
}
