// Booking page for the private Two-Day Rockies Explorer (owner 2026-11-06: book it like a private
// tour instead of requesting it): both private day tours, a date the guest picks for each, one
// vehicle per day, one payment (backend modules/bookings/package-booking.ts).

import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { PackageBookingSection } from "@/components/booking/PackageBookingSection";
import { ItineraryDayPanel, ItineraryDayTabList, ItineraryDays } from "@/components/tours/ItineraryDayTabs";
import { TOUR_ITINERARIES } from "@/lib/itineraries";
import { PACKAGE_DAY_PRICE, PRIVATE_MAX_GUESTS, PRIVATE_PACKAGES } from "@/lib/privateTours";

export const metadata: Metadata = {
  // Checkout step: noindex, follow (fix recheck, 10 Nov 2026, R3; replaces the 9 Nov "index, follow").
  // It has nothing for search and would show stale dates and prices in results.
  robots: { index: false, follow: true },
  title: "Book the Private Two-Day Rockies Explorer | Vista Chase",
  description: "Both private day tours with your own vehicle and guide: choose a date for each day and book in one secure payment.",
  alternates: { canonical: "/two-day-rockies-explorer/private" },
};

const cad = (n: number) => `CAD $${n.toLocaleString("en-CA")}`;

// Each day's itinerary (the private day tours'), shown as Day 1 / Day 2 tabs (owner, 2026-11-18).
const DAYS = PRIVATE_PACKAGES.two.days.map((d, i) => ({
  dayNumber: i + 1,
  title: d.title,
  stops: (TOUR_ITINERARIES[d.slug]?.stops ?? []).map((s) => ({
    name: s.name.replace(/\s+—\s+Optional Add-On$/i, ""),
    desc: s.summerOnly ? `${s.text} (June 1 to October 10.)` : s.text,
    isOptional: /optional add-on/i.test(s.name),
  })),
}));

export default function PrivateTwoDayBookPage() {
  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <div className="mx-auto max-w-7xl px-page pt-[calc(var(--vc-nav-open-h,100px)+1.5rem)]">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
            <li>
              <Link href="/private-tours" className="hover:text-obsidian-900 hover:underline">
                Private tours
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li aria-current="page" className="text-obsidian-900">
              Private Two-Day Rockies Explorer
            </li>
          </ol>
        </nav>
        <h1 className="text-balance text-3xl font-light tracking-tight text-obsidian-900 sm:text-5xl">Private Two-Day Rockies Explorer</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600 sm:text-lg">
          Banff &amp; Yoho Discovery and the Columbia Icefield Adventure, each with your own vehicle and guide. Private, up to {PRIVATE_MAX_GUESTS} guests.
        </p>
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-obsidian-900/10">Summer (Jun 1–Oct 10): {cad(PACKAGE_DAY_PRICE.summer)} per day per vehicle</span>
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-obsidian-900/10">Winter (Oct 11–May 31): {cad(PACKAGE_DAY_PRICE.winter)} per day per vehicle</span>
        </p>
      </div>
      {/* Owner, 2026-11-19: Day buttons, then the booking form, then the chosen day's itinerary. */}
      <ItineraryDays days={DAYS} idPrefix="two-day">
      <section aria-labelledby="two-day-itinerary" className="mx-auto mt-8 max-w-7xl px-page">
        <h2 id="two-day-itinerary" className="mb-4 text-2xl font-light tracking-tight text-obsidian-900 sm:text-3xl">
          Your two days
        </h2>
        <ItineraryDayTabList />
      </section>
      <PackageBookingSection config={PRIVATE_PACKAGES.two} heading="Choose your dates" wholePage />
        <div className="mx-auto max-w-7xl px-page pb-16">
          <ItineraryDayPanel />
        </div>
      </ItineraryDays>
    </div>
  );
}
