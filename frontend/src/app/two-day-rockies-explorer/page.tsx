// Two-Day Rockies Explorer: both shared day tours (Banff & Yoho Discovery, then Columbia Icefield
// Adventure) with 10% off, from the owner's "Update Vista Chase web" doc. The price is the two
// tours' live "from" prices less 10%. "Book Both Days" opens the package checkout (one payment for
// both days); guests who want dates that aren't listed can still ask through the contact form.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BedDouble, Check, ChevronRight, Clock, Info, MapPin, Users } from "lucide-react";
import { getTours } from "@/lib/api/catalog";
import { FALLBACK_TOURS } from "@/lib/api/fallback-data";
import type { TourWithAvailability } from "@/lib/api/types";
import { PackagePrice } from "@/components/tours/SharedToursLanding";
import { fromPrice } from "@/lib/tours";
import { PICKUP_TIMES, TWO_DAY_PACKAGE, packagePrice } from "@/lib/sharedTours";

export const metadata: Metadata = {
  title: "Two-Day Rockies Explorer | Banff, Yoho & Columbia Icefield | Vista Chase",
  description:
    "Both small-group day tours in one booking: Banff & Yoho Discovery and the Columbia Icefield Adventure. Save 10%, maximum 12 guests each day, pickup in Banff & Canmore. Accommodation not included.",
  alternates: { canonical: "/two-day-rockies-explorer" },
};

export default async function TwoDayRockiesExplorerPage() {
  let tours: TourWithAvailability[] = [];
  try {
    tours = await getTours({ category: "SHARED" });
  } catch (err) {
    tours = FALLBACK_TOURS.filter((t) => t.category === "SHARED");
  }
  const [day1, day2] = TWO_DAY_PACKAGE.days.map((d) => {
    const tour = tours.find((t) => t.slug === d.slug);
    return tour ? fromPrice(tour) : 0;
  });
  const { price, separate } = packagePrice(day1, day2);
  const requestHref = `/contact-us?package=${TWO_DAY_PACKAGE.slug}`;

  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <section data-nav-hero className="relative isolate flex min-h-[34rem] items-end overflow-hidden bg-obsidian-950 text-white sm:min-h-[40rem] lg:min-h-[72vh]">
        <div className="absolute inset-0 -z-10 grid grid-cols-2 gap-0.5">
          {TWO_DAY_PACKAGE.images.map((img, i) => (
            <div key={img.src} className="relative">
              <Image src={img.src} alt="" fill priority={i === 0} sizes="50vw" className="object-cover" />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/55 to-ocean-950/20" />
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-page pb-14 pt-[calc(var(--vc-nav-open-h,100px)+1.5rem)] text-center" data-scroll-fade>
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-sm text-slate-200">
              <li>
                <Link href="/" className="hover:text-white hover:underline">Home</Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                <Link href="/shared-tours" className="hover:text-white hover:underline">Small-group tours</Link>
              </li>
              <li aria-hidden="true" className="max-sm:hidden">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-white max-sm:hidden">Two-day package</li>
            </ol>
          </nav>
          <p className="mb-4 bg-summit-200 px-3 py-1 text-xs uppercase tracking-[0.14em] text-obsidian-900">{TWO_DAY_PACKAGE.saving}</p>
          <h1 className="text-balance text-[clamp(2.25rem,9vw,2.75rem)] font-light leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            {TWO_DAY_PACKAGE.title}
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.3em] text-summit-300 sm:text-base">{TWO_DAY_PACKAGE.label}</p>
          <p className="mx-auto mt-4 max-w-2xl text-base font-light leading-relaxed text-slate-100 sm:text-lg">{TWO_DAY_PACKAGE.description}</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl items-start gap-8 px-page py-14 sm:py-20 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-12">
        <div className="space-y-6">
          {TWO_DAY_PACKAGE.days.map((d, i) => (
            <article key={d.slug} className="overflow-hidden rounded-none bg-white ring-1 ring-obsidian-900/[0.07] sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="relative aspect-[4/3] sm:aspect-auto">
                <Image src={d.image} alt={d.imageAlt} fill sizes="(max-width: 640px) 92vw, 320px" className="object-cover" />
              </div>
              <div className="p-6 sm:p-8">
                <p className="text-sm uppercase tracking-[0.22em] text-ocean-600">Day {i + 1}</p>
                <h2 className="mt-1 text-2xl font-light text-obsidian-900">{d.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{d.label}</p>
                <h3 className="mt-5 text-xs uppercase tracking-[0.2em] text-slate-500">Planned stops</h3>
                <ul className="mt-2 grid gap-x-4 gap-y-1 text-base text-slate-700 sm:grid-cols-2">
                  {d.stops.map((s) => (
                    <li key={s} className="flex gap-2">
                      <MapPin className="mt-1 h-3.5 w-3.5 shrink-0 text-ocean-600" aria-hidden="true" />
                      {s}
                    </li>
                  ))}
                </ul>
                <h3 className="mt-5 text-xs uppercase tracking-[0.2em] text-slate-500">Included</h3>
                <ul className="mt-2 space-y-1 text-base text-slate-700">
                  {d.included.map((x) => (
                    <li key={x} className="flex gap-2">
                      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-ocean-600" aria-hidden="true" />
                      {x}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-slate-600">{d.lunch}</p>
                <Link href={`/${d.slug}`} className="mt-4 inline-flex items-center gap-1.5 text-sm text-ocean-700 underline underline-offset-4">
                  See this day&rsquo;s full tour page <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
          <p className="flex gap-2 text-sm text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
            Stops and their order may change with the season, weather and road conditions. Other guests may join either day: this is not a private tour.
          </p>
        </div>

        <aside className="rounded-none bg-obsidian-950 p-6 text-white sm:p-8 lg:sticky lg:top-[calc(var(--vc-header-h,80px)+24px)]" aria-label="Price and booking">
          <PackagePrice price={price} separate={separate} size="lg" />
          <ul className="mt-6 space-y-3 text-base text-white/85">
            <li className="flex gap-3">
              <Clock className="mt-1 h-4 w-4 shrink-0 text-summit-300" aria-hidden="true" />
              {TWO_DAY_PACKAGE.duration}
            </li>
            <li className="flex gap-3">
              <Users className="mt-1 h-4 w-4 shrink-0 text-summit-300" aria-hidden="true" />
              Maximum 12 guests each day
            </li>
            <li className="flex gap-3">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-summit-300" aria-hidden="true" />
              Pickup in Banff &amp; Canmore. {PICKUP_TIMES}
            </li>
            <li className="flex gap-3">
              <BedDouble className="mt-1 h-4 w-4 shrink-0 text-summit-300" aria-hidden="true" />
              Accommodation not included. Guests arrange their own overnight stay.
            </li>
          </ul>
          <Link href={`${TWO_DAY_PACKAGE.href}/book`} className="golden-summit-btn mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base">
            Book Both Days <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="mt-3 text-sm text-white/60">
            Choose a date for each tour and pay once, with 10% off.{" "}
            <Link href={requestHref} className="text-white underline underline-offset-2">
              Need other dates? Ask us
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
