// Destinations, in the "Top destinations" pattern of the booking sites studied: photo hero, then
// large image tiles (bento) with parallax and the number of tours based there (places visited on
// other destinations' tours, like Lake Louise, show no count).

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, ChevronRight, MapPin } from "lucide-react";
import { getDestinations } from "@/lib/api/catalog";

export const metadata: Metadata = {
  title: "Canadian Rockies Destinations | Banff, Lake Louise, Moraine Lake & Jasper | Vista Chase",
  description: "Moraine Lake, Lake Louise, Banff, Yoho and Jasper national parks: where Vista Chase tours go and how to see them.",
  alternates: { canonical: "/destinations" },
};

// Tile sizes for the bento grid on large screens (first two large).
const SPAN = ["lg:col-span-4 lg:row-span-2", "lg:col-span-2 lg:row-span-2", "lg:col-span-2", "lg:col-span-2", "lg:col-span-2"];

export default async function DestinationsPage() {
  const destinations = await getDestinations();

  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <section className="relative isolate flex min-h-[56vh] items-end overflow-hidden bg-ocean-950 text-white">
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
        <ul className="grid auto-rows-[22rem] grid-cols-1 gap-5 sm:grid-cols-2 lg:auto-rows-[18rem] lg:grid-cols-6" data-stagger>
          {destinations.map((d, i) => {
            const count = d.tours.length;
            const href = `/destinations/${d.slug}`;
            return (
              <li key={d.id} className={`${SPAN[i] ?? "lg:col-span-2"} ${i === 0 ? "sm:col-span-2" : ""}`}>
                <Link
                  href={href}
                  className="group relative flex h-full flex-col justify-end overflow-hidden rounded-[2rem] p-6 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ocean-600 sm:p-7"
                >
                  <div className="absolute inset-0 -z-0 overflow-hidden">
                    <div className="absolute inset-0 transition-transform duration-[1.4s] ease-out group-hover:scale-[1.06]">
                      <Image src={d.heroImage} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 60vw" className="object-cover" data-parallax="6" />
                    </div>
                    <div className="vc-scrim" aria-hidden="true" />
                  </div>
                  <div className="relative">
                    <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm text-white backdrop-blur-md">
                      <MapPin className="h-3.5 w-3.5 text-summit-300" aria-hidden="true" />
                      {d.province}
                    </p>
                    <h2 className={`font-light leading-tight text-white ${i < 2 ? "text-3xl sm:text-4xl" : "text-2xl"}`}>{d.name}</h2>
                    {i < 2 && <p className="mt-2 max-w-md text-base font-light leading-relaxed text-white/85 line-clamp-2">{d.description}</p>}
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-white">
                      <span className="border-b border-summit-500 pb-0.5">
                        {count > 0 ? `${count} ${count === 1 ? "tour" : "tours"} · Explore` : "Explore"}
                      </span>
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
