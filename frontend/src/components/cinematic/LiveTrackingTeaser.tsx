"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Compass, Navigation, Radio, Smartphone, Zap } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

export function LiveTrackingTeaser() {
  return (
    <section className="py-24 sm:py-32 bg-obsidian-950 text-white relative overflow-hidden border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Narrative */}
          <div className="lg:col-span-6">
            <ScrollReveal delay={100} yOffset={16}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-widest uppercase mb-4">
                <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                <span>LIVE GPS MOBILITY & WHATSAPP T-60</span>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200} yOffset={20}>
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white font-display leading-[1.15]">
                Never Wonder Where Your Shuttle Is
              </h2>
            </ScrollReveal>

            <ScrollReveal delay={300} yOffset={16}>
              <p className="mt-6 text-base sm:text-lg text-slate-300 font-light leading-relaxed">
                Exactly <strong>60 minutes prior to departure</strong>, Vista Chase’s automated dispatch system transmits a personalized WhatsApp alert directly to your phone with an encrypted, one-tap live tracking link.
              </p>
              <p className="mt-3 text-base sm:text-lg text-slate-300 font-light leading-relaxed">
                Watch your driver navigate the Bow Valley corridor in real time on our luxury topographic map — with dynamic live ETAs, vehicle specs, and driver contacts without ever downloading an app.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={400} yOffset={16}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/track/4c75291326d8a68f983439c4291bcdfe92c5deaaecaf03d1be8d721b248f3d2a"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md golden-summit-btn text-base font-bold group"
                >
                  <span>View Live Tracking Demo</span>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
                  <Smartphone className="w-4 h-4 text-summit-400" />
                  <span>Integrated with WhatsApp Business</span>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Right: Mock Live GPS UI Interface Card */}
          <div className="lg:col-span-6">
            <ScrollReveal delay={250} yOffset={24}>
              <div className="p-6 sm:p-8 rounded-2xl glass-panel-alpine border border-white/15 shadow-2xl relative">
                {/* Simulated GPS Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold">
                      TELEMETRY STREAMING ACTIVE
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">84 km/h • Bow Valley</span>
                </div>

                {/* Topographic Mini Route View */}
                <div className="relative h-48 w-full rounded-xl bg-ocean-950/80 border border-white/10 overflow-hidden p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-start text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">PICKUP HOTEL</p>
                      <p className="font-bold text-white">Fairmont Banff Springs</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-summit-400">ESTIMATED ARRIVAL</p>
                      <p className="font-bold text-summit-400 font-mono text-base">05:00 AM</p>
                    </div>
                  </div>

                  {/* Vehicle Marker Animation */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-black/50 backdrop-blur-md border border-white/10">
                    <div className="w-8 h-8 rounded-full bg-summit-500 text-obsidian-950 flex items-center justify-center font-bold">
                      <Navigation className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-white">Mercedes-Benz Sprinter #4</p>
                      <p className="text-[11px] text-slate-400">Driver: Marc Tremblay • Plate: 7VC-894</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ON THE WAY
                    </span>
                  </div>
                </div>

                {/* Dispatch Reassurance Badges */}
                <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5">
                    <Zap className="w-4 h-4 text-summit-400 shrink-0" />
                    <span>8-Second Auto-Sync</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5">
                    <Compass className="w-4 h-4 text-ocean-400 shrink-0" />
                    <span>Mountain Route Maps</span>
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
