"use client";

import React from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const PARTNER_LOGOS = [
  {
    name: "Google Reviews",
    src: "/media/badges/google-logo.png",
    height: 38,
  },
  {
    name: "TripAdvisor",
    src: "/media/badges/tripadvisor-logo.png",
    height: 34,
  },
  {
    name: "Viator",
    src: "/media/badges/viator-logo.png",
    height: 32,
  },
  {
    name: "GetYourGuide",
    src: "/media/badges/get-your-guide-logo.png",
    height: 34,
  },
  {
    name: "Expedia",
    src: "/media/badges/expedia-logo.png",
    height: 30,
  },
];

export function TrustBar() {
  return (
    <section className="py-12 bg-white border-b border-black/5">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 text-center">
        <ScrollReveal delay={100} yOffset={12}>
          <div className="flex items-center justify-center gap-2 mb-6 text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-summit-500" />
            <span>Reviewed & Trusted By Travellers Worldwide</span>
            <span className="w-1.5 h-1.5 rounded-full bg-summit-500" />
          </div>
        </ScrollReveal>

        <ScrollReveal delay={200} yOffset={16}>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 opacity-80 grayscale hover:grayscale-0 transition-all duration-500">
            {PARTNER_LOGOS.map((logo, i) => (
              <div key={i} className="relative h-10 w-28 sm:w-36 flex items-center justify-center">
                <Image
                  src={logo.src}
                  alt={logo.name}
                  width={140}
                  height={logo.height}
                  className="object-contain max-h-9"
                />
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
