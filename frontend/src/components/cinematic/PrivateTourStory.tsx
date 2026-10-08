"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { CarFront, Clock, ShieldCheck, Compass, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const PRIVATE_BENEFITS = [
  {
    icon: CarFront,
    title: "Dedicated Luxury SUV Fleet",
    description: "Travel in premium GMC Yukon Denali XL or Cadillac Escalade featuring heated leather captain seats and panoramic glass.",
  },
  {
    icon: Compass,
    title: "Bespoke Itinerary Handcrafted for You",
    description: "Spend extra hours at Moraine Lake, hike Johnston Canyon, or pause for unhurried wildlife viewing. Your route follows your rhythm.",
  },
  {
    icon: Clock,
    title: "Departure Timing of Your Choice",
    description: "Catch first light over the Valley of the Ten Peaks at 5:00 AM or take a leisurely late-morning start after brunch.",
  },
  {
    icon: Sparkles,
    title: "Dedicated Private Guide & Chauffeur",
    description: "Your family or private party has 100% undivided attention from a certified Canadian Rockies mountain specialist.",
  },
  {
    icon: ShieldCheck,
    title: "Guaranteed Commercial Access Permits",
    description: "Full commercial authorization to drive directly to Moraine Lake and Lake Louise shorelines, bypassing all parking bans.",
  },
];

export function PrivateTourStory() {
  return (
    <section id="private-tours" className="py-24 sm:py-32 bg-ocean-950 text-white relative overflow-hidden border-b border-white/10">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 -right-40 w-96 h-96 bg-summit-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Editorial Narrative & Private Benefits */}
          <div className="lg:col-span-6 space-y-8 order-2 lg:order-1">
            <div className="space-y-3">
              <ScrollReveal delay={100} yOffset={16}>
                <span className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-summit-400 block">
                  EXPERIENCE PILLAR 02 · LUXURY PRIVATE SUV
                </span>
              </ScrollReveal>

              <ScrollReveal delay={200} yOffset={20}>
                <h2 className="text-3xl sm:text-5xl font-serif font-light tracking-tight text-white leading-[1.1]">
                  Why Choose a Private Tour?
                </h2>
              </ScrollReveal>

              <ScrollReveal delay={300} yOffset={16}>
                <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-sans font-light">
                  Tailored for discerning families, multi-generational groups, and landscape photographers.
                  Experience complete mountain seclusion with the comfort of heated leather captain seats and total schedule freedom.
                </p>
              </ScrollReveal>
            </div>

            {/* Animated Benefit List */}
            <div className="space-y-4 pt-2">
              {PRIVATE_BENEFITS.map((b, idx) => (
                <ScrollReveal key={b.title} delay={200 + idx * 80} yOffset={16}>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-summit-500/40 hover:bg-white/10 transition-all">
                    <div className="w-10 h-10 rounded-lg bg-summit-500/20 text-summit-400 flex items-center justify-center shrink-0 mt-0.5">
                      <b.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white font-sans">{b.title}</h3>
                      <p className="text-xs sm:text-sm text-slate-300 font-light mt-0.5 leading-relaxed">{b.description}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            {/* Primary Action Button */}
            <ScrollReveal delay={600} yOffset={16}>
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
                <Link
                  href="/banff-private-tour"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl golden-summit-btn text-obsidian-900 font-semibold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl hover:shadow-summit-500/20"
                >
                  <span>Design Your Private Tour</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/concierge"
                  className="w-full sm:w-auto text-sm text-summit-300 font-semibold hover:text-white py-2 flex items-center justify-center gap-1.5"
                >
                  <span>Chat with AI Mountain Concierge</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </ScrollReveal>
          </div>

          {/* Right Column: Visual Media with Fleet & Wilderness */}
          <div className="lg:col-span-6 relative order-1 lg:order-2">
            <ScrollReveal delay={150} yOffset={24}>
              <div className="relative aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5] w-full rounded-3xl overflow-hidden shadow-2xl bg-black border border-white/15 group">
                <Image
                  src="/media/photos/cadillac-escalade-iql-side.webp"
                  alt="Luxury GMC Yukon XL and Cadillac fleet in the Canadian Rockies"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent" />

                {/* Fleet VIP Badge */}
                <div className="absolute top-5 left-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-summit-300 text-xs font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-summit-500" />
                  <span>Exclusive Private Fleet (Up to 6 or 13 Guests)</span>
                </div>

                {/* Bottom Overlay Summary */}
                <div className="absolute bottom-6 left-6 right-6 p-6 rounded-2xl bg-black/50 backdrop-blur-md border border-white/15 text-white">
                  <span className="text-xs uppercase tracking-widest text-summit-400 font-semibold block mb-1">
                    Flat Vehicle Rate · Up to 6 Guests
                  </span>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-serif font-light text-white">$1,250 CAD</span>
                      <span className="text-xs text-slate-300 ml-1.5">entire vehicle</span>
                    </div>
                    <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Free 24h cancellation
                    </span>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
