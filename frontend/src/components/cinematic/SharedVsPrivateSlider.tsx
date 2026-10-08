"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Users, CarFront, Check, ArrowRight, Star, ShieldCheck, Sparkles, Clock, MapPin } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

export function SharedVsPrivateSlider() {
  const [selectedMode, setSelectedMode] = useState<"shared" | "private">("shared");

  return (
    <section className="py-24 sm:py-32 bg-obsidian-950 text-white relative overflow-hidden border-b border-white/10">
      <div className="max-w-6xl mx-auto px-6 sm:px-12 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <ScrollReveal delay={100} yOffset={16}>
            <span className="text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase text-summit-400 block">
              EXPERIENCE COMPARISON
            </span>
          </ScrollReveal>
          <ScrollReveal delay={200} yOffset={20}>
            <h2 className="mt-2 text-3xl sm:text-5xl font-serif font-light text-white leading-[1.1]">
              Shared Tours vs Private SUV Tours
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={300} yOffset={16}>
            <p className="mt-3 text-slate-300 text-sm sm:text-base font-light">
              Toggle between our award-winning small groups and bespoke private expeditions to find your perfect fit.
            </p>
          </ScrollReveal>

          {/* Interactive Toggle Switch */}
          <ScrollReveal delay={400} yOffset={16}>
            <div
              role="tablist"
              aria-label="Experience Mode Selector"
              className="mt-8 inline-flex p-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15"
            >
              <button
                role="tab"
                type="button"
                aria-selected={selectedMode === "shared"}
                onClick={() => setSelectedMode("shared")}
                className={`px-6 py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                  selectedMode === "shared"
                    ? "golden-summit-btn text-obsidian-900 shadow-md"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Shared Small-Group</span>
              </button>

              <button
                role="tab"
                type="button"
                aria-selected={selectedMode === "private"}
                onClick={() => setSelectedMode("private")}
                className={`px-6 py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                  selectedMode === "private"
                    ? "golden-summit-btn text-obsidian-900 shadow-md"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <CarFront className="w-4 h-4" />
                <span>Luxury Private SUV</span>
              </button>
            </div>
          </ScrollReveal>
        </div>

        {/* Dynamic Interactive Card Display */}
        <div className="relative">
          {selectedMode === "shared" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center p-8 sm:p-12 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/15 shadow-2xl transition-all duration-500 animate-fadeIn">
              <div className="lg:col-span-5 relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900">
                <Image
                  src="/media/photos/moraine-lake-red-canoes.webp"
                  alt="Shared small group tour"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 400px"
                />
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-summit-300 text-xs font-semibold">
                  TripAdvisor #6 in Canada
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div>
                  <span className="text-xs uppercase tracking-widest text-summit-400 font-bold block mb-1">
                    Best for Couples, Solo Travelers &amp; Small Families
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-serif font-light text-white">
                    Shared Small-Group Tour Experience
                  </h3>
                  <p className="mt-2 text-sm text-slate-300 font-light leading-relaxed">
                    Social and intimate atmosphere capped at 12 guests. See Banff&apos;s iconic 8–9 landmarks in one comfortable day
                    with a dedicated interpretive guide, doorstep hotel pickup, and commercial lake access.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-summit-500 shrink-0" />
                    <span>Max 12 Guests per vehicle</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-summit-500 shrink-0" />
                    <span>High-roof Mercedes Sprinter</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-summit-500 shrink-0" />
                    <span>Fixed departure timing (8:30 AM)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-summit-500 shrink-0" />
                    <span>Free 24h cancellation</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase text-slate-400 block">Pricing from</span>
                    <span className="text-3xl font-serif font-light text-white">$189 CAD</span>
                    <span className="text-xs text-slate-400 ml-1">/ guest</span>
                  </div>

                  <Link
                    href="/banff-highlights-tour"
                    className="py-3.5 px-6 rounded-xl golden-summit-btn text-obsidian-900 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                  >
                    <span>View Shared Highlights</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center p-8 sm:p-12 rounded-3xl bg-white/5 backdrop-blur-2xl border border-summit-500/30 shadow-2xl transition-all duration-500 animate-fadeIn">
              <div className="lg:col-span-5 relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900">
                <Image
                  src="/media/photos/cadillac-escalade-iql-side.webp"
                  alt="Luxury private SUV tour"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 400px"
                />
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-summit-400 text-xs font-semibold">
                  Exclusive Private Fleet
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div>
                  <span className="text-xs uppercase tracking-widest text-summit-400 font-bold block mb-1">
                    Best for Discerning Families, Private Parties &amp; Photographers
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-serif font-light text-white">
                    Luxury Private SUV Tour Experience
                  </h3>
                  <p className="mt-2 text-sm text-slate-300 font-light leading-relaxed">
                    Total exclusivity. Handcraft your day with a private guide and luxury GMC Yukon Denali XL. Stop whenever you
                    wish, linger at secluded viewpoints, and depart at sunrise or midday on your schedule.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-summit-500 shrink-0" />
                    <span>Exclusive private vehicle for your party</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-summit-500 shrink-0" />
                    <span>GMC Yukon XL / Cadillac Escalade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-summit-500 shrink-0" />
                    <span>100% custom departure &amp; pacing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-summit-500 shrink-0" />
                    <span>Free 24h cancellation</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase text-slate-400 block">Flat Rate from</span>
                    <span className="text-3xl font-serif font-light text-white">$1,250 CAD</span>
                    <span className="text-xs text-slate-400 ml-1">/ vehicle (up to 6)</span>
                  </div>

                  <Link
                    href="/banff-private-tour"
                    className="py-3.5 px-6 rounded-xl golden-summit-btn text-obsidian-900 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                  >
                    <span>Design Private Tour</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
