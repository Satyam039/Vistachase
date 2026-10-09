// Three signature days, side by side on a dark panel: a quick way to see how a category's tours
// differ before scrolling the full list. Every field comes from the product itself (catalog data):
// the theme line is the only editorial text and only names what the tour's own stops are. Add-on
// tickets the price doesn't cover are listed so nobody is surprised at the lake.

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Clock, MapPin, Ticket } from "lucide-react";
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
        <ul className="mt-12 grid gap-6 lg:grid-cols-3 lg:gap-8" data-stagger>
          {days.map(({ tour, theme }) => {
            const operation = tour.facts.find((f) => /operation/i.test(f.label))?.value;
            const pickup = tour.inclusions.find((i) => /pickup/i.test(i));
            const included = tour.inclusions.filter((i) => i !== pickup);
            const addOns = tour.exclusions.filter((e) => /ticket|add-on/i.test(e));
            return (
              <li key={tour.id} className="flex flex-col overflow-hidden rounded-[1.75rem] bg-white/[0.04] ring-1 ring-white/[0.08]">
                <div className="relative aspect-[16/10]">
                  <Image src={tour.featuredImage} alt="" fill sizes="(min-width: 1024px) 400px, 100vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/70 via-transparent" />
                </div>
                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <p className="text-xs uppercase tracking-[0.2em] text-summit-200">{theme}</p>
                  <h3 className="mt-3 text-2xl font-light leading-snug text-white">{tour.title}</h3>

                  <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70">
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Duration</dt>
                      <Clock className="h-4 w-4 text-summit-300" aria-hidden="true" />
                      <dd>{durationLabel(tour)}</dd>
                    </div>
                    {operation && (
                      <div className="flex items-center gap-1.5">
                        <dt className="sr-only">Season</dt>
                        <CalendarDays className="h-4 w-4 text-summit-300" aria-hidden="true" />
                        <dd>{operation}</dd>
                      </div>
                    )}
                  </dl>

                  <h4 className="mt-6 text-xs uppercase tracking-[0.2em] text-white/50">Key stops</h4>
                  <ul className="mt-3 space-y-1.5 text-base text-white/85">
                    {tour.highlights.slice(0, STOPS).map((h) => (
                      <li key={h} className="flex gap-2">
                        <MapPin className="mt-1 h-4 w-4 shrink-0 text-summit-300" aria-hidden="true" />
                        {h}
                      </li>
                    ))}
                  </ul>

                  <h4 className="mt-6 text-xs uppercase tracking-[0.2em] text-white/50">Included</h4>
                  <ul className="mt-3 space-y-1.5 text-sm text-white/70">
                    {included.map((i) => (
                      <li key={i} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-summit-300" aria-hidden="true" />
                        {i}
                      </li>
                    ))}
                  </ul>
                  {addOns.length > 0 && (
                    <p className="mt-3 flex gap-2 text-sm text-white/55">
                      <Ticket className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Not included: {addOns.map((a) => a.replace(/\s*\(add-on\)/i, "")).join(", ")}</span>
                    </p>
                  )}

                  <h4 className="mt-6 text-xs uppercase tracking-[0.2em] text-white/50">Pickup</h4>
                  <p className="mt-2 text-sm text-white/70">
                    {pickup ? pickupLabel(pickup) : "Hotel pickup"} ·{" "}
                    <Link href="/pickup-finder" className="text-summit-200 underline decoration-summit-200/40 underline-offset-4 hover:decoration-summit-200">
                      find your pickup point
                    </Link>
                  </p>

                  <div className="mt-8 flex flex-1 items-end justify-between gap-4 border-t border-white/[0.08] pt-6">
                    <PriceTag price={fromPrice(tour)} currency={tour.currency} unit={priceUnitLabel(tour)} size="sm" tone="dark" />
                    <Link
                      href={`/${tour.slug}`}
                      className="golden-summit-btn inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm"
                      aria-label={`View ${tour.title}`}
                    >
                      View tour
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
