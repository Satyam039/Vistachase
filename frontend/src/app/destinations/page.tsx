// Destinations, in the "Top destinations" pattern of the booking sites studied: photo hero, then
// image-on-top cards (MediaCard) with parallax and the number of tours based there (places visited on
// other destinations' tours, like Lake Louise, show no count).

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, MapPin } from "lucide-react";
import { MediaCard } from "@/components/cards/MediaCard";
import { getDestinations } from "@/lib/api/catalog";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";

const baseMetadata: Metadata = {
  title: "Canadian Rockies Destinations | Banff, Lake Louise, Moraine Lake & Jasper | Vista Chase",
  description: "Moraine Lake, Lake Louise, Banff, Yoho and Jasper national parks: where Vista Chase tours go and how to see them.",
  alternates: { canonical: "/destinations" },
};

// Card widths on large screens: the first two share the first row, the rest the second. Every
// card is a MediaCard (photo on top, content below); cards in a row share an aspect so they line up.
const SPAN = ["lg:col-span-3", "lg:col-span-3", "lg:col-span-2", "lg:col-span-2", "lg:col-span-2"];
const ASPECT = ["aspect-[5/4] sm:aspect-[21/9] lg:aspect-[16/9]", "aspect-[5/4] lg:aspect-[16/9]", "aspect-[5/4]", "aspect-[5/4]", "aspect-[5/4]"];

export default async function DestinationsPage() {
  const destinations = await getDestinations();

  return (
    <>
      <PageSeoExtras path="/destinations" />
    <div className="bg-obsidian-50 text-obsidian-900">
      <section className="relative isolate flex min-h-[56vh] items-end overflow-hidden bg-obsidian-950 text-white">
        <Image src="/media/photos/peyto-lake.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover" data-parallax="10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/40 to-ocean-950/10" />
        <div className="mx-auto flex w-full flex-col items-center text-center max-w-7xl px-page pb-12 pt-24" data-scroll-fade>
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center justify-center gap-1.5 text-sm text-slate-200">
              <li>
                <Link href="/" className="hover:text-white hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-white">
                Destinations
              </li>
            </ol>
          </nav>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-6xl motion-safe:animate-[fadeUp_900ms_ease-out]">
            Where our tours go
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-light leading-relaxed text-white/85 motion-safe:animate-[fadeUp_1100ms_ease-out]">
            Five of the Canadian Rockies&rsquo; great places, from Moraine Lake&rsquo;s Ten Peaks to Jasper&rsquo;s Spirit Island.
          </p>
        </div>
      </section>

      <section aria-label="Destinations" className="mx-auto max-w-7xl px-page py-14 sm:py-20">
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6" data-stagger>
          {destinations.map((d, i) => {
            const count = d.tours.length;
            return (
              <li key={d.id} className={`${SPAN[i] ?? "lg:col-span-2"} ${i === 0 ? "sm:col-span-2" : ""}`}>
                <MediaCard
                  href={`/destinations/${d.slug}`}
                  image={d.heroImage}
                  sizes={i < 2 ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 640px" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"}
                  aspect={ASPECT[i] ?? "aspect-[5/4]"}
                  eyebrow={d.province}
                  eyebrowIcon={MapPin}
                  title={d.name}
                  headingLevel={2}
                  description={d.description}
                  cta={count > 0 ? `${count} ${count === 1 ? "tour" : "tours"} · Explore` : "Explore"}
                  parallax
                />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
    </>
  );
}

export function generateMetadata(): Promise<Metadata> {
  return withSeo("/destinations", baseMetadata);
}
