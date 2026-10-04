"use client";

import React, { useState } from "react";
import { Star, Quote, ChevronLeft, ChevronRight, Award } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

interface Testimonial {
  author: string;
  tripType: string;
  source: string;
  rating: number;
  body: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    author: "Emily & Jason",
    tripType: "Luxury Private SUV Tour",
    source: "TripAdvisor Best of the Best",
    rating: 5,
    body: "Excellent tour experience. Our guide was professional, knowledgeable, and the full-size SUV was remarkably comfortable for our full-day journey through Banff and Lake Louise.",
  },
  {
    author: "Jessica M.",
    tripType: "Shared Small-Group Tour",
    source: "Google 5-Star Review",
    rating: 5,
    body: "I booked a shared tour and it was easily the best day of my trip. Our guide was incredibly patient, took incredible family photos for us, and got us right to the lakeshore before any crowds arrived.",
  },
  {
    author: "Rohit S.",
    tripType: "Family Private Rockies Tour",
    source: "TripAdvisor Verified Guest",
    rating: 5,
    body: "We did a private day tour for our family of five, and it exceeded our highest expectations. Pacing was tailored for our kids and the local stories made it completely unforgettable.",
  },
  {
    author: "Daniel P.",
    tripType: "Moraine Lake Sunrise Shuttle",
    source: "Google 5-Star Review",
    rating: 5,
    body: "We joined the sunrise shuttle for Moraine Lake and were blown away. Total peace of mind knowing our access was guaranteed. Seeing the Ten Peaks reflect in calm water was the highlight of our year.",
  },
  {
    author: "Carlos R.",
    tripType: "Icefields Parkway Private Expedition",
    source: "TripAdvisor Best of the Best",
    rating: 5,
    body: "Unforgettable experience in the Canadian Rockies. The glacial landscape was majestic and the logistics were completely seamless from morning pickup to evening drop-off.",
  },
];

export function GuestTestimonials() {
  const [activeIndex, setActiveIndex] = useState(0);

  const prevSlide = () => {
    setActiveIndex((prev) => (prev === 0 ? TESTIMONIALS.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setActiveIndex((prev) => (prev === TESTIMONIALS.length - 1 ? 0 : prev + 1));
  };

  const active = TESTIMONIALS[activeIndex];

  return (
    <section className="py-24 sm:py-32 bg-ocean-950 text-white relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 sm:px-12 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <ScrollReveal delay={100} yOffset={16}>
            <span className="text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase text-summit-400">
              TRAVELER PERSPECTIVES
            </span>
          </ScrollReveal>
          <ScrollReveal delay={200} yOffset={20}>
            <h2 className="mt-2 text-3xl sm:text-5xl font-bold font-display text-white">
              Genuine Stories from the Rockies
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={300} yOffset={16}>
            <p className="mt-3 text-slate-300 text-sm sm:text-base font-light">
              Over 800+ five-star verified guest reflections on TripAdvisor and Google.
            </p>
          </ScrollReveal>
        </div>

        {/* Featured Testimonial Card */}
        <ScrollReveal delay={350} yOffset={24}>
          <div className="relative p-8 sm:p-14 rounded-2xl glass-panel-alpine border border-white/10 shadow-2xl">
            <Quote className="w-12 h-12 text-summit-500/20 absolute top-8 right-8" />

            <div className="flex items-center gap-1.5 text-summit-400 mb-6">
              {[...Array(active.rating)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-summit-500 text-summit-500" />
              ))}
            </div>

            <p className="text-xl sm:text-2xl md:text-3xl font-light text-slate-100 leading-relaxed italic font-serif">
              &ldquo;{active.body}&rdquo;
            </p>

            <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-lg font-bold text-white font-display">
                  {active.author}
                </h4>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 mt-0.5">
                  <span className="text-summit-300 font-medium">{active.tripType}</span>
                  <span>•</span>
                  <span>{active.source}</span>
                </div>
              </div>

              {/* Slider Arrows */}
              <div className="flex items-center gap-3">
                <button
                  onClick={prevSlide}
                  aria-label="Previous testimonial"
                  className="w-11 h-11 rounded-full border border-white/20 hover:border-summit-500 hover:bg-summit-500 hover:text-obsidian-900 flex items-center justify-center transition-colors text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-xs font-semibold text-slate-400 px-2">
                  {activeIndex + 1} / {TESTIMONIALS.length}
                </div>
                <button
                  onClick={nextSlide}
                  aria-label="Next testimonial"
                  className="w-11 h-11 rounded-full border border-white/20 hover:border-summit-500 hover:bg-summit-500 hover:text-obsidian-900 flex items-center justify-center transition-colors text-white"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
