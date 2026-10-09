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
    <section aria-labelledby="top-experiences" className="overflow-hidden bg-obsidian-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-page">
        <SectionHeading
          id="top-experiences"
          eyebrow="Top-rated in the Rockies"
          title="Experiences travellers love"
          intro="Rated 5.0 by more than a thousand guests. Free cancellation up to 72 hours before every tour."
          link={{ label: "See all experiences", href: "/search" }}
        />

        <div role="group" aria-label="Filter experiences" className="vc-rail -mx-page mb-8 flex gap-2 overflow-x-auto px-page [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto" data-reveal="fade">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-11 shrink-0 rounded-full border px-5 text-sm transition-colors ${
                filter === f.id
                  ? "border-obsidian-900 bg-obsidian-900 text-white"
                  : "border-obsidian-900/10 bg-white text-obsidian-900 hover:border-obsidian-900/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {shown.length} experiences shown
        </p>

        <Rail key={filter} label="Top experiences" itemClassName={TOUR_CARD_RAIL_ITEM}>
          {shown.map((tour) => (
            <TourCard key={tour.slug} tour={tour} />
          ))}
        </Rail>
      </div>
    </section>
  );
}
