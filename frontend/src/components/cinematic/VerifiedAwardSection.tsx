"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Award, Trophy, Users, MapPin, Calendar } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const STATS = [
  { value: "10k+", label: "Happy Travelers", icon: Users },
  { value: "#6", label: "Best Experience in Canada", icon: Trophy },
  { value: "25+", label: "Alpine Destinations", icon: MapPin },
  { value: "4.9★", label: "Over 800+ Reviews", icon: Award },
];

export function VerifiedAwardSection() {
  return (
    <section className="py-20 sm:py-28 bg-white border-b border-black/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Text Narrative */}
          <div className="lg:col-span-7">
            <ScrollReveal delay={100} yOffset={16}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-ocean-50 text-ocean-700 text-xs font-bold tracking-widest uppercase mb-4">
                <Trophy className="w-3.5 h-3.5 text-summit-600" />
                <span>TripAdvisor Travelers’ Choice 2025</span>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200} yOffset={20}>
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-obsidian-900 font-display leading-[1.15]">
                Creating Canada’s Best Travel Memories
              </h2>
            </ScrollReveal>

            <ScrollReveal delay={300} yOffset={16}>
              <p className="mt-6 text-base sm:text-lg text-slate-600 font-light leading-relaxed">
                Proudly recognized among <strong>Canada’s Top 10 Experiences</strong> by the TripAdvisor Travelers’ Choice Best of the Best Awards 2025, our shared tour experience ranked <strong>#6 in the entire country</strong> based on outstanding traveler reviews and ratings.
              </p>
              <p className="mt-3 text-base sm:text-lg text-slate-600 font-light leading-relaxed">
                Join thousands of happy guests who have explored the Canadian Rockies with Vista Chase through unhurried pacing, luxury vehicles, and award-winning mountain guides. Out of 8 million global listings, fewer than 1% achieve this milestone.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={400} yOffset={16}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/banff-highlights-tour"
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-md golden-summit-btn text-base font-bold group"
                >
                  <span>Book the Best Tour</span>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
                <Link
                  href="https://www.tripadvisor.ca/Attraction_Review-g154911-d26518659-Reviews-Vista_Chase-Banff_Banff_National_Park_Alberta.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-md text-sm font-semibold text-slate-700 hover:text-ocean-600 transition-colors"
                >
                  <span>Verify on TripAdvisor</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </ScrollReveal>
          </div>

          {/* Right Badge Display */}
          <div className="lg:col-span-5 flex justify-center">
            <ScrollReveal delay={250} yOffset={24}>
              <div className="relative p-8 sm:p-10 rounded-2xl bg-frost-white border border-black/5 shadow-xl text-center max-w-sm">
                <div className="relative w-56 h-56 mx-auto mb-4">
                  <Image
                    src="https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/6a125b0bbd624b7655b6d861_Tripadvisor%20BOTB%20Badge%20%2B%20Travelers%E2%80%99%20Choice%20Center%20Aligned%20Black%20-%20L.png"
                    alt="TripAdvisor Best of the Best 2025 #6 Canada"
                    fill
                    className="object-contain"
                  />
                </div>
                <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                  OFFICIAL ACCREDITATION
                </p>
                <p className="text-sm font-medium text-slate-700 mt-1">
                  Ranked #6 in All of Canada
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>

        {/* 4 Verified Metric Counters */}
        <div className="mt-16 pt-12 border-t border-slate-200/80 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <ScrollReveal key={idx} delay={100 * (idx + 1)} yOffset={16}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-summit-500/10 flex items-center justify-center text-summit-600 mb-2">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-3xl sm:text-4xl font-extrabold text-obsidian-900 font-display">
                    {stat.value}
                  </span>
                  <span className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    {stat.label}
                  </span>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
