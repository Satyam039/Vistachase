// Three-Day Rockies Discovery: Private Banff, Yoho & Columbia Icefield Tour
// Detailed page faithfully implemented from the owner's specification (pages 36–40).

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BedDouble,
  Building,
  Calendar,
  Car,
  Check,
  ChevronRight,
  Clock,
  Compass,
  FileText,
  Info,
  MapPin,
  Plane,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";
import { PACKAGE_ITINERARIES } from "@/lib/itineraries";
import { ItineraryDayPanel, ItineraryDayTabList, ItineraryDays } from "@/components/tours/ItineraryDayTabs";
import { PackageTripJsonLd } from "@/components/seo/PackageTripJsonLd";
import { PRIVATE_PACKAGES, THREE_DAY_MAX_GUESTS } from "@/lib/privateTours";
import { PackageBookingSection } from "@/components/booking/PackageBookingSection";
import { BALANCE_DUE_DAYS, DEPOSIT_MIN_DAYS, DEPOSIT_PERCENT } from "@/lib/policy";
import { JsonLd } from "@/components/seo/JsonLd";
import { THREE_DAY_CANCELLATION, THREE_DAY_DURATION, THREE_DAY_FAQS, THREE_DAY_INTRO, THREE_DAY_PRICE, THREE_DAY_PRICING } from "@/lib/threeDayContent";
import { cachePublicData } from "@/lib/api/cachePolicy";

// Rendered once and served from cache, refreshed in the background at most every minute, instead of
// on every request (fix recheck, 10 Nov 2026, N2/R2: 2.7-10 s responses and 5xx under a crawl).
// Seats and prices on this page can be up to a minute old; checkout (/book) always reads them live.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Three-Day Rockies Discovery Private Tour | Vista Chase",
  description:
    "Three private tours: Banff’s lakes and viewpoints, Lake Louise, Moraine Lake & Yoho, and the Icefields Parkway. Private van and driver-guide, dates in any order, 10% savings, summer only.",
  alternates: { canonical: "/three-day-rockies-discovery" },
};

const cad = (n: number) => `CAD $${n.toLocaleString("en-CA")}`;

// Owner's Trello card, 2026-11-24: tour names, any order, 14 guests, Banff/Canmore pickup only.
const SPECS = [
  { label: "Tours", value: "Three private tours on different dates, in any order", icon: Compass },
  { label: "Duration", value: THREE_DAY_DURATION, icon: Clock },
  { label: "Group", value: `Up to ${THREE_DAY_MAX_GUESTS} guests; 12–13 recommended for comfort`, icon: Users },
  { label: "Pickup", value: "Doorstep pickup and drop-off in Banff or Canmore", icon: MapPin },
  { label: "Pricing", value: `${cad(THREE_DAY_PRICE.total)} per private van, 10% savings included`, icon: Car },
];

// Tour-by-tour itinerary: lib/itineraries.ts (shared with the booking PDF).
const ITINERARY_DAYS = PACKAGE_ITINERARIES["three-day-rockies-discovery"];

const INCLUSIONS = [
  "A private van and driver-guide for each of the three tours.",
  "Doorstep pickup and drop-off at your accommodation in Banff or Canmore for each tour.",
  "Transportation between the sightseeing locations.",
  "Required national park admission fees.",
  "Moraine Lake transportation during its operating season, subject to access conditions; no separate shuttle booking is needed.",
  "Taxes and other mandatory fees charged by authorities for the included tour services.",
  `10% package savings: ${cad(THREE_DAY_PRICE.saving)} off the three-tour price.`,
];

const EXCLUSIONS = [
  "Accommodation; guests book directly.",
  "Lunch, other meals and personal purchases.",
  "Optional experiences: Banff Gondola, Lake Minnewanka cruise and the combined Ice Explorer + Skywalk. Tickets are arranged by our team and invoiced separately.",
  "Airport transfers, unless added to your booking.",
  "Gratuities.",
];

const IMPORTANT_INFO = [
  "Your van and driver-guide are exclusive to your group. Third-party attractions may be shared with other visitors.",
  "Up to 14 guests per van; 12–13 is recommended for comfort.",
  THREE_DAY_DURATION,
  "Optional experiences depend on seasonal operation, ticket availability, the day’s schedule and the attraction operator’s terms. Reserved activities may mean other stops are shortened or skipped.",
  "Moraine Lake, Takakkaw Falls and other locations depend on seasonal access.",
  "Moraine Lake: a van transfer may be needed depending on arrangements on the day. Your group’s transportation remains private, and no separate shuttle booking is required.",
  "The Icefields tour reaches the Columbia Icefield but does not visit Jasper town.",
  "Short walks may include hills, steps, uneven surfaces and canyon walkways. Tell us about mobility needs before booking.",
  "Bring comfortable walking shoes, layers and a weatherproof jacket. Pack additional warm clothing for the Columbia Icefield.",
  "Wildlife sightings, clear views and lake colours cannot be guaranteed.",
];

export default function ThreeDayRockiesDiscoveryPage() {
  cachePublicData();

  return (
    <>
      <PageSeoExtras path="/three-day-rockies-discovery" />
      <PackageTripJsonLd
        path="/three-day-rockies-discovery"
        name={PRIVATE_PACKAGES.three.title}
        description={String(metadata.description)}
        image="/media/photos/bow-lake-dock-sunrise.webp"
        days={PRIVATE_PACKAGES.three.days.map((d) => d.title)}
        touristType="Private Group"
        crumbs={[{ name: "Home", path: "/" }, { name: "Multi-day tours", path: "/multi-day-tour-package-for-banff" }, { name: PRIVATE_PACKAGES.three.title }]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: THREE_DAY_FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a.join("\n") } })),
        }}
      />
      <div className="bg-obsidian-50 text-obsidian-900">
        {/* Hero */}
        <section
          data-nav-hero
          aria-label="Three-Day Rockies Discovery"
          className="relative isolate flex min-h-[36rem] items-end overflow-hidden bg-obsidian-950 text-white sm:min-h-[42rem] lg:min-h-[76vh]"
        >
          <div className="absolute inset-0 -z-10">
            <Image
              src="/media/photos/bow-lake-dock-sunrise.webp"
              alt="Three-Day Rockies Discovery private tour"
              fill
              priority
              sizes="100vw"
              className="object-cover"
              data-parallax="10"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ocean-950 via-ocean-950/55 to-ocean-950/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-ocean-950/65 to-transparent" />
          </div>

          <div
            className="mx-auto flex w-full max-w-7xl flex-col items-center px-page pb-14 pt-[calc(var(--vc-nav-open-h,100px)+2rem)] text-center"
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
                <li>
                  <Link href="/private-tours" className="hover:text-white hover:underline">
                    Private tours
                  </Link>
                </li>
                <li aria-hidden="true">
                  <ChevronRight className="h-3.5 w-3.5" />
                </li>
                <li aria-current="page" className="text-white">
                  Three-Day Rockies Discovery
                </li>
              </ol>
            </nav>

            <span className="mb-3 inline-block rounded-full bg-summit-500/20 px-3.5 py-1 text-xs font-medium uppercase tracking-[0.2em] text-summit-300 ring-1 ring-summit-400/30 backdrop-blur-md">
              Private Tours · Three Experiences
            </span>

            <h1 className="text-balance text-[clamp(2.25rem,8vw,4.5rem)] font-light leading-[1.05] tracking-tight text-white motion-safe:animate-[fadeUp_900ms_ease-out]">
              Three-Day Rockies Discovery
            </h1>
            <p className="mt-3 text-base sm:text-xl font-light text-summit-200 tracking-wide">
              Private Banff, Yoho &amp; Columbia Icefield Tour
            </p>
            <p className="mx-auto mt-5 max-w-3xl text-base sm:text-lg font-light leading-relaxed text-slate-100">
              {THREE_DAY_INTRO.headline}
            </p>
          </div>
        </section>

        {/* Specifications Strip */}
        <section aria-label="Tour key specifications" className="border-b border-obsidian-900/[0.08] bg-white py-8">
          <div className="mx-auto max-w-7xl px-page">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" data-stagger>
              {SPECS.slice(0, 5).map((spec) => {
                const Icon = spec.icon;
                return (
                  <div key={spec.label} className="p-3">
                    <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                      <Icon className="h-3.5 w-3.5 text-ocean-600 shrink-0" aria-hidden="true" />
                      <span>{spec.label}</span>
                    </dt>
                    <dd className="mt-1 text-sm font-light text-obsidian-900 leading-snug">{spec.value}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </section>

        {/* Owner, 2026-11-19: Day buttons, then the booking form, then the chosen day's itinerary. */}
        <ItineraryDays days={ITINERARY_DAYS}>
        {/* Main Content Layout */}
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-page pb-6 pt-16 sm:pt-20 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
          {/* Main Column (min-w-0: the tour tabs scroll sideways instead of widening the column on phones) */}
          <div className="min-w-0 space-y-12">
            {/* Overview */}
            <section aria-labelledby="overview-heading" className="space-y-4">
              <h2 id="overview-heading" className="text-2xl sm:text-3xl font-light tracking-tight text-obsidian-900">
                Overview
              </h2>
              <p className="text-lg sm:text-xl font-light text-obsidian-900">{THREE_DAY_INTRO.headline}</p>
              {THREE_DAY_INTRO.paragraphs.map((p) => (
                <p key={p} className="text-base sm:text-lg font-light leading-relaxed text-slate-700">
                  {p}
                </p>
              ))}
              <p className="text-base font-light leading-relaxed text-slate-700">
                <strong className="font-medium text-obsidian-900">Duration:</strong> {THREE_DAY_DURATION}
              </p>
              <div className="border-l-2 border-summit-500 bg-white p-5">
                <h3 className="text-sm uppercase tracking-[0.18em] text-ocean-600">Pricing</h3>
                {THREE_DAY_PRICING.map((p) => (
                  <p key={p} className="mt-2 text-base font-light leading-relaxed text-slate-700">
                    {p}
                  </p>
                ))}
              </div>
            </section>

            {/* Daily Itinerary */}
            <section aria-labelledby="itinerary-heading" className="space-y-8">
              <h2 id="itinerary-heading" className="text-2xl sm:text-3xl font-light tracking-tight text-obsidian-900">
                Detailed Itinerary
              </h2>

              <p className="text-sm text-slate-600">Choose a tour to see its stops. Book the three tours on different available dates, in any order; they don&rsquo;t need to be consecutive.</p>

              <ItineraryDayTabList fit />

            </section>

          </div>

          {/* Sticky Booking Panel */}
          <aside
            className="rounded-none bg-obsidian-950 p-6 text-white sm:p-8 lg:sticky lg:top-[calc(var(--vc-header-h,80px)+24px)] shadow-xl border border-white/10"
            aria-label="Price and booking"
          >
            <div className="border-b border-white/10 pb-5">
              <span className="text-xs uppercase tracking-[0.2em] text-summit-300">Private Journey</span>
              <h3 className="mt-1 text-2xl font-light text-white">Three-Day Rockies Discovery</h3>
              {/* Owner, 2026-11-24: the package price per private van (PACKAGE_DAY_PRICE.summer x 3). */}
              <p className="mt-4 flex flex-wrap items-baseline gap-1.5 text-white">
                <span className="text-3xl font-light tabular-nums">{cad(THREE_DAY_PRICE.total)}</span>
                <span className="text-xs text-white/70">per private van, all three tours</span>
              </p>
              <p className="mt-1 text-xs text-white/60">Taxes, mandatory fees and 10% savings included</p>
              <dl className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-white/60">Savings</dt>
                  <dd className="text-right text-summit-200">
                    {cad(THREE_DAY_PRICE.perDay)} per tour day · Save {cad(THREE_DAY_PRICE.saving)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/60">Group</dt>
                  <dd className="text-right text-white/80">Up to {THREE_DAY_MAX_GUESTS} guests; 12–13 recommended</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/60">Season</dt>
                  <dd className="text-right text-white/80">Summer only: June 1–October 10</dd>
                </div>
              </dl>
            </div>

            <div className="mt-8">
              <a
                href="#book"
                className="golden-summit-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-medium uppercase tracking-[0.14em]"
              >
                Book Now <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <p className="mt-3 text-center text-xs text-white/60">
                Choose a date for each tour, then pay once. {THREE_DAY_CANCELLATION.short}
              </p>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4 text-center">
              <p className="text-xs text-white/70">Need assistance planning?</p>
              <a
                href="tel:+18257349456"
                className="mt-1 inline-flex items-center gap-1.5 text-xs text-summit-300 hover:text-white transition-colors"
              >
                Call +1 (825) 734-9456
              </a>
            </div>
          </aside>
        </div>
        <PackageBookingSection
          config={PRIVATE_PACKAGES.three}
          heading="Book the Three-Day Rockies Discovery"
          intro={`One private van and driver-guide for each tour. Choose a different date for each of the three tours, then pay once, in full or with a ${DEPOSIT_PERCENT}% deposit when every tour is at least ${DEPOSIT_MIN_DAYS} days away.`}
        />
        <div className="mx-auto max-w-7xl px-page py-16 sm:py-20">
          <div className="space-y-12 lg:max-w-[calc((100%-3rem)*1.75/2.75)]">
            <ItineraryDayPanel />

            {/* Itinerary Note */}
            <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 p-5 text-sm text-amber-950 border border-amber-500/20">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              <p>
                <strong className="font-semibold">Itinerary note:</strong> Each tour&rsquo;s itinerary outlines the planned experiences rather than a fixed driving order. Your guide may rearrange stops around pickup location, attraction reservations, weather and road conditions. Optional activities affect the time available at other stops.
              </p>
            </div>

            {/* Inclusions and Exclusions */}
            <section aria-labelledby="inclusions-heading" className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-none bg-white p-6 sm:p-8 border border-obsidian-900/[0.08] shadow-sm">
                <h3 id="inclusions-heading" className="text-xl font-normal text-obsidian-900 flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span>What’s Included</span>
                </h3>
                <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
                  {INCLUSIONS.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-none bg-white p-6 sm:p-8 border border-obsidian-900/[0.08] shadow-sm">
                <h3 className="text-xl font-normal text-obsidian-900 flex items-center gap-2">
                  <X className="h-5 w-5 text-slate-400" />
                  <span>What’s Not Included</span>
                </h3>
                <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
                  {EXCLUSIONS.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <X className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Pickup & Accommodation info */}
            <section className="space-y-6">
              <div className="rounded-none bg-white p-6 sm:p-8 border border-obsidian-900/[0.08]">
                <h3 className="text-xl font-normal text-obsidian-900 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-ocean-600" />
                  <span>Pickup &amp; Drop-Off</span>
                </h3>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                  Tour pickup and drop-off are at your accommodation in Banff or Canmore. Use the same address for all three tours, or a different confirmed Banff or Canmore address for each tour, and give us the accommodation name and full address when booking.
                </p>
                <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                  Your exact pickup time will be confirmed before each tour. For private tours, the schedule is coordinated around your itinerary and any reserved activities.
                </p>
                <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                  Your guide will be assigned the day before your tour, and their contact information will be shared once confirmed. We aim to retain the same guide throughout multi-day bookings, subject to availability and operational requirements.
                </p>
                <p className="mt-2 text-sm text-ocean-700 font-medium">
                  Private airport transfers between Calgary and Banff or Canmore can be added when booking, per one-way transfer: CAD $364 for 1–6 passengers or CAD $850 for 7–14 passengers, including taxes and mandatory fees. A round trip is two transfers. For a Lake Louise transfer, use Special requests or contact our team for confirmation.
                </p>
              </div>

              <div className="rounded-none bg-white p-6 sm:p-8 border border-obsidian-900/[0.08]">
                <h3 className="text-xl font-normal text-obsidian-900 flex items-center gap-2">
                  <BedDouble className="h-5 w-5 text-ocean-600" />
                  <span>Accommodation</span>
                </h3>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                  Book your accommodation directly in Banff or Canmore for the nights around your tour dates. You can stay at the same property throughout, or use a different confirmed Banff or Canmore address for each tour.
                </p>
                <p className="mt-2 text-xs uppercase tracking-wider text-slate-500 font-medium">
                  Accommodation is not included in the tour price.
                </p>
              </div>
            </section>

            {/* Important Guest Information */}
            <section aria-labelledby="important-info-heading" className="rounded-none bg-white p-6 sm:p-8 border border-obsidian-900/[0.08]">
              <h3 id="important-info-heading" className="text-xl font-normal text-obsidian-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-ocean-600" />
                <span>Important Guest Information</span>
              </h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 font-light leading-relaxed">
                {IMPORTANT_INFO.map((info) => (
                  <li key={info} className="flex items-start gap-2">
                    <span className="text-ocean-600 mt-1" aria-hidden="true">•</span>
                    <span>{info}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Cancellation policy (owner, 2026-11-24): one statement, the same everywhere on this page and at checkout. */}
            <section aria-labelledby="cancellation-heading" className="rounded-none bg-white p-6 sm:p-8 border border-obsidian-900/[0.08]">
              <h3 id="cancellation-heading" className="text-xl font-normal text-obsidian-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-ocean-600" />
                <span>Cancellation Policy</span>
              </h3>
              {THREE_DAY_CANCELLATION.paragraphs.map((p) => (
                <p key={p} className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                  {p}
                </p>
              ))}
              <h4 className="mt-5 text-base font-normal text-obsidian-900">Paying with a deposit</h4>
              <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                When every tour is at least {DEPOSIT_MIN_DAYS} days away, you can pay {DEPOSIT_PERCENT}% at booking and the rest {BALANCE_DUE_DAYS} days before your first tour, from your vouchers; we email you a reminder. Otherwise the full amount is paid at booking. The non-refundable portion is {DEPOSIT_PERCENT}% of the total package price, regardless of instalments paid, so a cancellation after paying only the deposit is not refunded.
              </p>
            </section>

            {/* FAQs (owner, 2026-11-24) */}
            <section aria-labelledby="faq-heading" className="space-y-4">
              <h2 id="faq-heading" className="text-2xl sm:text-3xl font-light tracking-tight text-obsidian-900">
                Frequently Asked Questions
              </h2>
              <div className="divide-y divide-obsidian-900/[0.08] border-y border-obsidian-900/[0.08] bg-white">
                {THREE_DAY_FAQS.map((f) => (
                  <details key={f.q} className="group px-5 sm:px-6">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base text-obsidian-900 [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <ChevronRight className="h-4 w-4 shrink-0 text-ocean-600 transition-transform group-open:rotate-90" aria-hidden="true" />
                    </summary>
                    <div className="space-y-2 pb-5 text-sm sm:text-base font-light leading-relaxed text-slate-600">
                      {f.a.map((p) => (
                        <p key={p} className="whitespace-pre-line">
                          {p}
                        </p>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </div>
        </ItineraryDays>
      </div>
    </>
  );
}
