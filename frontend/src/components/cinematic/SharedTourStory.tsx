"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Users, CheckCircle2, MapPin, Coffee, Binoculars, ArrowRight, Star } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const SHARED_BENEFITS = [
  {
    icon: Users,
    title: "Small Groups (Max 12)",
    description: "Travel with an intimate party of fellow explorers. No 50-passenger buses or waiting in crowded lines.",
  },
  {
    icon: MapPin,
    title: "Guaranteed Commercial Access",
    description: "Bypass the 3:00 AM personal car parking restrictions with authorized commercial permits straight to the lakeshore.",
  },
  {
    icon: CheckCircle2,
    title: "Door-to-Door Hotel Pickup",
    description: "Complimentary morning pickup and evening drop-off at your hotel in Banff and Canmore.",
  },
  {
    icon: Binoculars,
    title: "Certified Mountain Guide",
    description: "Local interpretive specialists sharing wildlife spots, geological history, and unhurried photo stops.",
  },
  {
    icon: Coffee,
    title: "Hot Beverages & Spotting Scopes",
    description: "Complimentary hot French roast coffee, cocoa, and high-power spotting scopes for alpine bighorn and bears.",
  },
];

export function SharedTourStory() {
  return (
    <section id="shared-tours" className="py-24 sm:py-32 bg-white text-obsidian-900 border-b border-black/5">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Visual Storytelling Media */}
          <div className="lg:col-span-6 relative">
            <ScrollReveal delay={150} yOffset={24}>
              <div className="relative aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5] w-full rounded-3xl overflow-hidden shadow-2xl bg-slate-900 border border-black/10 group">
                <Image
                  src="/media/photos/moraine-lake-red-canoes.webp"
                  alt="Shared small group tour at Moraine Lake with red canoes"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/80 via-transparent to-transparent" />

                {/* Verified Award Chip */}
                <div className="absolute top-5 left-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-medium">
                  <Star className="w-3.5 h-3.5 fill-summit-500 text-summit-500" />
                  <span>TripAdvisor #6 Best Experience in Canada</span>
                </div>

                {/* Bottom Overlay Summary */}
                <div className="absolute bottom-6 left-6 right-6 p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white">
                  <span className="text-xs uppercase tracking-widest text-summit-300 font-semibold block mb-1">
                    Value &amp; Intimacy
                  </span>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-serif font-light text-white">$189 CAD</span>
                      <span className="text-xs text-slate-300 ml-1.5">per guest</span>
                    </div>
                    <span className="text-xs text-emerald-300 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Free 24h cancellation
                    </span>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Right Column: Editorial Narrative & Staggered Benefits */}
          <div className="lg:col-span-6 space-y-8">
            <div className="space-y-3">
              <ScrollReveal delay={100} yOffset={16}>
                <span className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-ocean-600 block">
                  EXPERIENCE PILLAR 01 · SHARED SMALL-GROUP
                </span>
              </ScrollReveal>

              <ScrollReveal delay={200} yOffset={20}>
                <h2 className="text-3xl sm:text-5xl font-serif font-light tracking-tight text-obsidian-900 leading-[1.1]">
                  Why Choose a Shared Tour?
                </h2>
              </ScrollReveal>

              <ScrollReveal delay={300} yOffset={16}>
                <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-sans font-light">
                  Designed for travelers who want the rich storytelling and personalized attention of a local guide,
                  without the cost of chartering a private vehicle. Capped at 12 guests, every stop feels relaxed and unhurried.
                </p>
              </ScrollReveal>
            </div>

            {/* Animated Benefit List */}
            <div className="space-y-4 pt-2">
              {SHARED_BENEFITS.map((b, idx) => (
                <ScrollReveal key={b.title} delay={200 + idx * 80} yOffset={16}>
                  <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:border-ocean-500/30 hover:bg-frost-white transition-all">
                    <div className="w-10 h-10 rounded-lg bg-ocean-50 text-ocean-600 flex items-center justify-center shrink-0 mt-0.5">
                      <b.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-obsidian-900 font-sans">{b.title}</h3>
                      <p className="text-xs sm:text-sm text-slate-600 font-light mt-0.5 leading-relaxed">{b.description}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            {/* Primary Action Button */}
            <ScrollReveal delay={600} yOffset={16}>
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
                <Link
                  href="/banff-highlights-tour"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl golden-summit-btn text-obsidian-900 font-semibold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                >
                  <span>Explore Shared Highlights Tour</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/shared-tours"
                  className="w-full sm:w-auto text-sm text-ocean-700 font-semibold hover:text-ocean-900 py-2 flex items-center justify-center gap-1.5"
                >
                  <span>See all shared departures</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
