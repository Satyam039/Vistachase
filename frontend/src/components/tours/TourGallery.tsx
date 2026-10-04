"use client";

import Link from "next/link";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { TourCard } from "@/components/tours/TourCard";
import type { TourWithAvailability } from "@/lib/api/types";

export function TourGallery({
  heading,
  intro,
  ctaLabel,
  ctaHref,
  tours,
}: {
  heading: string;
  intro: string;
  ctaLabel: string;
  ctaHref: string;
  tours: TourWithAvailability[];
}) {
  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* Editorial Header Banner */}
      <section className="bg-ocean-900 text-white pt-24 pb-16 px-4 sm:px-6 lg:px-12 border-b border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient pointer-events-none opacity-20" />
        <div className="max-w-7xl mx-auto space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-summit-300 text-xs font-semibold uppercase tracking-wider border border-white/15">
            <Compass className="w-3.5 h-3.5 text-summit-500" />
            <span>Canadian Rockies Curated Journeys</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="space-y-4 max-w-3xl">
              <h1 className="text-4xl sm:text-6xl font-light font-serif tracking-tight text-white leading-[1.1]">
                {heading}
              </h1>
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-sans max-w-2xl">
                {intro}
              </p>
            </div>

            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest text-obsidian-900 golden-summit-btn shadow-lg shrink-0"
            >
              <span>{ctaLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Grid of Experiences */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-16">
        {tours.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto space-y-4">
            <Sparkles className="w-8 h-8 text-summit-500 mx-auto" />
            <h2 className="text-2xl font-serif text-obsidian-900">Upcoming Departures In Preparation</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              New seasonal dates for this collection are being finalized. Connect with our AI concierge or concierge team
              for bespoke private arrangements.
            </p>
            <Link
              href="/concierge"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-obsidian-900 golden-summit-btn"
            >
              Consult Concierge
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tours.map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
