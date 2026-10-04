"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

export interface MediaStoryProps {
  media: string;
  mediaType?: "image" | "video";
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  alignment?: "left" | "right" | "center";
  overlayStrength?: number;
  badge?: string;
}

export function MediaStory({
  media,
  mediaType = "image",
  eyebrow,
  title,
  description,
  ctaLabel = "Explore Experience",
  ctaHref,
  alignment = "left",
  overlayStrength = 0.55,
  badge,
}: MediaStoryProps) {
  const isRight = alignment === "right";
  const isCenter = alignment === "center";

  return (
    <div className="relative w-full min-h-[85vh] lg:min-h-screen flex items-center justify-center overflow-hidden bg-ocean-950 snap-start">
      {/* Background Media Container */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {mediaType === "video" ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover scale-105 transition-transform duration-1000 ease-out"
          >
            <source src={media} type="video/mp4" />
          </video>
        ) : (
          <Image
            src={media}
            alt={title}
            fill
            sizes="100vw"
            className="object-cover scale-[1.04] transition-transform duration-1000 ease-out"
          />
        )}
        {/* Layered cinematic scrim */}
        <div
          className="absolute inset-0 cinematic-scrim"
          style={{ opacity: overlayStrength }}
        />
        <div className="absolute inset-0 bg-ocean-950/30" />
      </div>

      {/* Foreground Editorial Story Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-12 py-24 sm:py-32">
        <div
          className={`max-w-2xl ${
            isRight
              ? "ml-auto text-left"
              : isCenter
              ? "mx-auto text-center"
              : "mr-auto text-left"
          }`}
        >
          {/* Eyebrow & Optional Badge */}
          <ScrollReveal delay={100} yOffset={18}>
            <div className={`flex items-center gap-3 mb-4 ${isCenter ? "justify-center" : ""}`}>
              <span className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-summit-400">
                {eyebrow}
              </span>
              {badge && (
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-summit-500 text-obsidian-900">
                  {badge}
                </span>
              )}
            </div>
          </ScrollReveal>

          {/* Large Title */}
          <ScrollReveal delay={250} yOffset={24}>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-[1.1] font-display">
              {title}
            </h2>
          </ScrollReveal>

          {/* Description */}
          <ScrollReveal delay={400} yOffset={20}>
            <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-200/90 leading-relaxed font-light">
              {description}
            </p>
          </ScrollReveal>

          {/* CTA Button */}
          {ctaHref && (
            <ScrollReveal delay={550} yOffset={16}>
              <div className={`mt-8 ${isCenter ? "flex justify-center" : ""}`}>
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-md golden-summit-btn text-base font-bold group"
                >
                  <span>{ctaLabel}</span>
                  <ArrowUpRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </ScrollReveal>
          )}
        </div>
      </div>
    </div>
  );
}
