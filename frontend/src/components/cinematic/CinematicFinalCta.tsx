"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Clock, MapPin } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

export function CinematicFinalCta() {
  return (
    <section className="relative w-full py-28 sm:py-36 flex items-center justify-center overflow-hidden bg-ocean-950 text-white">
      {/* Background Mountain Panorama */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/6910165a83d5d1c9a1102f73_Explore%20More%20section%20Background%20image.webp"
          alt="Canadian Rockies Panorama"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-ocean-950/80" />
        <div className="absolute inset-0 cinematic-scrim" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-12 text-center flex flex-col items-center">
        <ScrollReveal delay={100} yOffset={16}>
          <span className="text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase text-summit-400 mb-4 block">
            THE ROCKIES AWAIT
          </span>
        </ScrollReveal>

        <ScrollReveal delay={200} yOffset={24}>
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-bold font-display text-white tracking-tight leading-[1.08]">
            Your Rockies Story Starts Here
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={300} yOffset={16}>
          <p className="mt-6 text-base sm:text-xl text-slate-200 font-light max-w-2xl leading-relaxed">
            From the glass-calm sunrise reflections of Moraine Lake to custom private journeys through Jasper. Experience Alberta with Canada’s top-rated team.
          </p>
        </ScrollReveal>

        {/* Dual Luxury CTAs */}
        <ScrollReveal delay={450} yOffset={20}>
          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-5 w-full sm:w-auto">
            <Link
              href="/search"
              className="w-full sm:w-auto px-9 py-4 rounded-md golden-summit-btn text-base sm:text-lg flex items-center justify-center gap-2"
            >
              <span>Explore All Experiences</span>
              <ArrowUpRight className="w-5 h-5" />
            </Link>
            <Link
              href="/multi-day-tour-package-for-banff"
              className="w-full sm:w-auto px-8 py-4 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 transition-all duration-300 text-base sm:text-lg font-medium"
            >
              <span>Plan Multi-Day Journey</span>
            </Link>
          </div>
        </ScrollReveal>

        {/* Triple Reassurance Badges */}
        <ScrollReveal delay={600} yOffset={16}>
          <div className="mt-14 pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-summit-400" />
              <span>Free 48-Hour Cancellation</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Official Parks Canada Permits</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-ocean-400" />
              <span>Canmore Operational Base</span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
