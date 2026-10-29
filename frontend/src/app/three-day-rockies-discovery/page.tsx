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
import { PACKAGE_DAY_PRICE, PRIVATE_MAX_GUESTS } from "@/lib/privateTours";

export const metadata: Metadata = {
  title: "Three-Day Rockies Discovery | Private Banff, Yoho & Columbia Icefield Tour | Vista Chase",
  description:
    "Three remarkable days exploring mountain towns, iconic lakes, waterfalls and glacier landscapes with your own driver-guide, private vehicle and doorstep pickup. Accommodation booked directly by guests.",
  alternates: { canonical: "/three-day-rockies-discovery" },
};

const SPECS = [
  { label: "Duration", value: "Three full-day tours", icon: Clock },
  { label: "Experience", value: "Private, exclusively for your group", icon: Users },
  { label: "Pickup", value: "Your accommodation in Banff, Canmore or Lake Louise", icon: MapPin },
  { label: "Pricing", value: "Per vehicle, according to your selected vehicle capacity", icon: Car },
  { label: "Park admission", value: "Included", icon: Check },
  { label: "Activities", value: "Optional extras selected at checkout", icon: Sparkles },
  { label: "Accommodation", value: "Booked directly by guests", icon: BedDouble },
  { label: "Airport transfers", value: "Available to add", icon: Plane },
  { label: "Availability", value: "Seasonal; available dates shown when booking", icon: Calendar },
];

const ITINERARY_DAYS = [
  {
    dayNumber: 1,
    title: "Day 1 — Banff’s Lakes, Viewpoints & Mountain Scenery",
    stops: [
      {
        name: "Bow Falls",
        desc: "See the Bow River tumble over a broad cascade, framed by forest and mountain scenery.",
      },
      {
        name: "Surprise Corner",
        desc: "Enjoy a classic viewpoint overlooking the Fairmont Banff Springs hotel above the Bow River.",
      },
      {
        name: "Hoodoos Trail Viewpoint",
        desc: "Discover distinctive rock formations and views across the Bow Valley. Enjoy a short walk suited to your group’s interests and ability.",
      },
      {
        name: "Lake Minnewanka",
        desc: "Take in the wide waters and mountain backdrop of one of Banff’s best-known lakes.",
      },
      {
        name: "Two Jack Lake",
        desc: "Pause beside a peaceful lake with beautiful reflections and views toward Mount Rundle.",
      },
      {
        name: "Cascade Ponds",
        desc: "Enjoy a gentle scenic stop among ponds, footbridges and surrounding peaks.",
      },
      {
        name: "Johnston Canyon",
        desc: "Follow the canyon’s paths and elevated walkways toward the Lower Falls, conditions permitting. Walking can be adjusted to your group’s comfort.",
      },
      {
        name: "Banff Gondola — Optional Add-On",
        desc: "Choose a gondola ride up Sulphur Mountain for panoramic views over Banff and its surrounding ranges. Admission costs extra.",
        isOptional: true,
      },
      {
        name: "Lunch in Banff Town",
        desc: "Enjoy a lunch break with a choice of cafés and restaurants. Meals are purchased separately.",
      },
    ],
    closing: "Return to your accommodation after the day’s sightseeing.",
  },
  {
    dayNumber: 2,
    title: "Day 2 — Lake Louise, Moraine Lake & Yoho",
    stops: [
      {
        name: "Moraine Lake — Seasonal Access",
        desc: "Discover the vivid waters and dramatic peaks of the Valley of the Ten Peaks. Enjoy lakeside views and photo opportunities, with transportation arranged as part of your tour.",
      },
      {
        name: "Lake Louise",
        desc: "Spend time beside the famous lake, framed by mountain slopes and the distant Victoria Glacier.",
      },
      {
        name: "Emerald Lake",
        desc: "Explore the shoreline of this beautiful Yoho lake, surrounded by forest and towering mountains.",
      },
      {
        name: "Natural Bridge",
        desc: "See the Kicking Horse River rush through a striking rock formation shaped by moving water.",
      },
      {
        name: "Takakkaw Falls — Seasonal Access",
        desc: "Travel into Yoho Valley to admire a dramatic waterfall descending from high above the valley floor.",
      },
      {
        name: "Spiral Tunnels Viewpoint — When Accessible",
        desc: "Learn how railway engineers tackled the steep mountain terrain. A passing train may offer a chance to see the tunnels in action, although train sightings are not guaranteed.",
      },
      {
        name: "Bow Valley Parkway — Scenic Drive",
        desc: "Enjoy forest, mountain and valley scenery along this quieter route, where road access permits.",
      },
      {
        name: "Lunch in Lake Louise Village",
        desc: "Stop in the village to purchase lunch before continuing your sightseeing.",
      },
    ],
    closing: "Return to your accommodation after the tour.",
  },
  {
    dayNumber: 3,
    title: "Day 3 — Icefields Parkway & Columbia Icefield",
    stops: [
      {
        name: "Bow Lake",
        desc: "Pause beside a glacier-fed lake surrounded by dramatic peaks and alpine scenery.",
      },
      {
        name: "Peyto Lake",
        desc: "Take a short uphill walk to the viewpoint overlooking Peyto Lake and its distinctive outline.",
      },
      {
        name: "Crowfoot Glacier Lookout",
        desc: "View the glacier from a roadside lookout and hear how the landscape has changed over time.",
      },
      {
        name: "Waterfowl Lakes",
        desc: "Enjoy a scenic photo stop overlooking mountain-framed waters along the parkway.",
      },
      {
        name: "Big Bend Viewpoint",
        desc: "Take in sweeping views of the valley and the famous curve of the Icefields Parkway.",
      },
      {
        name: "Athabasca Glacier & Columbia Icefield Area",
        desc: "Discover the scale of the glacier landscape and learn about the icefield that shapes this region. Travelling onto the glacier requires the optional Ice Explorer experience.",
      },
      {
        name: "Ice Explorer — Optional Add-On",
        desc: "Travel aboard a specialised vehicle onto the Athabasca Glacier, with an opportunity to step onto the ice under the attraction operator’s supervision. Admission costs extra.",
        isOptional: true,
      },
      {
        name: "Columbia Icefield Skywalk — Optional Add-On",
        desc: "Experience a glass-floored walkway overlooking the Sunwapta Valley. Admission costs extra.",
        isOptional: true,
      },
      {
        name: "Lunch at the Columbia Icefield Centre",
        desc: "Purchase lunch at the centre during your visit.",
      },
    ],
    closing: "Return to your accommodation in Banff, Canmore or Lake Louise.",
  },
];

const INCLUSIONS = [
  "Private vehicle for your group during the three tour days.",
  "A dedicated driver-guide.",
  "Doorstep pickup and drop-off at your accommodation in Banff, Canmore or Lake Louise.",
  "Transportation between the sightseeing locations.",
  "Required national park admission fees.",
  "Moraine Lake access arrangements when included in the operating itinerary.",
  "Taxes and other mandatory fees charged by authorities for the included tour services.",
];

const EXCLUSIONS = [
  "Accommodation; guests book directly.",
  "Lunch, other meals and personal purchases.",
  "Third-party activities, including gondola rides, lake cruises, canoe rentals, Ice Explorer and Skywalk admission, unless selected and paid for.",
  "Airport transfers unless separately arranged and added to your booking.",
  "Gratuities.",
];

const IMPORTANT_INFO = [
  "This is a private experience for your booked group. Vehicle capacity depends on the option selected.",
  "Third-party attractions may be shared with other visitors.",
  "Optional activities are subject to seasonal operation, ticket availability and the attraction operator’s terms.",
  "Moraine Lake, Takakkaw Falls and other locations depend on seasonal access.",
  "Short walks may include hills, steps, uneven surfaces and canyon walkways. Tell us about mobility needs before booking.",
  "Bring comfortable walking shoes, layers and a weatherproof jacket. Pack additional warm clothing for the Columbia Icefield.",
  "Wildlife sightings, clear views and lake colours cannot be guaranteed.",
  "Moraine Lake transportation may involve a vehicle transfer, depending on your booked vehicle option. Your arrangements will be explained before booking.",
];

export default function ThreeDayRockiesDiscoveryPage() {
  const requestHref = "/contact-us?package=three-day-rockies-discovery";

  return (
    <>
      <PageSeoExtras path="/three-day-rockies-discovery" />
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
              Private Tour · 3 Days
            </span>

            <h1 className="text-balance text-[clamp(2.25rem,8vw,4.5rem)] font-light leading-[1.05] tracking-tight text-white motion-safe:animate-[fadeUp_900ms_ease-out]">
              Three-Day Rockies Discovery
            </h1>
            <p className="mt-3 text-base sm:text-xl font-light text-summit-200 tracking-wide">
              Private Banff, Yoho &amp; Columbia Icefield Tour
            </p>
            <p className="mx-auto mt-5 max-w-3xl text-base sm:text-lg font-light leading-relaxed text-slate-100">
              Three remarkable days exploring mountain towns, iconic lakes, waterfalls and glacier landscapes—with your own driver-guide, private vehicle and doorstep pickup.
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

        {/* Main Content Layout */}
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-page py-16 sm:py-20 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
          {/* Main Column */}
          <div className="space-y-12">
            {/* Overview */}
            <section aria-labelledby="overview-heading" className="space-y-4">
              <h2 id="overview-heading" className="text-2xl sm:text-3xl font-light tracking-tight text-obsidian-900">
                Overview
              </h2>
              <p className="text-base sm:text-lg font-light leading-relaxed text-slate-700">
                Discover the Canadian Rockies across three thoughtfully planned days. Explore Banff’s viewpoints and lakes, visit Lake Louise and Moraine Lake, discover the waterfalls and scenery of Yoho, then follow the Icefields Parkway to the Columbia Icefield.
              </p>
              <p className="text-base sm:text-lg font-light leading-relaxed text-slate-700">
                Your dedicated driver-guide takes care of the driving and daily route, leaving you free to enjoy the scenery. Choose optional experiences at checkout, including the Banff Gondola, Ice Explorer and Columbia Icefield Skywalk.
              </p>
              <p className="text-base sm:text-lg font-light leading-relaxed text-slate-700">
                Stay in your own chosen accommodation in Banff, Canmore or Lake Louise, with doorstep pickup each tour day. Airport transfers can also be arranged, making it possible to enjoy your visit without renting a car.
              </p>
            </section>

            {/* Daily Itinerary */}
            <section aria-labelledby="itinerary-heading" className="space-y-8">
              <h2 id="itinerary-heading" className="text-2xl sm:text-3xl font-light tracking-tight text-obsidian-900">
                Detailed Itinerary
              </h2>

              <div className="space-y-8">
                {ITINERARY_DAYS.map((day) => (
                  <article
                    key={day.dayNumber}
                    className="overflow-hidden rounded-none border border-obsidian-900/[0.08] bg-white p-6 sm:p-8 shadow-sm"
                  >
                    <div className="border-b border-obsidian-900/[0.08] pb-4">
                      <span className="text-xs uppercase tracking-[0.24em] font-semibold text-ocean-600">
                        Day {day.dayNumber}
                      </span>
                      <h3 className="mt-1 text-xl sm:text-2xl font-normal text-obsidian-900">
                        {day.title}
                      </h3>
                    </div>

                    <ul className="mt-6 space-y-4 divide-y divide-obsidian-900/[0.05]">
                      {day.stops.map((stop) => (
                        <li key={stop.name} className="pt-4 first:pt-0">
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-1 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
                            <div>
                              <h4 className="text-base font-medium text-obsidian-900">
                                {stop.name}
                                {stop.isOptional && (
                                  <span className="ml-2 inline-block rounded bg-summit-500/15 px-2 py-0.5 text-xs text-[#78570f] font-normal">
                                    Optional Add-On
                                  </span>
                                )}
                              </h4>
                              <p className="mt-1 text-sm font-light leading-relaxed text-slate-600">
                                {stop.desc}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-6 pt-4 border-t border-obsidian-900/[0.06] text-xs sm:text-sm text-slate-500 italic">
                      {day.closing}
                    </p>
                  </article>
                ))}
              </div>

              {/* Itinerary Note */}
              <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 p-5 text-sm text-amber-950 border border-amber-500/20">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                <p>
                  <strong className="font-semibold">Itinerary note:</strong> The sequence above outlines the planned experiences rather than a fixed driving order. Your guide may rearrange stops around pickup location, attraction reservations, weather and road conditions. Optional activities affect the time available at other stops.
                </p>
              </div>
            </section>

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
                  Doorstep pickup is available from your booked accommodation in Banff, Canmore or Lake Louise. Please provide your accommodation name and full address when booking.
                </p>
                <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                  Your exact pickup time will be confirmed before each tour day. For private tours, the daily schedule is coordinated around your itinerary and any reserved activities.
                </p>
                <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                  Your guide will be assigned the day before your tour, and their contact information will be shared once confirmed. We aim to retain the same guide throughout multi-day bookings, subject to availability and operational requirements.
                </p>
                <p className="mt-2 text-sm text-ocean-700 font-medium">
                  Airport transfers are available with this package. Share your flight details when arranging the transfer.
                </p>
              </div>

              <div className="rounded-none bg-white p-6 sm:p-8 border border-obsidian-900/[0.08]">
                <h3 className="text-xl font-normal text-obsidian-900 flex items-center gap-2">
                  <BedDouble className="h-5 w-5 text-ocean-600" />
                  <span>Accommodation</span>
                </h3>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                  Book your accommodation directly in Banff, Canmore or Lake Louise for the nights needed around your tour dates. You can remain at the same property throughout the three-day experience.
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
          </div>

          {/* Sticky Booking / Request Sidebar */}
          <aside
            className="rounded-none bg-obsidian-950 p-6 text-white sm:p-8 lg:sticky lg:top-[calc(var(--vc-header-h,80px)+24px)] shadow-xl border border-white/10"
            aria-label="Price and booking request"
          >
            <div className="border-b border-white/10 pb-5">
              <span className="text-xs uppercase tracking-[0.2em] text-summit-300">Private Journey</span>
              <h3 className="mt-1 text-2xl font-light text-white">Three-Day Rockies Discovery</h3>
              {/* The doc's package price (lib/privateTours.ts): per day per vehicle, summer season only. */}
              <p className="mt-4 flex items-baseline gap-1.5 text-white">
                <span className="text-xs text-white/60">From</span>
                <span className="text-3xl font-light tabular-nums">CAD ${(PACKAGE_DAY_PRICE.summer * 3).toLocaleString("en-CA")}</span>
                <span className="text-xs text-white/70">per vehicle</span>
              </p>
              <p className="mt-1 text-xs text-white/60">
                CAD ${PACKAGE_DAY_PRICE.summer.toLocaleString("en-CA")} per day, up to {PRIVATE_MAX_GUESTS} guests. Available June 1 to October 10 only. Add
                optional activities and airport transfers when you request your dates.
              </p>
            </div>

            <ul className="mt-6 space-y-3.5 text-sm text-white/85">
              <li className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-summit-300 shrink-0" aria-hidden="true" />
                <span>3 full-day private tours</span>
              </li>
              <li className="flex items-center gap-3">
                <Users className="h-4 w-4 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Private vehicle for up to 14 guests</span>
              </li>
              <li className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Doorstep pickup in Banff, Canmore or Lake Louise</span>
              </li>
              <li className="flex items-center gap-3">
                <Plane className="h-4 w-4 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Airport transfers available to add</span>
              </li>
              <li className="flex items-center gap-3">
                <BedDouble className="h-4 w-4 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Book accommodation separately</span>
              </li>
            </ul>

            <div className="mt-8">
              <Link
                href={requestHref}
                className="golden-summit-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-medium uppercase tracking-[0.14em]"
              >
                Request This Package <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <p className="mt-3 text-center text-xs text-white/60">
                Tell us your travel dates and group size. We’ll reply with availability and a tailored itinerary.
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
      </div>
    </>
  );
}
