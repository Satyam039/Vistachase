// Travel guides index: every guide published from Admin → SEO → Pages ("New guide"), newest first.
// Guides are written in the SEO workspace and live at /guides/<slug>; this page only lists them.

import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { MediaCard } from "@/components/cards/MediaCard";
import { seoFetch, siteOrigin, withSeo } from "@/lib/seo/server";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

interface GuideSummary {
  path: string;
  label: string;
  excerpt: string | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
  publishedAt: string | null;
}

export const dynamic = "force-dynamic";

// Shown on a guide card when the guide has no featured image yet (decorative only).
const FALLBACK_IMAGE = "/media/photos/moraine-lake-perfect-reflection.webp";

export async function generateMetadata(): Promise<Metadata> {
  return withSeo("/guides", {
    title: "Banff travel guides | Vista Chase",
    description: "Trip-planning guides for Banff and the Canadian Rockies from the Vista Chase team.",
    alternates: { canonical: "/guides" },
  });
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Edmonton" });

export default async function GuidesPage() {
  const body = await seoFetch<{ guides: GuideSummary[] }>("/guides", 5000);
  const guides = body?.guides ?? [];

  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <BreadcrumbJsonLd origin={siteOrigin()} items={[{ name: "Home", path: "/" }, { name: "Travel guides", path: "/guides" }]} />
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
                Travel guides
              </li>
            </ol>
          </nav>
          <h1 className="text-balance text-4xl font-light tracking-tight text-obsidian-900 sm:text-5xl">Banff travel guides</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-light leading-relaxed text-slate-700">
            Planning notes for Banff and the Canadian Rockies from the people who drive the routes.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-page py-12">
        {guides.length === 0 ? (
          <p className="text-center text-slate-700">
            No guides are published yet. In the meantime, our <Link href="/faq" className="text-ocean-600 underline">FAQ</Link> answers the common planning questions.
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((g) => (
              <li key={g.path}>
                <MediaCard
                  href={g.path}
                  image={g.featuredImage?.startsWith("/media/") ? g.featuredImage : FALLBACK_IMAGE}
                  imageAlt={g.featuredImage?.startsWith("/media/") ? (g.featuredImageAlt ?? "") : ""}
                  sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
                  aspect="aspect-[16/10]"
                  eyebrow={g.publishedAt ? date(g.publishedAt) : "Travel guide"}
                  eyebrowIcon={CalendarDays}
                  title={g.label}
                  description={g.excerpt ?? undefined}
                  cta="Read the guide"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
