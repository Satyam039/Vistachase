"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Bus, AlertTriangle, ShieldCheck, MapPin, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const SHUTTLE_BENEFITS = [
  {
    icon: ShieldCheck,
    title: "100% Guaranteed Commercial Corridor Entry",
    description: "Personal and rental vehicles are completely barred from Moraine Lake Road. Our commercial permit grants direct vehicle passage.",
  },
  {
    icon: MapPin,
    title: "Door-to-Door Banff & Canmore Pickup",
    description: "No need to drive to remote park-and-ride transit hubs. We collect you directly from your hotel lobby entrance.",
  },
  {
    icon: Clock,
    title: "Sunrise & Daytime Schedule Options",
    description: "Depart at 5:00 AM for the legendary golden hour reflection over the Ten Peaks, or join mid-day transfers for relaxed hiking.",
  },
  {
    icon: Bus,
    title: "Direct Shoreline Arrival",
    description: "Step off the shuttle right at the Moraine Lake and Lake Louise shorelines, ready to hike or hire canoes immediately.",
  },
];

export function ShuttleStory() {
  return (
    <section id="shuttles-story" className="py-24 sm:py-32 bg-frost-white text-obsidian-900 border-b border-black/5">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Visual Media with Sunrise over Moraine */}
          <div className="lg:col-span-6 relative">
            <ScrollReveal delay={150} yOffset={24}>
              <div className="relative aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5] w-full rounded-3xl overflow-hidden shadow-2xl bg-slate-900 border border-black/10 group">
                <Image
                  src="/media/photos/moraine-lake-perfect-reflection.webp"
                  alt="Moraine Lake calm reflection at sunrise"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/80 via-transparent to-transparent" />

                {/* Parks Canada Alert Badge */}
                <div className="absolute top-5 left-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/90 text-obsidian-950 text-xs font-bold shadow-md">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Road Closed to Personal Vehicles</span>
                </div>

                {/* Bottom Overlay Summary */}
                <div className="absolute bottom-6 left-6 right-6 p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white">
                  <span className="text-xs uppercase tracking-widest text-summit-300 font-semibold block mb-1">
                    Guaranteed Commercial Transit
                  </span>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-serif font-light text-white">$89 CAD</span>
                      <span className="text-xs text-slate-300 ml-1.5">per guest return</span>
                    </div>
                    <span className="text-xs text-emerald-300 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Direct hotel pickup
                    </span>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Right Column: Editorial Narrative & Shuttle Benefits */}
          <div className="lg:col-span-6 space-y-8">
            <div className="space-y-3">
              <ScrollReveal delay={100} yOffset={16}>
                <span className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-ocean-600 block">
                  EXPERIENCE PILLAR 03 · LAKE SHUTTLES
                </span>
              </ScrollReveal>

              <ScrollReveal delay={200} yOffset={20}>
                <h2 className="text-3xl sm:text-5xl font-serif font-light tracking-tight text-obsidian-900 leading-[1.1]">
                  The Shuttle Experience
                </h2>
              </ScrollReveal>

              <ScrollReveal delay={300} yOffset={16}>
                <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-sans font-light">
                  Skip the stress of the 3:00 AM public transit lottery. Parks Canada has permanently closed Moraine Lake Road
                  to private vehicles. Vista Chase shuttles guarantee your entrance with direct hotel pickups in Banff and Canmore.
                </p>
              </ScrollReveal>
            </div>

            {/* Benefit List */}
            <div className="space-y-4 pt-2">
              {SHUTTLE_BENEFITS.map((b, idx) => (
                <ScrollReveal key={b.title} delay={200 + idx * 80} yOffset={16}>
                  <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-200/80 hover:border-ocean-500/30 hover:bg-white transition-all">
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

            {/* Action Buttons */}
            <ScrollReveal delay={600} yOffset={16}>
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
                <Link
                  href="/shuttles"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl golden-summit-btn text-obsidian-900 font-semibold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                >
                  <span>Reserve Shuttle Seats</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/pickup-finder"
                  className="w-full sm:w-auto text-sm text-ocean-700 font-semibold hover:text-ocean-900 py-2 flex items-center justify-center gap-1.5"
                >
                  <span>Check your hotel pickup time</span>
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
