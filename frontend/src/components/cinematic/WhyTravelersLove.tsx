"use client";

import React from "react";
import Image from "next/image";
import { CheckCircle2, ShieldCheck, HeartHandshake, Mountain, Sparkles, Clock } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const REASONS = [
  {
    icon: ShieldCheck,
    title: "Hassle-Free Access",
    description: "We handle all timing, commercial access permits, and Parks Canada logistics so you bypass roadside congestion.",
  },
  {
    icon: Sparkles,
    title: "Luxury SUVs & Clean Shuttles",
    description: "Full-size GMC Yukon Denali XL VIPs and modern Mercedes-Benz Sprinter Executive vans maintained to pristine standards.",
  },
  {
    icon: Mountain,
    title: "Local Certified Guides",
    description: "Intimate mountain history, wildlife safety, geology stories, and unhurried photo assistance from local residents.",
  },
  {
    icon: HeartHandshake,
    title: "Eco-Friendly Footprint",
    description: "Shared routes and efficient passenger groupings minimize national park congestion and reduce carbon per traveler.",
  },
  {
    icon: CheckCircle2,
    title: "Top-Ranked Hospitality",
    description: "Named TripAdvisor’s #6 experience in Canada, rated 5.0 from more than 1,000 reviews.",
  },
  {
    icon: Clock,
    title: "Free cancellation",
    description: "A full refund when you cancel at least 24 hours before your tour, with your voucher sent by email.",
  },
];

export function WhyTravelersLove() {
  return (
    <section className="py-24 sm:py-32 bg-ocean-950 text-white relative overflow-hidden">
      {/* Background Horse Emblem Watermark */}
      <div className="absolute right-[-80px] top-1/2 -translate-y-1/2 w-[550px] h-[550px] opacity-5 pointer-events-none">
        <Image
          src="/media/brand/horse-emblem-gold.png"
          alt=""
          fill
          className="object-contain"
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-12 relative z-10">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <ScrollReveal delay={100} yOffset={16}>
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm  tracking-[0.2em] uppercase text-summit-400 mb-3">
              <span>THE VISTA CHASE STANDARD</span>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200} yOffset={20}>
            <h2 className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
              Why Travelers Choose Vista Chase
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={300} yOffset={16}>
            <p className="mt-4 text-base sm:text-lg text-slate-300 font-light leading-relaxed">
              Awarded TripAdvisor’s Travelers’ Choice Best of the Best 2025. Here is how we redefine the Canadian Rockies journey.
            </p>
          </ScrollReveal>
        </div>

        {/* 2-Column Layout: Visual + 6 Pillars */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Certified Guide Image Card */}
          <div className="lg:col-span-5">
            <ScrollReveal delay={200} yOffset={28}>
              <div className="relative rounded-[2rem] overflow-hidden border border-white/10 group">
                <div className="relative h-[480px] sm:h-[540px] w-full">
                  <Image
                    src="/media/site/feature-image-1.webp"
                    alt="Vista Chase Certified Mountain Guide"
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                    data-parallax="10"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ocean-950 via-transparent to-transparent opacity-80" />
                </div>
                {/* Overlay Badge */}
                <div className="absolute bottom-6 left-6 right-6 p-5 rounded-xl glass-panel-alpine text-white">
                  <p className="text-xs uppercase tracking-widest text-summit-400  mb-1">
                    CANMORE & BANFF NATIVE TEAM
                  </p>
                  <p className="text-sm font-light text-slate-200">
                    &ldquo;Our guides don&apos;t just drive — they unlock hidden perspectives most visitors drive right past.&rdquo;
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Right Column: 6 Grid Pillars */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {REASONS.map((reason, idx) => {
              const Icon = reason.icon;
              return (
                <ScrollReveal key={idx} delay={100 * (idx + 1)} yOffset={20}>
                  <div className="h-full p-6 rounded-3xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all duration-300 hover:-translate-y-1">
                    <div className="w-10 h-10 rounded-lg bg-summit-500/10 border border-summit-500/30 flex items-center justify-center text-summit-400 mb-4">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg  text-white font-display mb-2">
                      {reason.title}
                    </h3>
                    <p className="text-sm text-slate-300 font-light leading-relaxed">
                      {reason.description}
                    </p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
