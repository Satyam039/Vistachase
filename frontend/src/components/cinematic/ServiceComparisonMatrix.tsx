"use client";

import React from "react";
import Link from "next/link";
import { Users, CarFront, Bus, Ticket, Check, X, ArrowRight, ShieldCheck } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const COMPARISON_DATA = [
  {
    feature: "Best For",
    shared: "Couples, solo travelers, small families",
    private: "Private families, luxury travelers, groups",
    shuttle: "Independent hikers & lake visitors",
    activity: "Sightseers seeking iconic admissions",
  },
  {
    feature: "Group Size",
    shared: "Max 12 guests (small group)",
    private: "Exclusive private group (up to 6 or 13)",
    shuttle: "Direct shuttle passengers",
    activity: "Individual or party admissions",
  },
  {
    feature: "Vehicle Type",
    shared: "High-roof Mercedes Sprinter",
    private: "GMC Yukon Denali XL / Cadillac Escalade",
    shuttle: "Commercial passenger shuttle",
    activity: "Gondola / Cruise vessel / Skywalk",
  },
  {
    feature: "Hotel Pickup",
    shared: "Door-to-door in Banff & Canmore",
    private: "Flexible pickup anywhere in Bow Valley",
    shuttle: "Door-to-door in Banff & Canmore",
    activity: "Included in tour or self-arrival",
  },
  {
    feature: "Itinerary Flexibility",
    shared: "Curated 8–9 landmark stops",
    private: "100% bespoke (custom stops & pace)",
    shuttle: "Fixed destination return schedules",
    activity: "Reserved timed ticket entry",
  },
  {
    feature: "Duration",
    shared: "9–11 hours full day",
    private: "10–12 hours tailored",
    shuttle: "5–6 hours or full-day express",
    activity: "1–2 hours per activity",
  },
  {
    feature: "Pricing Model",
    shared: "From $189 CAD per guest",
    private: "From $1,149 – $1,250 CAD flat vehicle rate",
    shuttle: "From $89 – $95 CAD return per guest",
    activity: "Partner rate / Concierge add-on",
  },
  {
    feature: "Cancellation Policy",
    shared: "Free cancellation up to 24 hours",
    private: "Free cancellation up to 24 hours",
    shared_free: true,
    shuttle: "Free cancellation up to 24 hours",
    activity: "Subject to partner attraction terms",
  },
];

export function ServiceComparisonMatrix() {
  return (
    <section className="py-24 sm:py-32 bg-white text-obsidian-900 border-b border-black/5">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <ScrollReveal delay={100} yOffset={16}>
            <span className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-ocean-600 block">
              SIDE-BY-SIDE EVALUATION
            </span>
          </ScrollReveal>
          <ScrollReveal delay={200} yOffset={20}>
            <h2 className="mt-2 text-3xl sm:text-5xl font-serif font-light tracking-tight text-obsidian-900 leading-[1.1]">
              Compare Vista Chase Experiences
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={300} yOffset={16}>
            <p className="mt-4 text-base sm:text-lg text-slate-600 font-light leading-relaxed">
              Transparent specifications to help you select the ideal way to experience Banff, Lake Louise, and Moraine Lake.
            </p>
          </ScrollReveal>
        </div>

        {/* Responsive Table Container */}
        <ScrollReveal delay={400} yOffset={24}>
          <div className="overflow-x-auto rounded-3xl border border-slate-200/90 shadow-xl bg-white">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="p-5 sm:p-6 text-xs font-bold uppercase tracking-wider text-slate-500 w-1/5">
                    Feature
                  </th>
                  <th className="p-5 sm:p-6 text-sm font-serif font-medium text-obsidian-900 w-1/5 bg-ocean-50/50">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-ocean-600" />
                      <span>Shared Tours</span>
                    </div>
                  </th>
                  <th className="p-5 sm:p-6 text-sm font-serif font-medium text-obsidian-900 w-1/5 bg-summit-50/50">
                    <div className="flex items-center gap-2">
                      <CarFront className="w-4 h-4 text-summit-600" />
                      <span>Private SUV</span>
                    </div>
                  </th>
                  <th className="p-5 sm:p-6 text-sm font-serif font-medium text-obsidian-900 w-1/5">
                    <div className="flex items-center gap-2">
                      <Bus className="w-4 h-4 text-ocean-600" />
                      <span>Lake Shuttles</span>
                    </div>
                  </th>
                  <th className="p-5 sm:p-6 text-sm font-serif font-medium text-obsidian-900 w-1/5">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-ocean-600" />
                      <span>Activity Tickets</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {COMPARISON_DATA.map((row, idx) => (
                  <tr key={row.feature} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                    <td className="p-4 sm:p-5 font-semibold text-obsidian-900">{row.feature}</td>
                    <td className="p-4 sm:p-5 text-slate-700 bg-ocean-50/20">{row.shared}</td>
                    <td className="p-4 sm:p-5 text-slate-700 bg-summit-50/20 font-medium">{row.private}</td>
                    <td className="p-4 sm:p-5 text-slate-700">{row.shuttle}</td>
                    <td className="p-4 sm:p-5 text-slate-700">{row.activity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/90">
                  <td className="p-5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Book Online</td>
                  <td className="p-5 bg-ocean-50/30">
                    <Link
                      href="/banff-highlights-tour"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-ocean-700 hover:text-ocean-900"
                    >
                      <span>Book Shared</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                  <td className="p-5 bg-summit-50/30">
                    <Link
                      href="/banff-private-tour"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-summit-700 hover:text-summit-900"
                    >
                      <span>Design Private</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                  <td className="p-5">
                    <Link
                      href="/shuttles"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-ocean-700 hover:text-ocean-900"
                    >
                      <span>Reserve Seats</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                  <td className="p-5">
                    <Link
                      href="/concierge"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-ocean-700 hover:text-ocean-900"
                    >
                      <span>Concierge Inquiry</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
