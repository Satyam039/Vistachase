"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Ticket, ExternalLink, Sparkles, CheckCircle2, Info, ArrowRight } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const ACTIVITIES = [
  {
    id: "act-gondola",
    title: "Banff Gondola Summit",
    location: "Sulphur Mountain · Banff",
    description: "Soar to 7,486 feet above sea level. Experience 360-degree panoramic views of six mountain ranges and the historic Sulphur Mountain Cosmic Ray Station boardwalk.",
    image: "/media/photos/banff-gondola-summit.jpg",
    status: "Tour Add-on & Concierge",
    highlight: "360° Alpine Summit Boardwalk",
  },
  {
    id: "act-minnewanka",
    title: "Lake Minnewanka Classic Cruise",
    location: "Lake Minnewanka · Banff",
    description: "An interpretive 1-hour cruise through Banff's largest lake. Discover submerged native history, rugged limestone cliffs, and the dramatic passage to Devil's Gap.",
    image: "/media/photos/lake-minnewanka-classic-cruise.jpg",
    status: "Tour Add-on & Concierge",
    highlight: "Interpretive Captain Guiding",
  },
  {
    id: "act-skywalk",
    title: "Columbia Icefield Glacier Skywalk",
    location: "Icefields Parkway · Jasper",
    description: "Step onto a cliff-edge glass floor perched 918 feet above the Sunwapta Canyon. Witness hanging waterfalls and ancient glacial moraines beneath your feet.",
    image: "/media/photos/columbia-icefield-skywalk-guests.jpg",
    status: "Private Tour Add-on",
    highlight: "918 ft Glass-Floor Observation",
  },
];

export function ActivityTicketsStory() {
  return (
    <section id="activity-tickets" className="py-24 sm:py-32 bg-white text-obsidian-900 border-b border-black/5">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        <div className="max-w-3xl mb-16">
          <ScrollReveal delay={100} yOffset={16}>
            <span className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-ocean-600 block">
              EXPERIENCE PILLAR 04 · ATTRACTION TICKETING
            </span>
          </ScrollReveal>

          <ScrollReveal delay={200} yOffset={20}>
            <h2 className="mt-2 text-3xl sm:text-5xl font-serif font-light tracking-tight text-obsidian-900 leading-[1.1]">
              Rockies Activity Tickets &amp; Add-Ons
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={300} yOffset={16}>
            <p className="mt-4 text-base sm:text-lg text-slate-600 font-light leading-relaxed">
              Curate your mountain journey with iconic Canadian Rockies attractions. Add official admissions directly to your
              private SUV or small-group tour, or coordinate entry times through our 24/7 mountain concierge.
            </p>
          </ScrollReveal>
        </div>

        {/* 3 Activity Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {ACTIVITIES.map((activity, idx) => (
            <ScrollReveal key={activity.id} delay={150 * (idx + 1)} yOffset={24}>
              <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-slate-200/90 bg-frost-white hover:shadow-xl transition-all duration-300 group">
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
                  <Image
                    src={activity.image}
                    alt={activity.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1.5">
                    <Ticket className="w-3 h-3 text-summit-400" />
                    <span>{activity.status}</span>
                  </div>
                  <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-summit-500 text-obsidian-900 text-[11px] font-bold">
                    {activity.highlight}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-ocean-600 font-semibold block">
                      {activity.location}
                    </span>
                    <h3 className="text-xl font-serif font-medium text-obsidian-900 mt-1 group-hover:text-ocean-600 transition-colors">
                      {activity.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2 font-light leading-relaxed">
                      {activity.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Guaranteed Time Slot
                    </span>
                    <Link
                      href="/concierge"
                      className="text-xs font-semibold text-ocean-700 hover:text-ocean-900 inline-flex items-center gap-1"
                    >
                      <span>Inquire Tickets</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Integration Transparency Note */}
        <ScrollReveal delay={450} yOffset={16}>
          <div className="mt-12 p-6 rounded-2xl bg-ocean-50 border border-ocean-200/70 text-ocean-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs sm:text-sm">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-ocean-600 shrink-0 mt-0.5" />
              <div>
                <strong>Bókun Ticketing Integration Status:</strong> Activity tickets can be bundled seamlessly into any
                Vista Chase private or shared day tour. Standalone Bókun direct API ticketing requires the partner vendor product ID.
              </div>
            </div>
            <Link
              href="/concierge"
              className="shrink-0 px-4 py-2 rounded-lg bg-ocean-600 text-white font-medium hover:bg-ocean-700 transition-colors"
            >
              Contact Concierge for Tickets
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
