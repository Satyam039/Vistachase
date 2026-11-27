"use client";

// Multi-Day Journeys, at the old multi-day product's URL (/multi-day-tour-package-for-banff, linked
// from the home "Choose How You See the Rockies" section and the footer). It lists only the
// multi-day journeys Vista Chase offers (owner's doc, Pricing, 2026-11-05): the shared and private
// Two-Day Rockies Explorer, the Three-Day Rockies Discovery and the Four-Day Rockies & Jasper, plus
// the Banff Elite custom journey from the Private Tours page. Cards come from lib/experiences.ts.

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PrivateTourCard } from "@/components/tours/PrivateTourCard";
import { PRIVATE_OPTIONS, type PrivateTourOption } from "@/lib/privateTours";
import { BANFF_YOHO, ICEFIELD, TWO_DAY_PACKAGE, packagePrice } from "@/lib/sharedTours";
import { PACKAGE_NAMES } from "@/lib/tourNames";
import { fromPrice } from "@/lib/tours";
import type { TourWithAvailability } from "@/lib/api/types";

// Every journey uses the Private Tours page card (owner, 2026-11-27). The shared Two-Day's rows come
// from the Shared Tours page (lib/sharedTours.ts); rows it has no value for are left out.
const SHARED_TWO_DAY: PrivateTourOption = {
  id: "two-day-shared",
  title: TWO_DAY_PACKAGE.title,
  description: TWO_DAY_PACKAGE.description,
  duration: TWO_DAY_PACKAGE.duration,
  transport: "",
  suggestedStay: "",
  pickup: "Hotel pickup in Banff & Canmore",
  group: "Small group",
  activities: "Columbia Icefield tickets included June 1–October 10",
  airportTransfers: "",
  accommodation: "Not included",
  savings: TWO_DAY_PACKAGE.saving,
  priceFrom: 0,
  priceUnit: "per guest",
  // Same seasonal prices as the Two-Day card on the Shared Tours page.
  seasonalPricing: { summer: "CAD $486/guest", winter: "CAD $396/guest" },
  buttonLabel: TWO_DAY_PACKAGE.button,
  buttonHref: TWO_DAY_PACKAGE.href,
  // Peyto Lake is on both days' routes.
  image: "/media/photos/peyto-lake.webp",
  imageAlt: "Peyto Lake from the Icefields Parkway",
};

const PRIVATE_JOURNEYS = ["two-day-rockies-private", "three-day-rockies-discovery", "four-day-rockies-jasper"];

export function MultiDayLanding({ tours }: { tours: TourWithAvailability[] }) {
  const cards = useMemo(() => {
    const price = (slug: string) => {
      const tour = tours.find((t) => t.slug === slug);
      return tour ? fromPrice(tour) : 0;
    };
    const shared = packagePrice(price(BANFF_YOHO.slug), price(ICEFIELD.slug)).price;
    return [
      { option: SHARED_TWO_DAY, price: shared, name: PACKAGE_NAMES[TWO_DAY_PACKAGE.slug], badge: "Shared Tour" },
      ...PRIVATE_OPTIONS.filter((o) => PRIVATE_JOURNEYS.includes(o.id) || o.isCustomPartner).map((o) => ({
        option: o,
        // Packages show the doc's per-day price (as on the Private Tours page).
        price: o.isCustomPartner ? 0 : o.slug && price(o.slug) > 0 ? price(o.slug) : o.priceFrom,
        name: undefined,
        badge: undefined,
      })),
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
        <ul className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.option.id} className="flex min-w-0">
              <PrivateTourCard option={card.option} calculatedPrice={card.price} name={card.name} badge={card.badge} />
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
