import Image from "next/image";
import Link from "next/link";
import { Users, Clock, Star, Award, ShieldCheck, CheckCircle2 } from "lucide-react";
import { getTours } from "@/modules/tours/tour.repository";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Tours in Banff & Lake Louise | Vista Chase (Max 12 Guests)",
  description:
    "Explore Banff, Moraine Lake, and Lake Louise with award-winning small group shared tours. Max 12 passengers, local expert guides, and guaranteed access.",
  alternates: {
    canonical: "/shared-tours",
  },
};

export default async function SharedToursPage() {
  const tours = await getTours({ category: "SHARED" });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Hero */}
      <section className="bg-forest-950 text-white py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-900 border border-gold-400/40 text-gold-300 text-xs font-semibold">
            <Award className="w-4 h-4 text-gold-400" />
            <span>TripAdvisor Best of the Best 2025 • Canada Top 10</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-display text-white">
            Shared Small-Group Tours
          </h1>
          <p className="text-slate-300 max-w-2xl text-base leading-relaxed">
            Experience the Canadian Rockies with intimate groups capped strictly at 12 passengers. More personal attention, better photo spots, and zero crowded tour buses.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tours.map((tour) => (
            <div
              key={tour.id}
              className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-card hover:shadow-xl transition-all flex flex-col justify-between group"
            >
              <div className="relative h-56 w-full">
                <Image
                  src={tour.featuredImage}
                  alt={tour.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-forest-950/80 backdrop-blur-md text-gold-300 text-xs font-semibold">
                  {tour.destination.name}
                </div>
              </div>

              <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{tour.durationHours} Hours</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>Max {tour.maxGroupSize} Guests</span>
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-forest-950 group-hover:text-forest-700 transition-colors">
                    <Link href={`/${tour.slug}`}>{tour.title}</Link>
                  </h2>
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {tour.summary}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500">Price per guest</span>
                    <p className="text-xl font-bold text-forest-950">
                      ${tour.basePrice} <span className="text-xs font-normal">{tour.currency}</span>
                    </p>
                  </div>
                  <Link
                    href={`/${tour.slug}`}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs text-forest-950 gold-gradient hover:opacity-95 transition-opacity"
                  >
                    View &amp; Book
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
