import Image from "next/image";
import Link from "next/link";
import { getDestinations } from "@/lib/api/catalog";
import { MapPin, ChevronRight, Compass } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Canadian Rockies Destinations | Banff, Lake Louise, Moraine Lake & Jasper | Vista Chase",
  description:
    "Explore the top destinations in the Canadian Rockies with Vista Chase: Moraine Lake, Lake Louise, Banff National Park, Jasper, Yoho, and Icefields Parkway.",
  alternates: {
    canonical: "/destinations",
  },
};

export default async function DestinationsPage() {
  const destinations = await getDestinations();

  return (
    <div className="min-h-screen bg-[#F9F9F7] text-[#1C1F23]">
      {/* 01. EDITORIAL HERO BANNER */}
      <section className="bg-[#0C1F21] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-12 relative overflow-hidden border-b border-white/10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[#FFE085] text-xs font-semibold uppercase tracking-wider border border-white/15">
            <Compass className="w-3.5 h-3.5 text-[#F5BF03]" />
            <span>Canadian Rockies Destination Guide</span>
          </div>

          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl sm:text-6xl font-light font-serif tracking-tight text-white leading-[1.1]">
              Iconic Mountain Destinations
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-sans">
              From the turquoise waters of Moraine Lake to the ancient glaciers of the Icefields Parkway, discover
              the world-renowned alpine landscapes we guide every day.
            </p>
          </div>
        </div>
      </section>

      {/* 02. DESTINATION CARDS GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {destinations.map((dest) => (
            <article
              key={dest.id}
              className="group relative rounded-3xl overflow-hidden bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-[#3A9CA6]/40 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
                  <Image
                    src={dest.heroImage}
                    alt={dest.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80" />

                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1C1F23]/80 backdrop-blur-md text-[#FFE085] text-xs font-semibold uppercase tracking-wider border border-white/10">
                      <MapPin className="w-3 h-3 text-[#F5BF03]" />
                      {dest.province}
                    </span>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <h2 className="text-2xl font-serif font-light text-white leading-tight">
                      <Link href={`/destinations/${dest.slug}`}>
                        <span className="absolute inset-0 z-10" />
                        {dest.name}
                      </Link>
                    </h2>
                  </div>
                </div>

                <div className="p-6 space-y-3">
                  <p className="text-xs sm:text-sm text-slate-600 line-clamp-3 leading-relaxed">
                    {dest.description}
                  </p>
                </div>
              </div>

              <div className="p-6 pt-0 mt-auto">
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    {dest.tours.length} {dest.tours.length === 1 ? "Experience" : "Experiences"} Available
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#3A9CA6] group-hover:translate-x-1 transition-transform">
                    <span>Explore Story</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
