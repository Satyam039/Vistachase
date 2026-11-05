"use client";

// Multi-Day Journeys, at the old multi-day product's URL (/multi-day-tour-package-for-banff, linked
// from the home "Choose How You See the Rockies" section and the footer). It lists only the
// multi-day journeys Vista Chase offers (owner's doc, Pricing, 2026-11-05): the shared and private
// Two-Day Rockies Explorer, the Three-Day Rockies Discovery and the Four-Day Rockies & Jasper, plus
// the Banff Elite custom journey from the Private Tours page. Cards come from lib/experiences.ts.

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TourCard } from "@/components/tours/TourCard";
import { ExperienceCard } from "@/components/home/TopExperiences";
import { buildExperienceTabs } from "@/lib/experiences";
import type { TourWithAvailability } from "@/lib/api/types";

export function MultiDayLanding({ tours }: { tours: TourWithAvailability[] }) {
  const cards = useMemo(() => {
    const tabs = buildExperienceTabs(tours);
    return [
      ...tabs.SHARED.filter((c) => c.key === "two-day-shared"),
      ...tabs.PRIVATE.filter((c) => c.key === "two-day-rockies-private"),
      ...tabs.MULTIDAY,
    ];
  }, [tours]);

  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <section className="border-b border-obsidian-900/[0.06] bg-white">
        <div className="mx-auto max-w-7xl px-page pb-10 pt-10 text-center sm:pt-14">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
              <li>
                <Link href="/" className="hover:text-obsidian-900 hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-obsidian-900">
                Multi-Day Journeys
              </li>
            </ol>
          </nav>
          <h1 className="text-balance text-4xl font-light leading-[1.05] tracking-tight text-obsidian-900 sm:text-5xl">Multi-Day Journeys</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg font-light text-slate-600">
            Discover more of the Canadian Rockies over two to four days, with a small group or in your own private vehicle. For a fully tailored
            itinerary, our sister company Banff Elite can plan your journey.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-page pb-20 pt-10">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {cards.map((card) => (
            <li key={card.key}>
              {card.kind === "tour" ? <TourCard tour={card.tour} title={card.title} image={card.image} /> : <ExperienceCard card={card} />}
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center text-base text-slate-600">
          Looking for a single day?{" "}
          <Link href="/shared-tours" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-800">
            Small-group tours
          </Link>{" "}
          or{" "}
          <Link href="/private-tours" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-800">
            private tours
          </Link>
          . Questions?{" "}
          <Link href="/contact-us" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-800">
            Contact our team
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
