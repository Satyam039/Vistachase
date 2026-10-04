"use client";

import React from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const PARTNER_LOGOS = [
  {
    name: "Google Reviews",
    src: "https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/691ad50ffd3777dc4cf0e156_Google%20logo.png",
    height: 38,
  },
  {
    name: "TripAdvisor",
    src: "https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/691ace89e156673a0f597a5f_Tripadvisor_idSto8f0HB_1.png",
    height: 34,
  },
  {
    name: "Viator",
    src: "https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/691acec025274569c3f0e5be_viator-seeklogo.png",
    height: 32,
  },
  {
    name: "GetYourGuide",
    src: "https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/691ad59089e29176ffcb2c69_Get%20Your%20Guide%20Logo.png",
    height: 34,
  },
  {
    name: "Expedia",
    src: "https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/691ad3bed15dec1a3f088e4b_expedia-logo-png-transparent.png",
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
