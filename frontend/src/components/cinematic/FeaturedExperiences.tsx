"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, Star, Users, MapPin } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

interface FeaturedTour {
  id: string;
  bokunId: string;
  title: string;
  category: string;
  duration: string;
  groupSize: string;
  rating: string;
  reviewCount: number;
  priceFrom: string;
  image: string;
  slug: string;
  highlights: string[];
}

const FEATURED_TOURS: FeaturedTour[] = [
  {
    id: "banff-highlights",
    bokunId: "1142134",
    title: "Lake Louise, Moraine Lake & Banff Highlights Tour",
    category: "Shared Small Group",
    duration: "9–11 Hours",
    groupSize: "Max 12 Guests",
    rating: "4.9",
    reviewCount: 380,
    priceFrom: "$189 CAD",
    image: "/media/site/image-2025-11-04t210434-975.webp",
    slug: "banff-highlights-tour",
    highlights: ["Moraine Lake Shoreline", "Lake Louise Chateau", "Bow Falls & Castle Mountain"],
  },
  {
    id: "banff-private",
    bokunId: "1167962",
    title: "Luxury Private SUV Tour: Banff & Lake Louise",
    category: "Private Luxury SUV",
    duration: "10–12 Hours",
    groupSize: "Private (Up to 6)",
    rating: "5.0",
    reviewCount: 215,
    priceFrom: "$1,149 CAD",
    image: "/media/site/dcb45221eefae27970a0c11f4f7fc0eb3edb65d1-1.webp",
    slug: "banff-private-tour",
    highlights: ["Custom Pace & Itinerary", "GMC Yukon Denali XL VIP", "Door-to-Door Canmore/Banff Pickup"],
  },
  {
    id: "moraine-sunrise-shuttle",
    bokunId: "928996",
    title: "Moraine Lake & Lake Louise Alpine Sunrise Shuttle",
    category: "Guaranteed Shuttle",
    duration: "5–6 Hours",
    groupSize: "Direct Shuttle",
    rating: "4.9",
    reviewCount: 420,
    priceFrom: "$79 CAD",
    image: "/media/photos/moraine-lake-perfect-reflection.webp",
    slug: "shuttles",
    highlights: ["Arrival Before Public Access", "Calm Lake Reflection Window", "Bypass Road Restrictions"],
  },
  {
    id: "icefields-jasper-private",
    bokunId: "856008",
    title: "Icefields Parkway & Jasper Private Adventure",
    category: "Private Luxury Tour",
    duration: "10–12 Hours",
    groupSize: "Private Group",
    rating: "5.0",
    reviewCount: 165,
    priceFrom: "$1,399 CAD",
    image: "/media/brand/horse-rider-background.png",
    slug: "icefields-jasper-private-tour",
    highlights: ["Peyto & Bow Lakes", "Athabasca Glacier View", "Mistaya Canyon Exploration"],
  },
];

export function FeaturedExperiences() {
  return (
    <section className="py-24 sm:py-32 bg-white text-obsidian-900 border-b border-black/5">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        {/* Section Header with View All Link */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <ScrollReveal delay={100} yOffset={16}>
              <span className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-ocean-600">
                CURATED EXPEDITIONS
              </span>
            </ScrollReveal>
            <ScrollReveal delay={200} yOffset={20}>
              <h2 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight text-obsidian-900 font-display">
                Featured Rockies Experiences
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={300} yOffset={16}>
              <p className="mt-4 text-base sm:text-lg text-slate-600 font-light leading-relaxed">
                Direct booking backed by Bókun. Instant confirmations, live seat holds, and transparent pricing in CAD.
              </p>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={350} yOffset={16}>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 text-sm sm:text-base font-bold text-ocean-700 hover:text-ocean-900 transition-colors group"
            >
              <span>Explore All 13 Experiences</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </Link>
          </ScrollReveal>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {FEATURED_TOURS.map((tour, idx) => (
            <ScrollReveal key={tour.id} delay={150 * (idx + 1)} yOffset={24}>
              <div className="flex flex-col h-full rounded-xl overflow-hidden border border-slate-200/80 bg-frost-white hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 group">
                {/* Tour Card Image */}
                <div className="relative h-60 w-full overflow-hidden">
                  <Image
                    src={tour.image}
                    alt={tour.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-black/60 backdrop-blur-md text-white text-xs font-semibold">
                    {tour.category}
                  </div>
                  <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-summit-500 text-obsidian-900 text-xs font-bold shadow-sm">
                    From {tour.priceFrom}
                  </div>
                </div>

                {/* Tour Content */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Rating & Duration Meta */}
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2.5">
                      <div className="flex items-center gap-1 text-obsidian-900 font-bold">
                        <Star className="w-3.5 h-3.5 text-summit-500 fill-summit-500" aria-hidden="true" />
                        <span>{tour.rating}</span>
                        <span className="text-slate-500 font-normal">({tour.reviewCount})</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-600">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{tour.duration}</span>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-obsidian-900 font-display line-clamp-2 group-hover:text-ocean-600 transition-colors">
                      {tour.title}
                    </h3>

                    {/* Quick Highlights */}
                    <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                      {tour.highlights.map((highlight, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-ocean-500" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Booking CTA Button */}
                  <div className="mt-6 pt-4 border-t border-slate-200/60">
                    <Link
                      href={`/${tour.slug}`}
                      className="w-full py-2.5 px-4 rounded-md golden-summit-btn text-xs font-bold text-center flex items-center justify-center gap-1.5"
                    >
                      <span>Check Bókun Availability</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
