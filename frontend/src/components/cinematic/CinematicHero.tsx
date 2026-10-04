"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ShieldCheck, Star } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

interface CinematicHeroProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  posterImage?: string;
  videoSrc?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
}

export function CinematicHero({
  eyebrow = "VISTA CHASE • CANADIAN ROCKIES",
  title = "Discover the Canadian Rockies Your Way",
  subtitle = "Whether you want the freedom of a luxury private SUV tour, the fun of a shared small group adventure, or guaranteed shuttles to Moraine Lake and Lake Louise — Vista Chase makes it effortless, scenic, and unforgettable.",
  posterImage = "/media/site/hero-background-image-3.webp",
  videoSrc,
  primaryCtaLabel = "Explore Experiences",
  primaryCtaHref = "#experiences",
  secondaryCtaLabel = "Book Your Experience",
  secondaryCtaHref = "/banff-private-tour",
}: CinematicHeroProps) {
  return (
    <section className="relative w-full min-h-[92vh] lg:min-h-screen flex items-center justify-center overflow-hidden bg-ocean-950">
      {/* Background Media Layer */}
      <div className="absolute inset-0 z-0">
        <Image
          src={posterImage}
          alt="Canadian Rockies Panorama"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center scale-[1.03] transition-transform duration-1000 ease-out"
        />
        {videoSrc && (
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={posterImage}
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        )}
        {/* Layered cinematic overlays */}
        <div className="absolute inset-0 cinematic-scrim" />
        <div className="absolute inset-0 bg-ocean-950/40" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 py-32 sm:py-36 text-center flex flex-col items-center">
        {/* Top Eyebrow */}
        <ScrollReveal delay={100} yOffset={16}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase mb-6 text-gold-300">
            <span className="w-1.5 h-1.5 rounded-full bg-summit-500 animate-ping" />
            {eyebrow}
          </div>
        </ScrollReveal>

        {/* Main Headline */}
        <ScrollReveal delay={250} yOffset={24}>
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[5rem] font-bold text-white tracking-tight leading-[1.08] font-display max-w-5xl text-balance drop-shadow-md">
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
          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-5 w-full sm:w-auto">
            <Link
              href={primaryCtaHref}
              className="w-full sm:w-auto px-8 py-4 rounded-md golden-summit-btn text-base sm:text-lg flex items-center justify-center gap-2 text-center"
            >
              <span>{primaryCtaLabel}</span>
            </Link>
            <Link
              href={secondaryCtaHref}
              className="w-full sm:w-auto px-8 py-4 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 transition-all duration-300 text-base sm:text-lg font-medium text-center hover:translate-y-[-2px]"
            >
              <span>{secondaryCtaLabel}</span>
            </Link>
          </div>
        </ScrollReveal>

        {/* Verified TripAdvisor Pill */}
        <ScrollReveal delay={700} yOffset={16}>
          <div className="mt-12 inline-flex items-center gap-3 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/90 text-xs sm:text-sm">
            <div className="flex items-center text-summit-500">
              <Star className="w-4 h-4 fill-summit-500" />
              <Star className="w-4 h-4 fill-summit-500" />
              <Star className="w-4 h-4 fill-summit-500" />
              <Star className="w-4 h-4 fill-summit-500" />
              <Star className="w-4 h-4 fill-summit-500" />
            </div>
            <span className="font-semibold text-summit-400">#6 Experience in Canada</span>
            <span className="text-white/40">•</span>
            <span className="text-white/80">TripAdvisor Travelers’ Choice 2025</span>
          </div>
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
