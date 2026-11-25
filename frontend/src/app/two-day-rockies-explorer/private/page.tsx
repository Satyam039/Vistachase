// Private Two-Day Rockies Explorer package page (owner's Trello card, 2026-11-25): introduction,
// seasonal pricing, the two tours named by tour (either order, different dates), activity requests,
// airport transfers, pickup, the package cancellation policy and 16 FAQs. The booking form books both
// private day tours in one payment (backend modules/bookings/package-booking.ts). Copy lives in
// lib/twoDayPrivateContent.ts.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BedDouble, Calendar, Car, Check, ChevronRight, Clock, FileText, Info, MapPin, Plane, Shield, Sparkles, Users, X } from "lucide-react";
import { PackageBookingSection } from "@/components/booking/PackageBookingSection";
import { ItineraryDayPanel, ItineraryDayTabList, ItineraryDays } from "@/components/tours/ItineraryDayTabs";
import { JsonLd } from "@/components/seo/JsonLd";
import { PRIVATE_PACKAGES } from "@/lib/privateTours";
import { BALANCE_DUE_DAYS, DEPOSIT_MIN_DAYS, DEPOSIT_PERCENT } from "@/lib/policy";
import { cachePublicData } from "@/lib/api/cachePolicy";
import {
  TWO_DAY_ACTIVITIES,
  TWO_DAY_CANCELLATION,
  TWO_DAY_DURATION,
  TWO_DAY_FAQS,
  TWO_DAY_GROUP,
  TWO_DAY_INTRO,
  TWO_DAY_ITINERARY,
  TWO_DAY_PICKUP,
  TWO_DAY_PRICE,
  TWO_DAY_PRICE_NOTES,
  TWO_DAY_PRICE_TABLE,
  TWO_DAY_SAVINGS,
  TWO_DAY_TRANSFER_NOTES,
  TWO_DAY_TRANSFER_TABLE,
} from "@/lib/twoDayPrivateContent";

// Rendered once and served from cache, refreshed in the background at most every minute.
// Dates on this page can be up to a minute old; the server checks both days again before payment.
export const revalidate = 60;

export const metadata: Metadata = {
  // Kept noindex, follow (fix recheck, 10 Nov 2026, R3): indexing this page is a separate SEO decision.
  robots: { index: false, follow: true },
  title: "Private Two-Day Rockies Explorer | Vista Chase",
  description:
    "Two private tours, Banff & Yoho Discovery and Columbia Icefield Adventure, in either order on dates that fit your stay. Private van and driver-guide, up to 14 guests, 10% off summer tour days.",
  alternates: { canonical: "/two-day-rockies-explorer/private" },
};

const cad = (n: number) => `CAD $${n.toLocaleString("en-CA")}`;

const SPECS = [
  { label: "Tours", value: "Two private tours on different dates, in either order", icon: Calendar },
  { label: "Duration", value: "Approximately 10–12 hours each", icon: Clock },
  { label: "Group", value: "Up to 14 guests; 12–13 recommended for comfort", icon: Users },
  { label: "Pickup", value: "Doorstep pickup and drop-off in Banff or Canmore", icon: MapPin },
  { label: "Pricing", value: `From ${cad(TWO_DAY_PRICE.bothWinter)} per private van`, icon: Car },
];

const INCLUSIONS = [
  "A private van and driver-guide for your group on each tour day.",
  "Doorstep pickup and drop-off at your accommodation in Banff or Canmore for each tour.",
  "Transportation between the sightseeing locations.",
  "Required national park admission fees.",
  "Moraine Lake transportation during its operating season, subject to access conditions; no separate shuttle booking is needed.",
  "Taxes and other mandatory fees charged by authorities for the included tour services.",
  "10% savings on summer tour days (June 1–October 10), already included in the prices shown.",
];

const EXCLUSIONS = [
  "Accommodation; guests book directly in Banff or Canmore.",
  "Lunch, other meals and personal purchases.",
  "Optional Lake Minnewanka cruise and Ice Explorer + Skywalk tickets, arranged by our team and invoiced separately.",
  "Airport transfers, unless added to your booking.",
  "Gratuities.",
];

const IMPORTANT_INFO = [
  "Your van and driver-guide are exclusive to your group each day. Optional attractions may be shared with other visitors.",
  TWO_DAY_GROUP,
  TWO_DAY_DURATION,
  "Discuss stops and pacing with your guide. Longer visits may mean shortening or skipping other stops within the scheduled day. On the Icefields day, booked attraction times take priority.",
  "Your guide may differ between the two tours, and so may your van.",
  "Moraine Lake, Lower Spiral Tunnels Viewpoint and the Columbia Icefield experience are summer stops (June 1–October 10). In winter, Bow Lake and Peyto Lake and Abraham Lake take their place.",
  "Short walks may include hills, steps, uneven surfaces and canyon walkways. Tell us about mobility needs before booking.",
  "Bring comfortable walking shoes, layers and a weatherproof jacket, with extra warm clothing for the Icefields Parkway.",
  "Wildlife sightings, clear views and lake colours cannot be guaranteed.",
];

export default function PrivateTwoDayPage() {
  cachePublicData();
  const config = PRIVATE_PACKAGES.two;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: TWO_DAY_FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a.join("\n") } })),
        }}
      />
      <div className="bg-obsidian-50 text-obsidian-900">
        {/* Hero */}
        <section
          data-nav-hero
          aria-label="Private Two-Day Rockies Explorer"
          className="relative isolate flex min-h-[34rem] items-end overflow-hidden bg-obsidian-950 text-white sm:min-h-[40rem] lg:min-h-[72vh]"
        >
          <div className="absolute inset-0 -z-10">
            <Image src="/media/photos/moraine-lake-classic.webp" alt="Moraine Lake in the Valley of the Ten Peaks" fill priority sizes="100vw" className="object-cover" data-parallax="10" />
            <div className="absolute inset-0 bg-gradient-to-t from-ocean-950 via-ocean-950/55 to-ocean-950/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-ocean-950/65 to-transparent" />
          </div>
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-page pb-14 pt-[calc(var(--vc-nav-open-h,100px)+2rem)] text-center" data-scroll-fade>
            <nav aria-label="Breadcrumb" className="mb-5">
              <ol className="flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-200">
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
                  Private Two-Day Rockies Explorer
                </li>
              </ol>
            </nav>
            <span className="mb-3 inline-block rounded-full bg-summit-500/20 px-3.5 py-1 text-xs font-medium uppercase tracking-[0.2em] text-summit-300 ring-1 ring-summit-400/30 backdrop-blur-md">
              Private Tours · Two Experiences
            </span>
            <h1 className="text-balance text-[clamp(2.25rem,8vw,4.5rem)] font-light leading-[1.05] tracking-tight text-white">Private Two-Day Rockies Explorer</h1>
            <p className="mt-3 text-base font-light tracking-wide text-summit-200 sm:text-xl">Banff &amp; Yoho Discovery · Columbia Icefield Adventure</p>
            <p className="mx-auto mt-5 max-w-3xl text-base font-light leading-relaxed text-slate-100 sm:text-lg">{TWO_DAY_INTRO.headline}</p>
          </div>
        </section>

        {/* Key facts */}
        <section aria-label="Tour key specifications" className="border-b border-obsidian-900/[0.08] bg-white py-8">
          <div className="mx-auto max-w-7xl px-page">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" data-stagger>
              {SPECS.map((spec) => {
                const Icon = spec.icon;
                return (
                  <div key={spec.label} className="p-3">
                    <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-ocean-600" aria-hidden="true" />
                      <span>{spec.label}</span>
                    </dt>
                    <dd className="mt-1 text-sm font-light leading-snug text-obsidian-900">{spec.value}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </section>

        <ItineraryDays days={TWO_DAY_ITINERARY} idPrefix="two-day">
          <div className="mx-auto grid max-w-7xl items-start gap-12 px-page pb-6 pt-16 sm:pt-20 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-12">
              {/* Overview */}
              <section aria-labelledby="overview-heading" className="space-y-4">
                <h2 id="overview-heading" className="text-2xl font-light tracking-tight text-obsidian-900 sm:text-3xl">
                  Overview
                </h2>
                <p className="text-lg font-light text-obsidian-900 sm:text-xl">{TWO_DAY_INTRO.headline}</p>
                {TWO_DAY_INTRO.paragraphs.map((p) => (
                  <p key={p} className="text-base font-light leading-relaxed text-slate-700 sm:text-lg">
                    {p}
                  </p>
                ))}

                {/* Seasonal pricing (owner, 2026-11-25) */}
                <div className="border-l-2 border-summit-500 bg-white p-5">
                  <h3 className="text-sm uppercase tracking-[0.18em] text-ocean-600">Pricing</h3>
                  <p className="mt-2 text-base font-light leading-relaxed text-slate-700">{TWO_DAY_SAVINGS}</p>
                  <table className="mt-4 w-full text-left text-sm">
                    <caption className="sr-only">Package price per private van by season of the tour dates</caption>
                    <thead>
                      <tr className="border-b border-obsidian-900/10 text-xs uppercase tracking-wider text-slate-500">
                        <th scope="col" className="py-2 pr-4 font-medium">
                          Selected tour dates
                        </th>
                        <th scope="col" className="py-2 text-right font-medium">
                          Total per van
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {TWO_DAY_PRICE_TABLE.map((row) => (
                        <tr key={row.dates} className="border-b border-obsidian-900/[0.06]">
                          <td className="py-2.5 pr-4 text-obsidian-900">{row.dates}</td>
                          <td className="py-2.5 text-right tabular-nums text-obsidian-900">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ul className="mt-4 space-y-1.5 text-sm font-light leading-relaxed text-slate-700">
                    {TWO_DAY_PRICE_NOTES.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* Itinerary tabs */}
              <section aria-labelledby="itinerary-heading" className="space-y-6">
                <h2 id="itinerary-heading" className="text-2xl font-light tracking-tight text-obsidian-900 sm:text-3xl">
                  Your two tours
                </h2>
                <p className="text-sm text-slate-600">
                  Choose a tour to see its stops. Book them on different available dates, in either order; they don&rsquo;t need to be consecutive.
                </p>
                <ItineraryDayTabList fit />
              </section>
            </div>

            {/* Price panel */}
            <aside
              className="rounded-none border border-white/10 bg-obsidian-950 p-6 text-white shadow-xl sm:p-8 lg:sticky lg:top-[calc(var(--vc-header-h,80px)+24px)]"
              aria-label="Price and booking"
            >
              <div className="border-b border-white/10 pb-5">
                <span className="text-xs uppercase tracking-[0.2em] text-summit-300">Private Journey</span>
                <h3 className="mt-1 text-2xl font-light text-white">Two-Day Rockies Explorer</h3>
                <p className="mt-4 flex flex-wrap items-baseline gap-1.5 text-white">
                  <span className="text-xs text-white/70">From</span>
                  <span className="text-3xl font-light tabular-nums">{cad(TWO_DAY_PRICE.bothWinter)}</span>
                  <span className="text-xs text-white/70">per private van, both tours</span>
                </p>
                <p className="mt-1 text-xs text-white/60">Taxes and mandatory fees included</p>
                <dl className="mt-3 space-y-1 text-xs">
                  {TWO_DAY_PRICE_TABLE.map((row) => (
                    <div key={row.dates} className="flex justify-between gap-3">
                      <dt className="text-white/60">{row.dates}</dt>
                      <dd className="text-right tabular-nums text-white/85">{row.total}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/60">Savings</dt>
                    <dd className="text-right text-summit-200">10% on summer tour days only</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/60">Group</dt>
                    <dd className="text-right text-white/80">Up to 14 guests; 12–13 recommended</dd>
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
                <p className="mt-3 text-center text-xs text-white/60">Choose a date for each tour, then pay once. {TWO_DAY_CANCELLATION.short}</p>
              </div>
              <div className="mt-6 border-t border-white/10 pt-4 text-center">
                <p className="text-xs text-white/70">Need assistance planning?</p>
                <a href="tel:+18257349456" className="mt-1 inline-flex items-center gap-1.5 text-xs text-summit-300 transition-colors hover:text-white">
                  Call +1 (825) 734-9456
                </a>
              </div>
            </aside>
          </div>

          <PackageBookingSection
            config={config}
            heading="Book the Private Two-Day Rockies Explorer"
            intro={`One private van and driver-guide for your group on each tour. Choose an available date for each tour, in either order, then pay once: in full, or with a ${DEPOSIT_PERCENT}% deposit when both tours are at least ${DEPOSIT_MIN_DAYS} days away.`}
          />

          <div className="mx-auto max-w-7xl px-page py-16 sm:py-20">
            <div className="space-y-12 lg:max-w-[calc((100%-3rem)*1.75/2.75)]">
              <ItineraryDayPanel />

              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-950">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                <p>
                  <strong className="font-semibold">Itinerary note:</strong> Each itinerary outlines the planned experiences rather than a fixed driving order. Your guide manages stops and pacing around your pickup, weather, road conditions and, on the Icefields day, your booked attraction times, which take priority.
                </p>
              </div>

              {/* Optional activities */}
              <section aria-labelledby="activities-heading" className="rounded-none border border-obsidian-900/[0.08] bg-white p-6 sm:p-8">
                <h3 id="activities-heading" className="flex items-center gap-2 text-xl font-normal text-obsidian-900">
                  <Sparkles className="h-5 w-5 text-ocean-600" aria-hidden="true" />
                  <span>Optional Activities</span>
                </h3>
                <dl className="mt-4 space-y-3">
                  {TWO_DAY_ACTIVITIES.items.map((a) => (
                    <div key={a.name}>
                      <dt className="text-xs uppercase tracking-wider text-slate-500">{a.day}</dt>
                      <dd className="mt-0.5 text-sm text-slate-700 sm:text-base">
                        <span className="text-obsidian-900">{a.name}</span> — {a.note}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm font-light leading-relaxed text-slate-600 sm:text-base">{TWO_DAY_ACTIVITIES.intro} We collect the number of participating guests for each request.</p>
              </section>

              {/* Inclusions and exclusions */}
              <section aria-labelledby="inclusions-heading" className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-none border border-obsidian-900/[0.08] bg-white p-6 shadow-sm sm:p-8">
                  <h3 id="inclusions-heading" className="flex items-center gap-2 text-xl font-normal text-obsidian-900">
                    <Check className="h-5 w-5 text-green-600" aria-hidden="true" />
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
                <div className="rounded-none border border-obsidian-900/[0.08] bg-white p-6 shadow-sm sm:p-8">
                  <h3 className="flex items-center gap-2 text-xl font-normal text-obsidian-900">
                    <X className="h-5 w-5 text-slate-500" aria-hidden="true" />
                    <span>What’s Not Included</span>
                  </h3>
                  <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
                    {EXCLUSIONS.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <X className="mt-1 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* Pickup, transfers, accommodation */}
              <section className="space-y-6">
                <div className="rounded-none border border-obsidian-900/[0.08] bg-white p-6 sm:p-8">
                  <h3 className="flex items-center gap-2 text-xl font-normal text-obsidian-900">
                    <MapPin className="h-5 w-5 text-ocean-600" aria-hidden="true" />
                    <span>Pickup &amp; Drop-Off</span>
                  </h3>
                  <p className="mt-3 text-sm font-light leading-relaxed text-slate-600 sm:text-base">{TWO_DAY_PICKUP}</p>
                </div>

                <div className="rounded-none border border-obsidian-900/[0.08] bg-white p-6 sm:p-8">
                  <h3 className="flex items-center gap-2 text-xl font-normal text-obsidian-900">
                    <Plane className="h-5 w-5 text-ocean-600" aria-hidden="true" />
                    <span>Airport Transfers</span>
                  </h3>
                  <p className="mt-3 text-sm font-light leading-relaxed text-slate-600 sm:text-base">One-way prices, including taxes and mandatory fees:</p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[20rem] text-left text-sm">
                      <caption className="sr-only">Private airport transfer prices per one-way transfer</caption>
                      <thead>
                        <tr className="border-b border-obsidian-900/10 text-xs uppercase tracking-wider text-slate-500">
                          <th scope="col" className="py-2 pr-4 font-medium">
                            Route
                          </th>
                          <th scope="col" className="py-2 pr-4 text-right font-medium">
                            1–6 passengers
                          </th>
                          <th scope="col" className="py-2 text-right font-medium">
                            7–14 passengers
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {TWO_DAY_TRANSFER_TABLE.map((row) => (
                          <tr key={row.route} className="border-b border-obsidian-900/[0.06]">
                            <td className="py-2.5 pr-4 text-obsidian-900">{row.route}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums text-obsidian-900">{row.small}</td>
                            <td className="py-2.5 text-right tabular-nums text-obsidian-900">{row.large}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {TWO_DAY_TRANSFER_NOTES.map((n) => (
                    <p key={n} className="mt-3 text-sm font-light leading-relaxed text-slate-600 sm:text-base">
                      {n}
                    </p>
                  ))}
                </div>

                <div className="rounded-none border border-obsidian-900/[0.08] bg-white p-6 sm:p-8">
                  <h3 className="flex items-center gap-2 text-xl font-normal text-obsidian-900">
                    <BedDouble className="h-5 w-5 text-ocean-600" aria-hidden="true" />
                    <span>Accommodation</span>
                  </h3>
                  <p className="mt-3 text-sm font-light leading-relaxed text-slate-600 sm:text-base">
                    Book your accommodation directly in Banff or Canmore. You can stay at the same property for both tours, or use a different confirmed Banff or Canmore address for each tour.
                  </p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500">Accommodation is not included in the tour price.</p>
                </div>
              </section>

              {/* Important information */}
              <section aria-labelledby="important-info-heading" className="rounded-none border border-obsidian-900/[0.08] bg-white p-6 sm:p-8">
                <h3 id="important-info-heading" className="flex items-center gap-2 text-xl font-normal text-obsidian-900">
                  <Shield className="h-5 w-5 text-ocean-600" aria-hidden="true" />
                  <span>Important Guest Information</span>
                </h3>
                <ul className="mt-4 space-y-2 text-sm font-light leading-relaxed text-slate-600">
                  {IMPORTANT_INFO.map((info) => (
                    <li key={info} className="flex items-start gap-2">
                      <span className="mt-1 text-ocean-600" aria-hidden="true">
                        •
                      </span>
                      <span>{info}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Cancellation (owner, 2026-11-25) */}
              <section aria-labelledby="cancellation-heading" className="rounded-none border border-obsidian-900/[0.08] bg-white p-6 sm:p-8">
                <h3 id="cancellation-heading" className="flex items-center gap-2 text-xl font-normal text-obsidian-900">
                  <FileText className="h-5 w-5 text-ocean-600" aria-hidden="true" />
                  <span>Package Cancellation</span>
                </h3>
                {TWO_DAY_CANCELLATION.paragraphs.map((p) => (
                  <p key={p} className="mt-3 text-sm font-light leading-relaxed text-slate-600 sm:text-base">
                    {p}
                  </p>
                ))}
                <h4 className="mt-5 text-base font-normal text-obsidian-900">Paying with a deposit</h4>
                <p className="mt-2 text-sm font-light leading-relaxed text-slate-600 sm:text-base">
                  When both tours are at least {DEPOSIT_MIN_DAYS} days away, you can pay {DEPOSIT_PERCENT}% at booking and the rest {BALANCE_DUE_DAYS} days before your first tour, from your vouchers; we email you a reminder. Otherwise the full amount is paid at booking. The non-refundable portion is {DEPOSIT_PERCENT}% of the total package price, regardless of instalments paid, so a cancellation after paying only the deposit is not refunded.
                </p>
              </section>

              {/* FAQs (owner, 2026-11-25) */}
              <section aria-labelledby="faq-heading" className="space-y-4">
                <h2 id="faq-heading" className="text-2xl font-light tracking-tight text-obsidian-900 sm:text-3xl">
                  Frequently Asked Questions
                </h2>
                <div className="divide-y divide-obsidian-900/[0.08] border-y border-obsidian-900/[0.08] bg-white">
                  {TWO_DAY_FAQS.map((f) => (
                    <details key={f.q} className="group px-5 sm:px-6">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base text-obsidian-900 [&::-webkit-details-marker]:hidden">
                        {f.q}
                        <ChevronRight className="h-4 w-4 shrink-0 text-ocean-600 transition-transform group-open:rotate-90" aria-hidden="true" />
                      </summary>
                      <div className="space-y-2 pb-5 text-sm font-light leading-relaxed text-slate-600 sm:text-base">
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
