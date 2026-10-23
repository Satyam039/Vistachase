"use client";

// Private Tours landing page, crafted from the owner's design and content specification (pages 27–35).
// Features:
// - "YOUR PEOPLE. YOUR PACE." hero with 4 key trust chips and airport transfer note
// - "A Journey That Fits" intro with the 4 updated company statistics (6 Private Options, 1–5 Days, Doorstep Pickup, 15,000+ Guests Guided)
// - 6-card private journey grid adhering to the exact card specification (Duration, Transport, Suggested Stay, Pickup, Activities, Airport transfers, Accommodation, Live CAD price, "View Itinerary →" CTA)
// - 6th card dedicated to sister company Banff Elite ("Plan with Banff Elite ↗")
// - 4 core private benefits
// - Guest reviews slider
// - "Good to know / Your Questions, Answered" 12-question FAQ
// - "Other Ways to Explore"
// - Closing call to action with verified contact details

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building,
  Calendar,
  Car,
  ChevronRight,
  Clock,
  Compass,
  FileText,
  Info,
  Mail,
  MapPin,
  Phone,
  Plane,
  Shield,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { SectionHeading } from "@/components/home/SectionHeading";
import { ReviewSlider, type SliderReview } from "@/components/reviews/ReviewSlider";
import { FaqBrowser } from "@/components/faq/FaqBrowser";
import { MediaCard } from "@/components/cards/MediaCard";
import { CARD_BADGE, CARD_PANEL } from "@/components/cards/MediaCard";
import { TRIPADVISOR_REVIEWS } from "@/lib/reviews/tripadvisorReviews";
import { fromPrice } from "@/lib/tours";
import { money } from "@/lib/pricing";
import type { TourWithAvailability } from "@/lib/api/types";
import {
  PRIVATE_BENEFITS,
  PRIVATE_CLOSING,
  PRIVATE_FAQS,
  PRIVATE_HERO,
  PRIVATE_INTRO,
  PRIVATE_OPTIONS,
  PRIVATE_OTHER_WAYS,
  type PrivateTourOption,
} from "@/lib/privateTours";

export function PrivateToursLanding({
  tours,
  reviews = [],
}: {
  tours: TourWithAvailability[];
  reviews?: SliderReview[];
}) {
  // Combine live reviews with curated TripAdvisor private tour reviews
  const privateReviews = [
    ...reviews,
    ...TRIPADVISOR_REVIEWS.filter((r) => r.tourSlug === "private-tours"),
  ];

  // Prices are only what checkout charges: each day tour's live price, and for the two-day
  // package both of them less 10%. Options without a confirmed price show "Price on request".
  const livePrice = (slug: string) => {
    const match = tours.find((t) => t.slug === slug);
    return match ? fromPrice(match) : 0;
  };
  const getPrice = (opt: PrivateTourOption) => {
    if (opt.isCustomPartner) return 0;
    if (opt.id === "two-day-rockies-private") {
      const day1 = livePrice("banff-private-tour");
      const day2 = livePrice("icefields-jasper-private-tour");
      return day1 > 0 && day2 > 0 ? Math.floor((day1 + day2) * 0.9) : 0;
    }
    if (opt.slug && livePrice(opt.slug) > 0) return livePrice(opt.slug);
    return opt.priceFrom;
  };

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* 1 · Hero Section */}
      <section
        data-nav-hero
        aria-label="Private tours hero"
        className="relative isolate flex min-h-[38rem] flex-col justify-end overflow-hidden bg-obsidian-950 text-white sm:min-h-[44rem] lg:min-h-[84vh]"
      >
        <div className="absolute inset-0 -z-10">
          <Image
            src="/media/photos/bow-lake-dock-sunrise.webp"
            alt="Private Canadian Rockies tour with Vista Chase"
            fill
            priority
            sizes="100vw"
            className="object-cover"
            data-parallax="10"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ocean-950 via-ocean-950/55 to-ocean-950/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-ocean-950/60 to-transparent" />
        </div>

        <div
          className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-page pb-14 pt-[calc(var(--vc-nav-open-h,100px)+2rem)] text-center"
          data-scroll-fade
        >
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-sm text-slate-200">
              <li>
                <Link href="/" className="hover:text-white hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-white">
                Private tours
              </li>
            </ol>
          </nav>

          <p className="mb-4 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full bg-white/15 px-4 py-1.5 text-xs text-white ring-1 ring-white/20 backdrop-blur-md sm:text-sm motion-safe:animate-[fadeUp_700ms_ease-out]">
            <span className="flex items-center gap-0.5 text-summit-400" aria-label="Five stars">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              ))}
            </span>
            {PRIVATE_HERO.reviews}
          </p>

          <h1 className="mx-auto max-w-4xl text-balance text-[clamp(2.25rem,8vw,4.5rem)] font-light leading-[1.05] tracking-tight text-white motion-safe:animate-[fadeUp_900ms_ease-out]">
            {PRIVATE_HERO.title}
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.3em] text-summit-300 sm:text-base motion-safe:animate-[fadeUp_1000ms_ease-out]">
            {PRIVATE_HERO.kicker}
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base font-light leading-relaxed text-slate-100 sm:text-lg motion-safe:animate-[fadeUp_1100ms_ease-out]">
            {PRIVATE_HERO.lede}
          </p>

          <Link
            href="#private-tours"
            className="golden-summit-btn mt-8 inline-flex h-12 items-center gap-2 rounded-full px-8 text-base shadow-lg transition-transform hover:scale-[1.02] motion-safe:animate-[fadeUp_1300ms_ease-out]"
          >
            {PRIVATE_HERO.cta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>

          <p className="mt-4 text-xs tracking-wider text-summit-200/90 sm:text-sm">
            {PRIVATE_HERO.note}
          </p>
        </div>

        {/* 4 Feature Trust Chips */}
        <div className="border-t border-white/10 bg-obsidian-950/40 backdrop-blur-md">
          <ul
            aria-label="Private tour inclusions"
            className="vc-rail mx-auto flex max-w-7xl snap-x snap-mandatory gap-3 overflow-x-auto px-page py-4 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:py-5"
          >
            {PRIVATE_HERO.chips.map((chip, i) => {
              const icons = [Car, MapPin, Sparkles, Shield];
              const Icon = icons[i] || Compass;
              return (
                <li
                  key={chip}
                  className="flex shrink-0 snap-start items-center gap-3 rounded-full bg-white/10 py-2 pl-2 pr-4 ring-1 ring-white/15 lg:rounded-none lg:bg-transparent lg:p-0 lg:ring-0"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-summit-500/20 text-summit-400">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium leading-snug text-white lg:text-base">{chip}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 2 · Intro: A Journey That Fits & Statistics Strip */}
      <section aria-labelledby="intro-heading" className="border-b border-obsidian-900/[0.06] bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-page py-12 sm:py-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          <div data-reveal>
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-ocean-600 font-medium">Tailored exploration</p>
            <h2 id="intro-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl">
              {PRIVATE_INTRO.title}
            </h2>
            <p className="mt-4 text-lg font-light leading-relaxed text-slate-700">{PRIVATE_INTRO.body1}</p>
            <p className="mt-3 text-base font-light leading-relaxed text-slate-600">{PRIVATE_INTRO.body2}</p>
            <p className="mt-4 flex items-start gap-2 text-xs text-slate-500 bg-obsidian-50 p-3 rounded-xl border border-obsidian-900/[0.05]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
              <span>{PRIVATE_INTRO.optionalNotice}</span>
            </p>
          </div>

          <dl className="grid grid-cols-2 justify-items-center gap-x-6 gap-y-8 sm:grid-cols-4 lg:grid-cols-2" data-stagger>
            {PRIVATE_INTRO.stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col-reverse items-center justify-end text-center p-4 rounded-2xl bg-obsidian-50/80 border border-obsidian-900/[0.04] w-full"
              >
                <dt className="mt-2 text-xs sm:text-sm text-slate-600 font-light">{s.label}</dt>
                <dd className="text-3xl sm:text-4xl font-light tabular-nums text-obsidian-900 tracking-tight">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 3 · The 6 Private Options Grid */}
      <section id="private-tours" aria-labelledby="options-heading" className="scroll-mt-24 bg-obsidian-950 text-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-page">
          <SectionHeading
            id="options-heading"
            eyebrow="ONE DAY TO FIVE"
            title="Find Your Private Rockies Journey"
            intro="Choose a day of discovery or explore further over several days, with your own guide, private vehicle and doorstep pickup. Select optional activities at checkout, and add airport transfers when booking two or more tour days."
            tone="dark"
          />

          <ul className="mt-12 grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3" data-stagger>
            {PRIVATE_OPTIONS.map((opt) => {
              const price = getPrice(opt);
              return (
                <li key={opt.id} className="flex">
                  <PrivateTourCard option={opt} calculatedPrice={price} />
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 4 · Four Benefits */}
      <section aria-label="Why choose a private tour" className="border-b border-obsidian-900/[0.06] bg-white">
        <div className="mx-auto max-w-7xl px-page py-16 sm:py-20">
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4" data-stagger>
            {PRIVATE_BENEFITS.map((b) => (
              <li key={b.title} className="flex flex-col items-center text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-summit-200/80 text-obsidian-900 shadow-sm">
                  <Shield className="h-6 w-6 text-[#78570f]" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-medium text-obsidian-900">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5 · Reviews */}
      {privateReviews.length > 0 && (
        <section aria-labelledby="reviews-heading" className="overflow-hidden py-16 sm:py-20 bg-obsidian-50">
          <div className="mx-auto max-w-7xl px-page">
            <SectionHeading
              id="reviews-heading"
              eyebrow="Guest reviews"
              title="Stories from Our Private Tours"
              intro="Read real experiences from travellers who explored the Canadian Rockies with our private driver-guides."
            />
            <ReviewSlider reviews={privateReviews} />
          </div>
        </section>
      )}

      {/* 6 · FAQ Section */}
      <section aria-labelledby="faq-heading" className="border-t border-obsidian-900/[0.06] bg-white py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-page lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <div data-reveal>
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-ocean-600 font-semibold">GOOD TO KNOW</p>
            <h2 id="faq-heading" className="text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">
              Your Questions, Answered
            </h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-600">
              From doorstep pickup to optional activities and airport transfers, here’s what to know before booking your private Rockies experience.
            </p>
            <Link
              href="/contact-us"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/15 px-6 text-sm font-medium text-obsidian-900 transition-colors hover:bg-obsidian-50"
            >
              Contact Our Team <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <FaqBrowser compact topics={[]} items={PRIVATE_FAQS.map((f) => ({ ...f, topic: "" }))} />
        </div>
      </section>

      {/* 7 · Other Ways to Explore */}
      <section aria-labelledby="others-heading" className="py-16 sm:py-24 bg-obsidian-50 border-t border-obsidian-900/[0.06]">
        <div className="mx-auto max-w-7xl px-page">
          <SectionHeading id="others-heading" eyebrow="KEEP EXPLORING" title="Other Ways to Explore" />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-stagger>
            {PRIVATE_OTHER_WAYS.map((o) => (
              <li key={o.key} className="flex">
                <MediaCard
                  href={o.href}
                  image={o.image}
                  aspect="aspect-[4/3]"
                  title={o.title}
                  description={o.description}
                  cta={o.cta}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 8 · Closing Call to Action */}
      <section aria-labelledby="closing-heading" className="bg-obsidian-950 text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-page py-16 text-center sm:py-24" data-reveal>
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-summit-300 font-medium">
            {PRIVATE_CLOSING.eyebrow}
          </p>
          <h2 id="closing-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-white sm:text-5xl">
            {PRIVATE_CLOSING.title}
          </h2>
          <p className="mt-5 max-w-2xl text-base sm:text-lg font-light leading-relaxed text-white/80">
            {PRIVATE_CLOSING.body}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href={PRIVATE_CLOSING.buttons[0].href}
              className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-8 text-base shadow-lg"
            >
              {PRIVATE_CLOSING.buttons[0].label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={PRIVATE_CLOSING.buttons[1].href}
              className="inline-flex h-12 items-center gap-2 rounded-full px-8 text-base text-white ring-1 ring-white/30 transition-colors hover:bg-white/10"
            >
              {PRIVATE_CLOSING.buttons[1].label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-10 flex flex-col items-center gap-3 text-sm sm:text-base text-white/80 sm:flex-row sm:gap-8">
            <a href={PRIVATE_CLOSING.phone.href} className="inline-flex items-center gap-2 hover:text-white transition-colors">
              <Phone className="h-4 w-4 text-summit-300" aria-hidden="true" />
              Call {PRIVATE_CLOSING.phone.label}
            </a>
            <a href={PRIVATE_CLOSING.email.href} className="inline-flex items-center gap-2 hover:text-white transition-colors">
              <Mail className="h-4 w-4 text-summit-300" aria-hidden="true" />
              Email {PRIVATE_CLOSING.email.label}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Individual Private Tour Card according to the specifications on Page 29 */
function PrivateTourCard({
  option,
  calculatedPrice,
}: {
  option: PrivateTourOption;
  calculatedPrice: number;
}) {
  const isCustom = option.isCustomPartner;

  return (
    <article className="group flex w-full flex-col overflow-hidden rounded-[1.25rem] border border-white/[0.12] bg-[#12161a] transition-all duration-300 hover:-translate-y-1 hover:border-summit-500/40 hover:shadow-2xl">
      {/* Photograph */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-obsidian-900">
        <Image
          src={option.image}
          alt={option.imageAlt}
          fill
          sizes="(max-width: 768px) 94vw, (max-width: 1200px) 46vw, 380px"
          className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
        />
        {isCustom ? (
          <div className="absolute left-3 top-3">
            <span className="bg-summit-200 px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.12em] text-obsidian-900 font-medium rounded-sm">
              PREMIUM CUSTOM JOURNEYS
            </span>
          </div>
        ) : (
          <div className="absolute left-3 top-3">
            <span className={CARD_BADGE}>Private Tour</span>
          </div>
        )}
      </div>

      {/* Card Details Panel */}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-normal tracking-wide text-white group-hover:text-summit-200 transition-colors">
          {option.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{option.description}</p>

        {/* Structured Spec List from Page 29 */}
        <dl className="mt-5 space-y-2.5 border-t border-white/[0.08] pt-4 text-xs text-white/80">
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-white/50">
              <Clock className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
              <span>Duration</span>
            </dt>
            <dd className="font-medium text-right text-white">{option.duration}</dd>
          </div>

          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-white/50">
              <Car className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
              <span>Transport</span>
            </dt>
            <dd className="font-medium text-right text-white">{option.transport}</dd>
          </div>

          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-white/50">
              <Building className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
              <span>Suggested Stay</span>
            </dt>
            <dd className="font-medium text-right text-white">{option.suggestedStay}</dd>
          </div>

          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-white/50">
              <MapPin className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
              <span>Pickup</span>
            </dt>
            <dd className="font-medium text-right text-white">{option.pickup}</dd>
          </div>

          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-white/50">
              <Sparkles className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
              <span>Activities</span>
            </dt>
            <dd className="font-medium text-right text-white">{option.activities}</dd>
          </div>

          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-white/50">
              <Plane className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
              <span>Airport transfers</span>
            </dt>
            <dd className="font-medium text-right text-white">{option.airportTransfers}</dd>
          </div>

          {option.accommodation && (
            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-white/50">
                <FileText className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Accommodation</span>
              </dt>
              <dd className="font-medium text-right text-white text-[11px] max-w-[55%]">
                {option.accommodation}
              </dd>
            </div>
          )}
        </dl>

        {/* Price & CTA at bottom */}
        <div className="mt-auto border-t border-white/[0.08] pt-5">
          <div className="mb-4">
            {isCustom ? (
              <div>
                <p className="text-lg font-light text-white">Personalised quote</p>
                <p className="text-xs text-white/55">Tailored to your itinerary &amp; group size</p>
              </div>
            ) : calculatedPrice <= 0 ? (
              <div>
                <p className="text-lg font-light text-white">Price on request</p>
                <p className="text-xs text-white/55">Per vehicle, confirmed with your dates and group size</p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs text-white/55">From</span>
                  <span className="text-2xl font-light tabular-nums text-white">CAD {money(calculatedPrice)}</span>
                  <span className="text-xs text-white/70">per vehicle</span>
                </div>
                <p className="mt-0.5 text-xs text-white/55">Taxes and required fees included</p>
                {option.priceNote && (
                  <p className="mt-1 text-xs text-summit-300 font-medium">{option.priceNote}</p>
                )}
              </div>
            )}
          </div>

          {isCustom ? (
            <a
              href={option.buttonHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-summit-400 bg-summit-500/10 px-5 text-sm uppercase tracking-[0.14em] text-summit-200 transition-all hover:bg-summit-400 hover:text-obsidian-950 font-medium"
            >
              {option.buttonLabel}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <Link
              href={option.buttonHref}
              className="golden-summit-btn inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm uppercase tracking-[0.14em] font-medium"
            >
              {option.buttonLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
