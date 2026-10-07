"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight, Quote, ShieldCheck } from "lucide-react";

export interface VerifiedReview {
  id: string;
  author: string;
  source: "TripAdvisor" | "Google" | "Viator";
  badgeText: string;
  rating: number;
  tourName: string;
  date: string;
  quote: string;
}

export const VERIFIED_REVIEWS: VerifiedReview[] = [
  {
    id: "rev-1",
    author: "Emily & Jason R.",
    source: "TripAdvisor",
    badgeText: "Best of the Best #6 Canada",
    rating: 5,
    tourName: "Lake Louise, Moraine Lake & Banff Highlights",
    date: "Summer 2025",
    quote:
      "Skipping the stress of Moraine Lake parking made our entire vacation. Our guide was warm, knowledgeable, and got us the most incredible photos before the crowds arrived.",
  },
  {
    id: "rev-2",
    author: "Jessica M.",
    source: "Google",
    badgeText: "5.0 Verified Review",
    rating: 5,
    tourName: "Shared Small-Group Tour (Max 12)",
    date: "Autumn 2025",
    quote:
      "Easily the best day of our trip to Canada. Small group format meant we never felt rushed, and hotel pickup right at our Banff lodge was totally seamless.",
  },
  {
    id: "rev-3",
    author: "Daniel & Priya P.",
    source: "Viator",
    badgeText: "Badge of Excellence",
    rating: 5,
    tourName: "Moraine Lake Alpine Sunrise Shuttle",
    date: "Summer 2025",
    quote:
      "Seeing the Ten Peaks reflect in the calm lake at sunrise with hot coffee in hand was unforgettable. Total peace of mind knowing commercial corridor permits were guaranteed.",
  },
  {
    id: "rev-4",
    author: "Rohit & Ananya S.",
    source: "TripAdvisor",
    badgeText: "TripAdvisor Verified Guest",
    rating: 5,
    tourName: "Luxury Private SUV Tour",
    date: "Fall 2025",
    quote:
      "Our family of five booked the private GMC Yukon XL. The comfort, heated leather captain seats, and flexibility to stop whenever our kids wanted made it worth every dollar.",
  },
];

export function HeroReviewSlider({ autoPlayInterval = 6000 }: { autoPlayInterval?: number }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % VERIFIED_REVIEWS.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + VERIFIED_REVIEWS.length) % VERIFIED_REVIEWS.length);
  }, []);

  // Auto-play timer respecting reduced-motion
  useEffect(() => {
    if (isPaused) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return;

    const timer = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [isPaused, autoPlayInterval, nextSlide]);

  const current = VERIFIED_REVIEWS[currentIndex];

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 50) nextSlide();
    else if (diff < -50) prevSlide();
    touchStartX.current = null;
  };

  return (
    <div
      role="region"
      aria-label="Verified Guest Reviews Slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full max-w-4xl mx-auto"
    >
      <div className="relative p-6 sm:p-8 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/15 shadow-2xl transition-all duration-300">
        <Quote className="w-10 h-10 text-summit-500/20 absolute top-6 right-6 pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          {/* Source and verified badge */}
          <div className="flex items-center gap-2.5">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                current.source === "TripAdvisor"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : current.source === "Google"
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  : "bg-summit-500/20 text-summit-300 border border-summit-500/30"
              }`}
            >
              {current.source}
            </span>
            <span className="text-xs text-slate-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-summit-400" />
              <span>{current.badgeText}</span>
            </span>
          </div>

          {/* Star rating */}
          <div className="flex items-center gap-1" aria-label={`${current.rating} out of 5 stars`}>
            {[...Array(current.rating)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-summit-500 text-summit-500" />
            ))}
          </div>
        </div>

        {/* Review Quote with editorial styling */}
        <p className="text-base sm:text-lg text-slate-100 font-serif font-light italic leading-relaxed min-h-[4.5rem]">
          &ldquo;{current.quote}&rdquo;
        </p>

        {/* Author info & controls */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-4">
          <div>
            <span className="text-sm font-semibold text-white block">{current.author}</span>
            <span className="text-xs text-slate-400 block font-light">
              {current.tourName} · {current.date}
            </span>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous review"
              className="w-9 h-9 rounded-full border border-white/20 hover:border-summit-400 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs text-slate-400 font-medium px-1.5" aria-live="polite">
              {currentIndex + 1} / {VERIFIED_REVIEWS.length}
            </div>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next review"
              className="w-9 h-9 rounded-full border border-white/20 hover:border-summit-400 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
