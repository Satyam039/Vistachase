import Image from "next/image";
import Link from "next/link";
import { getDestinations } from "@/lib/api/catalog";
import { MapPin, ChevronRight } from "lucide-react";
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <section className="bg-forest-950 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-900 border border-gold-400/40 text-gold-300 text-xs font-semibold">
            <MapPin className="w-4 h-4 text-gold-400" />
            <span>Canadian Rockies Destination Guide</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-display text-white">
            Iconic Mountain Destinations
          </h1>
          <p className="text-slate-300 max-w-2xl text-base leading-relaxed">
            From the turquoise waters of Moraine Lake to the glaciers of the Icefields Parkway, discover the world-renowned landscapes we guide every day.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {destinations.map((dest) => (
            <div
              key={dest.id}
              className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-card hover:shadow-xl transition-all flex flex-col justify-between group"
            >
              <div className="relative h-60 w-full overflow-hidden">
                <Image
                  src={dest.heroImage}
                  alt={dest.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-forest-950/80 backdrop-blur-md text-gold-300 text-xs font-semibold">
                  {dest.province}
                </div>
              </div>

              <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-forest-950 group-hover:text-forest-700 transition-colors">
                    <Link href={`/destinations/${dest.slug}`}>{dest.name}</Link>
                  </h2>
                  <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                    {dest.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {dest.tours.length} {dest.tours.length === 1 ? "Tour" : "Tours"} Available
                  </span>
                  <Link
                    href={`/destinations/${dest.slug}`}
                    className="text-xs font-bold text-forest-800 hover:text-gold-600 flex items-center gap-1 transition-colors"
                  >
                    <span>Explore Destination</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
