"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ShieldCheck, Star } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";
import { HeroReviewSlider } from "@/components/cinematic/HeroReviewSlider";

interface CinematicHeroProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  posterImage?: string;
  videoSrc?: string;
  /** 1080p encode for large screens. */
  videoSrcHd?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
}

export function CinematicHero({
  eyebrow = "VISTA CHASE • CANADIAN ROCKIES • SHARED • PRIVATE • SHUTTLES",
  title = "Discover the Canadian Rockies Your Way",
  subtitle = "Whether you seek the unhurried luxury of a private SUV expedition, the warm camaraderie of an intimate small group (max 12), or guaranteed commercial shuttles to Moraine Lake and Lake Louise — Vista Chase crafts unforgettable alpine journeys.",
  posterImage = "/media/videos/lake-louise-summer-poster.webp",
  videoSrc,
  videoSrcHd,
  primaryCtaLabel = "Explore Experiences",
  primaryCtaHref = "#experiences",
  secondaryCtaLabel = "Book Your Experience",
  secondaryCtaHref = "/banff-highlights-tour",
}: CinematicHeroProps) {
  return (
    <section className="relative w-full min-h-[95vh] lg:min-h-screen flex items-center justify-center overflow-hidden bg-obsidian-950">
      {/* Background Media Layer */}
      <div className="absolute inset-0 z-0">
        <Image
          src={posterImage}
          alt="Canadian Rockies Panorama"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center scale-[1.02] transition-transform duration-1000 ease-out"
        />
        {videoSrc && (
          <AmbientVideo
            src={videoSrc}
            srcHd={videoSrcHd}
            poster={posterImage}
            className="absolute inset-0 w-full h-full object-cover"
            buttonClassName="bottom-6 right-6"
          />
        )}
        {/* Layered cinematic overlays */}
        <div className="absolute inset-0 cinematic-scrim" />
        <div className="absolute inset-0 bg-ocean-950/45" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 pt-32 pb-24 sm:py-36 text-center flex flex-col items-center">
        {/* Top Eyebrow */}
        <ScrollReveal delay={100} yOffset={16}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs sm:text-sm font-medium tracking-[0.2em] uppercase mb-6 text-summit-300">
            <span className="w-1.5 h-1.5 rounded-full bg-summit-500 animate-pulse" />
            {eyebrow}
          </div>
        </ScrollReveal>

        {/* Main Headline - Editorial Luxury Typography (Non-bold, Spacious) */}
        <ScrollReveal delay={250} yOffset={24}>
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[5.25rem] font-serif font-light text-white tracking-tight leading-[1.05] max-w-5xl text-balance drop-shadow-md">
            {title}
          </h1>
        </ScrollReveal>

        {/* Supporting Narrative */}
        <ScrollReveal delay={400} yOffset={20}>
          <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-200/90 max-w-3xl leading-relaxed font-sans font-light">
            {subtitle}
          </p>
        </ScrollReveal>

        {/* Dual Luxury CTAs */}
        <ScrollReveal delay={550} yOffset={20}>
          <div className="mt-9 flex flex-col sm:flex-row items-center gap-4 sm:gap-5 w-full sm:w-auto">
            <Link
              href={primaryCtaHref}
              className="w-full sm:w-auto px-8 py-4 rounded-xl golden-summit-btn text-base font-semibold flex items-center justify-center gap-2 text-center shadow-xl hover:shadow-summit-500/20"
            >
              <span>{primaryCtaLabel}</span>
            </Link>
            <Link
              href={secondaryCtaHref}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 transition-all duration-300 text-base font-medium text-center hover:translate-y-[-2px]"
            >
              <span>{secondaryCtaLabel}</span>
            </Link>
          </div>
        </ScrollReveal>

        {/* Verified TripAdvisor & Multi-Source Review Slider */}
        <ScrollReveal delay={700} yOffset={20} className="w-full mt-12">
          <HeroReviewSlider />
        </ScrollReveal>
      </div>

      {/* Floating Scroll Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden sm:flex flex-col items-center gap-1.5 text-white/50 text-xs uppercase tracking-widest pointer-events-none animate-bounce">
        <span>Scroll</span>
        <ChevronDown className="w-4 h-4" />
      </div>
    </section>
  );
}
