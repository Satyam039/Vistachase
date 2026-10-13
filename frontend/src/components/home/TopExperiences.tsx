"use client";

// "Top experiences" rail from the live catalog, with category chips that filter it in place
// (Viator / GetYourGuide home rails). Chips are toggle buttons; the result count is announced.

import { useMemo, useState } from "react";
import { Rail } from "@/components/motion/Rail";
import { TOUR_CARD_RAIL_ITEM, TourCard } from "@/components/tours/TourCard";
import { SectionHeading } from "@/components/home/SectionHeading";
import type { TourWithAvailability } from "@/lib/api/types";

const FILTERS = [
  { id: "ALL", label: "All experiences" },
  { id: "SHARED", label: "Shared tours" },
  { id: "PRIVATE", label: "Private tours" },
  { id: "SHUTTLE", label: "Lake shuttles" },
  { id: "MULTIDAY", label: "Multi-day" },
  { id: "TICKET", label: "Activity tickets" },
] as const;

export function TopExperiences({ tours }: { tours: TourWithAvailability[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("ALL");
  const shown = useMemo(
    () =>
      (filter === "ALL" ? tours.filter((t) => t.category !== "TICKET") : tours.filter((t) => t.category === filter))
        .slice()
        .sort((a, b) => b.reviewCount - a.reviewCount || Number(b.isFeatured) - Number(a.isFeatured)),
    [filter, tours],
  );

  return (
    <section
      aria-labelledby="top-experiences"
      className="relative isolate overflow-hidden bg-gradient-to-b from-[#0e1317] via-[#090d10] to-[#06080a] py-20 sm:py-28 border-y border-white/[0.08]"
    >
      {/* Rolls-Royce atmospheric smoke / spotlight ambient lighting */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(55,70,85,0.35),transparent_75%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(22,30,38,0.4),transparent_80%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-30 bg-[radial-gradient(ellipse_at_bottom,rgba(40,55,70,0.3),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-page">
        <SectionHeading
          id="top-experiences"
          eyebrow="Top-rated in the Rockies"
          title="Experiences travellers love"
          intro="Rated 5.0 by more than a thousand guests. Free cancellation up to 72 hours before every tour."
          link={{ label: "See all experiences", href: "/search" }}
          tone="dark"
        />

        <div
          role="group"
          aria-label="Filter experiences"
          className="vc-rail -mx-page mb-8 flex gap-2.5 overflow-x-auto px-page [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto"
          data-reveal="fade"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-11 shrink-0 rounded-full border px-5 text-sm font-normal tracking-wide transition-all duration-300 ${
                filter === f.id
                  ? "border-white bg-white text-obsidian-950 font-medium shadow-[0_0_24px_rgba(255,255,255,0.22)]"
                  : "border-white/10 bg-white/[0.06] text-white/80 backdrop-blur-md hover:border-white/25 hover:bg-white/[0.12] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {shown.length} experiences shown
        </p>

        <Rail key={filter} label="Top experiences" itemClassName={TOUR_CARD_RAIL_ITEM} tone="dark">
          {shown.map((tour) => (
            <TourCard key={tour.slug} tour={tour} />
          ))}
        </Rail>
      </div>
    </section>
  );
}
