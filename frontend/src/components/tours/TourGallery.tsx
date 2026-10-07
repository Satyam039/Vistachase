"use client";

// Category listing (shared tours, private tours, activity tickets), structured like the booking
// sites studied for the redesign (GetYourGuide, Viator, Civitatis):
//   breadcrumb → full-bleed hero (category clip, parallax, why choose it) → stats strip
//   → sticky sort bar with the result count → card grid → reassurance → other ways to explore

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";
import { TourCard } from "@/components/tours/TourCard";
import { TrustRow } from "@/components/home/TrustRow";
import { Rail } from "@/components/motion/Rail";
import { fromPrice } from "@/lib/tours";
import { SERVICES, type Service } from "@/lib/services";
import type { TourWithAvailability } from "@/lib/api/types";

const SORTS = {
  recommended: "Recommended",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  duration: "Duration: shortest first",
} as const;
type SortKey = keyof typeof SORTS;

export function TourGallery({
  heading,
  intro,
  ctaLabel,
  ctaHref,
  tours,
  service,
}: {
  heading: string;
  intro: string;
  ctaLabel: string;
  ctaHref: string;
  tours: TourWithAvailability[];
  /** The category's service: background clip and "why choose" reasons. */
  service?: Service;
}) {
  const [sort, setSort] = useState<SortKey>("recommended");

  // Rating summary from products that have real reviews (new products have none).
  const reviewed = tours.filter((t) => t.reviewCount > 0);
  const rating = reviewed.length ? reviewed.reduce((sum, t) => sum + t.rating, 0) / reviewed.length : null;
  const reviews = reviewed.length ? Math.max(...reviewed.map((t) => t.reviewCount)) : 0;

  const sorted = useMemo(() => {
    const list = tours.slice();
    const price = (t: TourWithAvailability) => fromPrice(t) || Number.POSITIVE_INFINITY; // on request last
    if (sort === "price-asc") list.sort((a, b) => price(a) - price(b));
    if (sort === "price-desc") list.sort((a, b) => (fromPrice(b) || 0) - (fromPrice(a) || 0));
    if (sort === "duration") list.sort((a, b) => a.durationHours - b.durationHours);
    return list;
  }, [sort, tours]);

  const stats = [
    { value: String(tours.length), label: tours.length === 1 ? "experience" : "experiences" },
    ...(rating !== null ? [{ value: rating.toFixed(1), label: "average rating" }] : []),
    ...(reviews > 0 ? [{ value: reviews >= 1000 ? `${reviews.toLocaleString("en-CA")}+` : String(reviews), label: "guest reviews" }] : []),
    { value: "24h", label: "free cancellation" },
  ];
  const others = SERVICES.filter((s) => s.id !== service?.id);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* Hero */}
      <section className="relative flex min-h-[78vh] items-end overflow-hidden bg-ocean-950 text-white">
        {service && (
          <div className="absolute inset-0">
            <Image src={service.image} alt="" fill priority sizes="100vw" className="object-cover" data-parallax="10" />
            {service.video && (
              <AmbientVideo
                src={service.video.src}
                srcHd={service.video.srcHd}
                poster={service.video.poster}
                className="absolute inset-0 h-full w-full object-cover"
                buttonClassName="top-6 right-6"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ocean-950 via-ocean-950/60 to-ocean-950/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-ocean-950/70 to-transparent" />
          </div>
        )}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-page pb-14 pt-24" data-scroll-fade>
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-200">
              <li>
                <Link href="/" className="hover:text-white hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                <Link href="/search" className="hover:text-white hover:underline">
                  Experiences
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-white">
                {service?.title ?? heading}
              </li>
            </ol>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
            <div className="max-w-3xl">
              <h1 className="text-balance text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl motion-safe:animate-[fadeUp_900ms_ease-out]">
                {heading}
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-light leading-relaxed text-slate-200 motion-safe:animate-[fadeUp_1100ms_ease-out]">{intro}</p>
            </div>
            <div className="space-y-6 motion-safe:animate-[fadeUp_1300ms_ease-out]">
              {service && (
                <ul className="grid gap-2.5" aria-label={`Why choose ${service.title.toLowerCase()}`}>
                  {service.reasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-2.5 text-base text-slate-100">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-summit-500" aria-hidden="true" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={ctaHref} className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-7 text-base">
                {ctaLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip (Civitatis) */}
      <section aria-label={`${service?.title ?? heading} at a glance`} className="border-b border-obsidian-900/[0.06] bg-white">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 px-page sm:grid-cols-4" data-stagger>
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse py-6 sm:py-8">
              <dt className="mt-1 text-sm text-slate-600">{s.label}</dt>
              <dd className="text-3xl font-light tabular-nums text-obsidian-900">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Results */}
      <section aria-labelledby="results-heading" className="mx-auto max-w-7xl px-page py-14 sm:py-20">
        {tours.length === 0 ? (
          <div className="mx-auto max-w-xl space-y-4 rounded-3xl bg-white p-12 text-center ring-1 ring-obsidian-900/[0.07]">
            <Sparkles className="mx-auto h-8 w-8 text-summit-600" aria-hidden="true" />
            <h2 id="results-heading" className="text-2xl text-obsidian-900">
              New dates are on the way
            </h2>
            <p className="text-base leading-relaxed text-slate-600">
              We&rsquo;re finalising this season&rsquo;s departures. Ask our concierge team about private arrangements.
            </p>
            <Link href="/concierge" className="golden-summit-btn inline-flex h-11 items-center rounded-full px-6 text-base">
              Ask the concierge
            </Link>
          </div>
        ) : (
          <>
            <div className="sticky top-[var(--vc-header-h,80px)] z-20 -mx-page mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-obsidian-900/[0.06] bg-obsidian-50/90 px-page py-3 backdrop-blur-md">
              <h2 id="results-heading" className="text-lg text-obsidian-900" aria-live="polite">
                {tours.length} {tours.length === 1 ? "experience" : "experiences"}
              </h2>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Sort by
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-11 rounded-full border border-obsidian-900/15 bg-white px-4 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30"
                >
                  {Object.entries(SORTS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ul key={sort} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8" data-stagger>
              {sorted.map((tour) => (
                <li key={tour.id}>
                  <TourCard tour={tour} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <TrustRow />

      {/* Other ways to explore */}
      <section aria-labelledby="other-ways" className="overflow-hidden bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-page">
          <h2 id="other-ways" className="mb-8 text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl" data-reveal>
            Other ways to explore
          </h2>
          <Rail label="Other ways to explore" itemClassName="w-[80%] sm:w-[45%] lg:w-[31%]">
            {others.map((s) => (
              <Link
                key={s.id}
                href={s.href}
                className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[1.75rem] p-6 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ocean-600"
              >
                <Image src={s.image} alt="" fill sizes="(max-width: 640px) 80vw, 31vw" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]" />
                <span className="absolute inset-0 bg-gradient-to-t from-obsidian-950/85 via-obsidian-950/20 to-transparent" />
                <span className="relative text-2xl font-light">{s.title}</span>
                <span className="relative mt-2 inline-flex items-center gap-1.5 text-sm text-slate-200">
                  {s.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </Rail>
        </div>
      </section>
    </div>
  );
}
