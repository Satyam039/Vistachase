// Three signature days, side by side on a dark panel: a quick way to see how a category's tours
// differ before scrolling the full list. Every field comes from the product itself (catalog data):
// the theme line is the only editorial text and only names what the tour's own stops are. Add-on
// tickets the price doesn't cover are listed so nobody is surprised at the lake. Cards are compact
// (photo, title, duration, price); the stops, inclusions and pickup open in place.

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronDown, Clock, MapPin, Ticket } from "lucide-react";
import { PriceTag } from "@/components/pricing/PriceTag";
import { SectionHeading } from "@/components/home/SectionHeading";
import { durationLabel, fromPrice, pickupLabel, priceUnitLabel } from "@/lib/tours";
import type { TourWithAvailability } from "@/lib/api/types";

export interface SignaturePick {
  slug: string;
  /** One line on what the day is about, naming only the tour's own stops. */
  theme: string;
}

const STOPS = 4;

export function SignatureDays({
  eyebrow,
  title,
  intro,
  picks,
  tours,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  picks: SignaturePick[];
  tours: TourWithAvailability[];
}) {
  const days = picks
    .map((p) => ({ ...p, tour: tours.find((t) => t.slug === p.slug) }))
    .filter((d): d is SignaturePick & { tour: TourWithAvailability } => Boolean(d.tour));
  if (days.length === 0) return null;

  return (
    <section aria-labelledby="signature-heading" className="bg-obsidian-950 text-white">
      <div className="mx-auto max-w-7xl px-page py-16 sm:py-24">
        <SectionHeading id="signature-heading" eyebrow={eyebrow} title={title} intro={intro} tone="dark" />
        <ul className="mt-10 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5" data-stagger>
          {days.map(({ tour, theme }) => {
            const operation = tour.facts.find((f) => /operation/i.test(f.label))?.value;
            const pickup = tour.inclusions.find((i) => /pickup/i.test(i));
            const included = tour.inclusions.filter((i) => i !== pickup);
            const addOns = tour.exclusions.filter((e) => /ticket|add-on/i.test(e));
            return (
              <li key={tour.id} className="flex flex-col overflow-hidden rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08]">
                <div className="relative aspect-[3/2]">
                  <Image src={tour.featuredImage} alt="" fill sizes="(min-width: 1024px) 400px, 100vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/80 via-transparent" />
                  <p className="absolute inset-x-0 bottom-0 px-4 pb-3 text-xs uppercase tracking-[0.18em] text-summit-200">{theme}</p>
                </div>
                <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
                  <h3 className="line-clamp-2 text-sm font-light uppercase leading-snug tracking-[0.12em] text-white sm:text-[0.95rem]">{tour.title}</h3>

                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
                    <div className="flex items-center gap-1">
                      <dt className="sr-only">Duration</dt>
                      <Clock className="h-3 w-3 text-summit-300" aria-hidden="true" />
                      <dd>{durationLabel(tour)}</dd>
                    </div>
                    {operation && (
                      <div className="flex items-center gap-1">
                        <dt className="sr-only">Season</dt>
                        <CalendarDays className="h-3 w-3 text-summit-300" aria-hidden="true" />
                        <dd>{operation}</dd>
                      </div>
                    )}
                  </dl>

                  {/* The full plan (stops, inclusions, add-ons, pickup) opens in place, so the card
                      stays compact without dropping any of it. */}
                  <details className="group/plan mt-3 border-t border-white/[0.08] pt-2.5">
                    <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-xs uppercase tracking-[0.16em] text-white/75 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-300 [&::-webkit-details-marker]:hidden">
                      Stops, inclusions &amp; pickup
                      <ChevronDown className="h-4 w-4 transition-transform duration-300 group-open/plan:rotate-180" aria-hidden="true" />
                    </summary>
                    <h4 className="mt-2 text-xs uppercase tracking-[0.2em] text-white/50">Key stops</h4>
                    <ul className="mt-2 space-y-1 text-sm text-white/85">
                      {tour.highlights.slice(0, STOPS).map((h) => (
                        <li key={h} className="flex gap-2">
                          <MapPin className="mt-1 h-3.5 w-3.5 shrink-0 text-summit-300" aria-hidden="true" />
                          {h}
                        </li>
                      ))}
                    </ul>

                    <h4 className="mt-4 text-xs uppercase tracking-[0.2em] text-white/50">Included</h4>
                    <ul className="mt-2 space-y-1 text-sm text-white/70">
                      {included.map((i) => (
                        <li key={i} className="flex gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-summit-300" aria-hidden="true" />
                          {i}
                        </li>
                      ))}
                    </ul>
                    {addOns.length > 0 && (
                      <p className="mt-2 flex gap-2 text-sm text-white/55">
                        <Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Not included: {addOns.map((a) => a.replace(/\s*\(add-on\)/i, "")).join(", ")}</span>
                      </p>
                    )}

                    <h4 className="mt-4 text-xs uppercase tracking-[0.2em] text-white/50">Pickup</h4>
                    <p className="mt-1.5 text-sm text-white/70">
                      {pickup ? pickupLabel(pickup) : "Hotel pickup"} ·{" "}
                      <Link href="/pickup-finder" className="text-summit-200 underline decoration-summit-200/40 underline-offset-4 hover:decoration-summit-200">
                        find your pickup point
                      </Link>
                    </p>
                  </details>

                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-white/[0.08] pt-3">
                    <PriceTag price={fromPrice(tour)} currency={tour.currency} unit={priceUnitLabel(tour)} size="sm" tone="dark" layout="inline" />
                    <Link
                      href={`/${tour.slug}`}
                      className="golden-summit-btn inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs uppercase tracking-[0.12em]"
                      aria-label={`View ${tour.title}`}
                    >
                      View tour
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
