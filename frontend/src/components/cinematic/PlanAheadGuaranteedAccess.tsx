"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, AlertCircle, Clock, ShieldCheck } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const AVATARS = [
  "/media/site/ellipse-2.webp",
  "/media/site/ellipse-3.webp",
  "/media/site/ellipse-4.webp",
  "/media/site/ellipse-5-1.webp",
];

export function PlanAheadGuaranteedAccess() {
  return (
    <section className="py-20 sm:py-28 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Atmospheric Image with Floating Guarantee Card */}
          <div className="lg:col-span-6 relative">
            <ScrollReveal delay={150} yOffset={24}>
              <div className="relative h-[480px] sm:h-[600px] w-full rounded-[2rem] overflow-hidden" data-reveal="clip">
                <Image
                  src="/media/site/about-image-1.webp"
                  alt="Red canoes docked at Moraine Lake shoreline"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  data-parallax="10"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ocean-950/70 via-transparent to-transparent" />
              </div>

              {/* Floating Guarantee Badge Card */}
              <div className="absolute -bottom-6 -right-4 sm:right-6 max-w-xs sm:max-w-sm p-5 rounded-xl bg-white shadow-2xl border border-black/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-summit-500/20 text-summit-700 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase  tracking-wider text-ocean-700">
                      OFFICIAL COMMERCIAL PERMITS
                    </p>
                    <p className="text-sm  text-obsidian-900">
                      Guaranteed Moraine Lake access
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Right: Urgent Problem & Solution Narrative */}
          <div className="lg:col-span-6">
            <ScrollReveal delay={200} yOffset={16}>
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm  tracking-[0.2em] uppercase text-ocean-600 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>PLAN AHEAD & TRAVEL SMART</span>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={300} yOffset={20}>
              <h2 className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl">
                Avoid the Moraine Lake Parking Restrictions
              </h2>
            </ScrollReveal>

            <ScrollReveal delay={400} yOffset={16}>
              <p className="mt-6 text-base sm:text-lg text-slate-600 font-light leading-relaxed">
                Personal vehicles are <strong>restricted from driving to Moraine Lake</strong>, and parking lots at Lake Louise routinely reach maximum capacity before 6:00 AM — turning away hundreds of cars daily.
              </p>
              <p className="mt-3 text-base sm:text-lg text-slate-600 font-light leading-relaxed">
                By reserving your Vista Chase private SUV tour or guaranteed sunrise shuttle, you completely bypass the traffic jams and lottery stress. Enjoy door-to-shoreline pickup directly from your Canmore, Banff, or Lake Louise accommodation.
              </p>
            </ScrollReveal>

            {/* Avatar Social Proof Stack */}
            <ScrollReveal delay={500} yOffset={16}>
              <div className="mt-8 flex items-center gap-4 py-4 px-5 rounded-xl bg-white border border-slate-200/80 shadow-sm">
                <div className="flex -space-x-2 overflow-hidden">
                  {AVATARS.map((src, i) => (
                    <div key={i} className="inline-block h-9 w-9 rounded-full ring-2 ring-white overflow-hidden relative">
                      <Image src={src} alt="" fill className="object-cover" />
                    </div>
                  ))}
                </div>
                <div>
                  <span className="text-sm  text-obsidian-900">10,000+ Travelers</span>
                  <p className="text-xs text-slate-500">Safely guided through the Canadian Rockies</p>
                </div>
              </div>
            </ScrollReveal>

            {/* CTA Buttons */}
            <ScrollReveal delay={600} yOffset={16}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/shuttles"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full golden-summit-btn text-base  group"
                >
                  <span>View Guaranteed Shuttles</span>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
                <Link
                  href="/private-tours"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-md text-sm  text-slate-700 hover:text-ocean-600 transition-colors"
                >
                  <span>Explore Private SUV Tours</span>
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
