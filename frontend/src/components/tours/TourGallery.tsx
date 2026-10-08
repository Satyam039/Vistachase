"use client";

// Category listing (shared tours, private tours, activity tickets), structured like the booking
// sites studied for the redesign (GetYourGuide, Viator, Civitatis):
//   breadcrumb → full-bleed hero (category clip, parallax, why choose it) → stats strip
//   → sticky sort bar with the result count → card grid → reassurance → guest reviews rail
//   → FAQ (from the category's own tours) → other ways to explore

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Compass,
  MapPin,
  MountainSnow,
  Route,
  Ship,
  Sparkles,
  Star,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";
import { TourCard } from "@/components/tours/TourCard";
import { TrustRow } from "@/components/home/TrustRow";
import { PinnedHorizontal } from "@/components/motion/PinnedHorizontal";
import { Rail } from "@/components/motion/Rail";
import { FaqBrowser } from "@/components/faq/FaqBrowser";
import type { CategoryReview } from "@/lib/api/catalog";
import { fromPrice } from "@/lib/tours";
import { SERVICES, type Service } from "@/lib/services";
import type { TourWithAvailability } from "@/lib/api/types";

/** "Why go private? Your vehicle, your guide, your pace." → "Your vehicle, your guide, your pace." */
const shortTagline = (tagline: string) => tagline.split("? ").pop() ?? tagline;

/** An icon for each "why choose" reason, matched on its wording. */
const REASON_ICONS: [RegExp, LucideIcon][] = [
  [/group|12|crowd/i, Users],
  [/pickup|staying/i, MapPin],
  [/parks canada|entry/i, BadgeCheck],
  [/guide|lookout/i, Compass],
  [/suv|van|vehicle/i, CarFront],
  [/stops|how long/i, Route],
  [/price|priced/i, Tag],
  [/cruise/i, Ship],
  [/gondola|skywalk|springs/i, MountainSnow],
  [/request|timed/i, CalendarClock],
];
const reasonIcon = (reason: string) => REASON_ICONS.find(([re]) => re.test(reason))?.[1] ?? CheckCircle2;

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
  reviews = [],
  faqs = [],
}: {
  heading: string;
  intro: string;
  ctaLabel: string;
  ctaHref: string;
  tours: TourWithAvailability[];
  /** The category's service: background clip and "why choose" reasons. */
  service?: Service;
  /** Real reviews of this category's tours (getCategoryExtras). */
  reviews?: CategoryReview[];
  faqs?: { question: string; answer: string }[];
}) {
  const [sort, setSort] = useState<SortKey>("recommended");

  // Rating summary from products that have real reviews (new products have none).
  const reviewed = tours.filter((t) => t.reviewCount > 0);
  const rating = reviewed.length
    ? reviewed.reduce((sum, t) => sum + t.rating, 0) / reviewed.length
    : null;
  const reviewTotal = reviewed.length
    ? Math.max(...reviewed.map((t) => t.reviewCount))
    : 0;

  const sorted = useMemo(() => {
    const list = tours.slice();
    const price = (t: TourWithAvailability) =>
      fromPrice(t) || Number.POSITIVE_INFINITY; // on request last
    if (sort === "price-asc") list.sort((a, b) => price(a) - price(b));
    if (sort === "price-desc")
      list.sort((a, b) => (fromPrice(b) || 0) - (fromPrice(a) || 0));
    if (sort === "duration")
      list.sort((a, b) => a.durationHours - b.durationHours);
    return list;
  }, [sort, tours]);

  // Tickets follow each operator's cancellation rules, so they don't get the 72-hour stat or the
  // tour reassurance strip (small groups, lake access).
  const isTickets = service?.id === "tickets";
  const parks = new Set(tours.map((t) => t.destination.name)).size;
  const stats = [
    { value: String(tours.length), label: tours.length === 1 ? "experience" : "experiences" },
    ...(rating !== null ? [{ value: rating.toFixed(1), label: "average rating" }] : []),
    ...(reviewTotal > 0 ? [{ value: reviewTotal >= 1000 ? `${reviewTotal.toLocaleString("en-CA")}+` : String(reviewTotal), label: "guest reviews" }] : []),
    ...(isTickets ? [] : [{ value: "72h", label: "free cancellation" }]),
    ...(parks > 1 ? [{ value: String(parks), label: "national parks" }] : []),
  ].slice(0, 4);
  const others = SERVICES.filter((s) => s.id !== service?.id);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* Hero (GetYourGuide / Viator category pattern): breadcrumb, rating, title, one-line lede and
          the CTA; the "why choose" reasons sit in a frosted chip row along the bottom (a swipeable
          rail on phones). The longer intro lives in the strip below, not over the photo. */}
      <section className="relative isolate flex min-h-[34rem] flex-col justify-end overflow-hidden bg-ocean-950 text-white sm:min-h-[40rem] lg:min-h-[78vh]">
        {service && (
          <div className="absolute inset-0 -z-10">
            <Image src={service.image} alt="" fill priority sizes="100vw" className="object-cover" data-parallax="10" />
            {service.video && (
              <AmbientVideo src={service.video.src} srcHd={service.video.srcHd} poster={service.video.poster} className="absolute inset-0 h-full w-full object-cover" once />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ocean-950 via-ocean-950/45 to-ocean-950/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-ocean-950/60 to-transparent" />
          </div>
        )}

        <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-page pt-20 text-center" data-scroll-fade>
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-sm text-slate-200">
              <li>
                <Link href="/" className="hover:text-white hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true" className="max-sm:hidden">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li className="max-sm:hidden">
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

          {rating !== null && (
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white sm:text-sm ring-1 ring-white/20 backdrop-blur-md motion-safe:animate-[fadeUp_700ms_ease-out]">
              <Star className="h-4 w-4 fill-summit-500 text-summit-500" aria-hidden="true" />
              {rating.toFixed(1)}
              <span className="text-white/75">
                · {reviewTotal >= 1000 ? `${reviewTotal.toLocaleString("en-CA")}+` : reviewTotal} reviews
              </span>
            </p>
          )}

          <h1 className="mx-auto max-w-4xl text-balance text-[clamp(2.25rem,9.5vw,2.75rem)] font-light leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl motion-safe:animate-[fadeUp_900ms_ease-out]">
            {heading}
          </h1>
          {service && (
            <p className="mx-auto mt-3 max-w-xl text-base font-light leading-snug text-slate-100 sm:mt-4 sm:text-lg lg:text-xl motion-safe:animate-[fadeUp_1100ms_ease-out]">
              {shortTagline(service.tagline)}
            </p>
          )}
          <Link href={ctaHref} className="golden-summit-btn mt-7 inline-flex h-12 items-center gap-2 rounded-full px-7 text-base motion-safe:animate-[fadeUp_1300ms_ease-out]">
            {ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {service && (
          <div className="mt-10 border-t border-white/10 bg-ocean-950/35 backdrop-blur-md sm:mt-12">
            <ul
              aria-label={`Why choose ${service.title.toLowerCase()}`}
              // Focusable so keyboard users can scroll the chips on phones (like Rail).
              tabIndex={0}
              className="vc-rail mx-auto flex max-w-7xl snap-x snap-mandatory gap-3 overflow-x-auto px-page py-4 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-summit-400 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:py-5"
            >
              {service.reasons.map((reason) => {
                const Icon = reasonIcon(reason);
                return (
                  <li key={reason} className="flex shrink-0 snap-start items-center gap-3 rounded-full bg-white/10 py-2 pl-2 pr-4 ring-1 ring-white/15 lg:rounded-none lg:bg-transparent lg:p-0 lg:ring-0">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-summit-500/20 text-summit-400">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="max-w-[15rem] text-sm leading-snug text-white lg:max-w-none lg:text-base">{reason}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Intro + stats (Civitatis / Viator "about" strip under the hero) */}
      <section aria-label={`About ${service?.title.toLowerCase() ?? heading}`} className="border-b border-obsidian-900/[0.06] bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-page py-8 sm:py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          <IntroText
            text={
              // Don't repeat the hero's lede as the intro's first sentence.
              service && intro.startsWith(shortTagline(service.tagline)) ? intro.slice(shortTagline(service.tagline).length).trim() : intro
            }
          />
          <dl className="grid grid-cols-2 justify-items-center gap-x-6 gap-y-6 sm:grid-cols-4 lg:grid-cols-2" data-stagger>
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse items-center justify-end text-center">
                <dt className="mt-1 text-sm text-slate-600">{s.label}</dt>
                <dd className="text-3xl font-light tabular-nums text-obsidian-900">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Results */}
      <section
        aria-labelledby="results-heading"
        className="mx-auto max-w-7xl px-page py-14 sm:py-20"
      >
        {tours.length === 0 ? (
          <div className="mx-auto max-w-xl space-y-4 rounded-3xl bg-white p-12 text-center ring-1 ring-obsidian-900/[0.07]">
            <Sparkles
              className="mx-auto h-8 w-8 text-summit-600"
              aria-hidden="true"
            />
            <h2 id="results-heading" className="text-2xl text-obsidian-900">
              New dates are on the way
            </h2>
            <p className="text-base leading-relaxed text-slate-600">
              We&rsquo;re finalising this season&rsquo;s departures. Ask our
              concierge team about private arrangements.
            </p>
            <Link
              href="/concierge"
              className="golden-summit-btn inline-flex h-11 items-center rounded-full px-6 text-base"
            >
              Ask the concierge
            </Link>
          </div>
        ) : (
          <>
            <div className="sticky top-[calc(var(--vc-header-h,80px)+16px)] z-20 mb-8 flex items-center justify-between gap-3 rounded-full bg-white py-2 pl-5 pr-2 sm:pl-6 shadow-[0_12px_24px_-20px_rgba(12,31,33,0.45)] ring-1 ring-obsidian-900/[0.08]">
              <h2
                id="results-heading"
                className="text-lg text-obsidian-900"
                aria-live="polite"
              >
                {tours.length}{" "}
                {tours.length === 1 ? "experience" : "experiences"}
              </h2>
              <Dropdown
                variant="pill"
                label="Sort by"
                labelClassName="sr-only sm:not-sr-only whitespace-nowrap text-sm text-slate-600"
                className="flex items-center gap-2 [&>div]:w-44 sm:[&>div]:w-56"
                value={sort}
                onChange={(v) => setSort(v as SortKey)}
                options={Object.entries(SORTS).map(([key, label]) => ({ value: key, label }))}
              />
            </div>
            <ul
              key={sort}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8"
              data-stagger
            >
              {sorted.map((tour) => (
                <li key={tour.id}>
                  <TourCard tour={tour} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {!isTickets && <TrustRow />}

      {reviews.length > 0 && (
        <section
          aria-labelledby="reviews-heading"
          className="overflow-hidden py-16 sm:py-20"
        >
          <div className="mx-auto max-w-7xl px-page">
            <div className="mx-auto mb-8 max-w-2xl text-center" data-reveal>
              <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">
                Guest reviews
              </p>
              <h2
                id="reviews-heading"
                className="text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl"
              >
                What guests say
              </h2>
              {rating !== null && (
                <p className="mt-3 flex items-center justify-center gap-2 text-base text-slate-600">
                  <Star
                    className="h-4 w-4 fill-summit-500 text-summit-500"
                    aria-hidden="true"
                  />
                  <span className="text-obsidian-900">{rating.toFixed(1)}</span>{" "}
                  average across {reviewed.length}{" "}
                  {reviewed.length === 1 ? "tour" : "tours"}
                </p>
              )}
            </div>
            {reviews.length > 3 ? (
              <Rail
                label="Guest reviews"
                itemClassName="w-[82vw] max-w-[24rem] sm:w-[24rem]"
              >
                {reviews.map((r) => (
                  <figure
                    key={r.id}
                    className="flex h-full flex-col rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07] transition-shadow hover:shadow-md"
                  >
                    <p
                      className="flex items-center gap-1"
                      role="img"
                      aria-label={`${r.rating} out of 5`}
                    >
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < r.rating ? "fill-summit-500 text-summit-500" : "text-slate-300"}`}
                          aria-hidden="true"
                        />
                      ))}
                    </p>
                    <blockquote className="mt-4 flex-1">
                      <p className="text-lg font-light text-obsidian-900">
                        {r.title}
                      </p>
                      <p className="mt-2 line-clamp-5 text-base leading-relaxed text-slate-700">
                        {r.body}
                      </p>
                    </blockquote>
                    <figcaption className="mt-5 border-t border-obsidian-900/[0.06] pt-4 text-sm text-slate-600">
                      <span className="text-obsidian-900">{r.authorName}</span>{" "}
                      · {r.date}
                      <Link
                        href={`/${r.tourSlug}`}
                        className="mt-1 block truncate text-ocean-600 underline-offset-4 hover:underline"
                      >
                        {r.tourTitle}
                      </Link>
                    </figcaption>
                  </figure>
                ))}
              </Rail>
            ) : (
              <div
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                data-stagger
              >
                {reviews.map((r) => (
                  <figure
                    key={r.id}
                    className="flex h-full flex-col rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07] transition-shadow hover:shadow-md"
                  >
                    <p
                      className="flex items-center gap-1"
                      role="img"
                      aria-label={`${r.rating} out of 5`}
                    >
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < r.rating ? "fill-summit-500 text-summit-500" : "text-slate-300"}`}
                          aria-hidden="true"
                        />
                      ))}
                    </p>
                    <blockquote className="mt-4 flex-1">
                      <p className="text-lg font-light text-obsidian-900">
                        {r.title}
                      </p>
                      <p className="mt-2 line-clamp-5 text-base leading-relaxed text-slate-700">
                        {r.body}
                      </p>
                    </blockquote>
                    <figcaption className="mt-5 border-t border-obsidian-900/[0.06] pt-4 text-sm text-slate-600">
                      <span className="text-obsidian-900">{r.authorName}</span>{" "}
                      · {r.date}
                      <Link
                        href={`/${r.tourSlug}`}
                        className="mt-1 block truncate text-ocean-600 underline-offset-4 hover:underline"
                      >
                        {r.tourTitle}
                      </Link>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {faqs.length > 0 && (
        <section
          aria-labelledby="faq-heading"
          className="border-t border-obsidian-900/[0.06] bg-white py-16 sm:py-20"
        >
          <div className="mx-auto grid max-w-7xl gap-10 px-page lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
            <div data-reveal>
              <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">
                Good to know
              </p>
              <h2
                id="faq-heading"
                className="text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl"
              >
                Frequently asked questions
              </h2>
              <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-600">
                Answers from our tour pages. Something else on your mind?
              </p>
              <Link
                href="/faq"
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/15 px-5 text-sm text-obsidian-900 hover:bg-obsidian-50"
              >
                All FAQs <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <FaqBrowser
              compact
              topics={[]}
              items={faqs.map((f) => ({
                q: f.question,
                a: f.answer,
                topic: "",
              }))}
            />
          </div>
        </section>
      )}

      {/* Other ways to explore: pinned horizontal scroll on large screens */}
      <PinnedHorizontal
        label="Other ways to explore"
        heading={
          <div className="text-center">
            <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">
              Keep exploring
            </p>
            <h2 className="text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl">
              Other ways to explore
            </h2>
          </div>
        }
        itemClassName="w-[24rem] xl:w-[26rem]"
      >
        {others.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[1.75rem] p-7 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ocean-600 lg:aspect-auto lg:h-[min(32rem,calc(100vh-var(--vc-header-h,80px)-18rem))]"
          >
            <Image
              src={s.image}
              alt=""
              fill
              sizes="(max-width: 640px) 80vw, 26rem"
              className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]"
            />
            <span className="vc-scrim" aria-hidden="true" />
            <span className="relative text-2xl font-light sm:text-3xl">
              {s.title}
            </span>
            <span className="relative mt-2 max-w-xs text-base font-light text-slate-200">
              {shortTagline(s.tagline)}
            </span>
            <span className="relative mt-4 inline-flex items-center gap-1.5 text-sm text-white">
              <span className="border-b border-summit-500 pb-0.5">{s.cta}</span>
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </span>
          </Link>
        ))}
      </PinnedHorizontal>
    </div>
  );
}

/** The category intro: full on large screens; three lines plus "Read more" on phones. */
function IntroText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p id="category-intro" className={`text-lg font-light leading-relaxed text-slate-700 ${open ? "" : "max-lg:line-clamp-3"}`}>
        {text}
      </p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="category-intro"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 text-sm text-ocean-600 underline underline-offset-4 lg:hidden"
      >
        {open ? "Show less" : "Read more"}
      </button>
    </div>
  );
}
