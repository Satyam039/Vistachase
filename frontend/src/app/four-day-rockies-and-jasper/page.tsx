// Four-Day Rockies & Jasper: Private Banff, Yoho, Columbia Icefield & Jasper Tour
// Detailed page faithfully implemented from the owner's specification (pages 41–46).

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BedDouble,
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

export const metadata: Metadata = {
  title: "Four-Day Rockies & Jasper | Private Banff, Yoho, Columbia Icefield & Jasper Tour | Vista Chase",
  description:
    "Explore further across four days of lakes, waterfalls, mountain roads and glacier scenery. Travel privately with your own driver-guide, continue to Jasper after day three, and finish in Banff, Lake Louise, Canmore or Calgary.",
  alternates: { canonical: "/four-day-rockies-and-jasper" },
};

const SPECS = [
  { label: "Duration", value: "Four-day private journey", icon: Clock },
  { label: "Experience", value: "Private, exclusively for your group", icon: Users },
  { label: "Starting pickup", value: "Your accommodation in Banff, Canmore or Lake Louise", icon: MapPin },
  { label: "Final drop-off", value: "Banff, Lake Louise, Canmore or Calgary, as arranged", icon: Plane },
  { label: "Pricing", value: "Per vehicle, according to your selected vehicle capacity", icon: Car },
  { label: "Park admission", value: "Included", icon: Check },
  { label: "Activities", value: "Optional extras selected at checkout", icon: Sparkles },
  { label: "Accommodation", value: "Booked directly by guests; Jasper stay required after day three", icon: BedDouble },
  { label: "Airport transfers", value: "Available to add", icon: Plane },
  { label: "Availability", value: "Seasonal; available dates shown when booking", icon: Calendar },
];

const ITINERARY_DAYS = [
  {
    dayNumber: 1,
    title: "Day 1 — Discover Banff",
    stops: [
      {
        name: "Bow Falls",
        desc: "Enjoy views of the Bow River cascading through a scenic setting close to Banff town.",
      },
      {
        name: "Surprise Corner",
        desc: "Photograph the Fairmont Banff Springs hotel from a viewpoint above the river.",
      },
      {
        name: "Hoodoos Trail Viewpoint",
        desc: "Discover unusual rock formations and broad views across the Bow Valley.",
      },
      {
        name: "Lake Minnewanka",
        desc: "Spend time beside an expansive lake surrounded by rugged mountain scenery.",
      },
      {
        name: "Two Jack Lake",
        desc: "Enjoy a peaceful lakeside stop and opportunities to photograph the surrounding peaks.",
      },
      {
        name: "Cascade Ponds",
        desc: "Pause among calm ponds and footbridges beneath Cascade Mountain.",
      },
      {
        name: "Johnston Canyon",
        desc: "Explore canyon paths and walkways toward the Lower Falls, with the walk adapted to conditions and your group’s ability.",
      },
      {
        name: "Banff Gondola — Optional Add-On",
        desc: "Ride to Sulphur Mountain’s summit area for sweeping views across Banff and the surrounding ranges. Admission costs extra.",
        isOptional: true,
      },
      {
        name: "Lunch in Banff Town",
        desc: "Choose from local cafés and restaurants. Lunch is purchased separately.",
      },
    ],
    closing: "Return to your accommodation in Banff, Canmore or Lake Louise.",
  },
  {
    dayNumber: 2,
    title: "Day 2 — Iconic Lakes & Yoho",
    stops: [
      {
        name: "Moraine Lake — Seasonal Access",
        desc: "Visit the lake beneath the Valley of the Ten Peaks, with access transportation arranged by Vista Chase.",
      },
      {
        name: "Lake Louise",
        desc: "Enjoy the lakeshore and its memorable mountain-and-glacier backdrop.",
      },
      {
        name: "Emerald Lake",
        desc: "Discover one of Yoho’s signature landscapes, with time for lakeside views and photographs.",
      },
      {
        name: "Natural Bridge",
        desc: "Watch the Kicking Horse River surge through sculpted rock channels.",
      },
      {
        name: "Takakkaw Falls — Seasonal Access",
        desc: "Admire a towering waterfall in Yoho Valley, subject to road access and conditions.",
      },
      {
        name: "Spiral Tunnels Viewpoint — When Accessible",
        desc: "Hear the story of this mountain railway engineering achievement. Train sightings depend on railway movements.",
      },
      {
        name: "Bow Valley Parkway — Scenic Drive",
        desc: "Travel through forested mountain scenery where the route is open and practical for the day.",
      },
      {
        name: "Lunch in Lake Louise Village",
        desc: "Stop to purchase lunch during the day’s exploration.",
      },
    ],
    closing: "Return to your accommodation. Prepare your luggage for the following morning’s departure to Jasper.",
  },
  {
    dayNumber: 3,
    title: "Day 3 — Icefields Parkway to Jasper",
    stops: [
      {
        name: "Bow Lake",
        desc: "Begin your parkway sightseeing beside a glacier-fed lake framed by mountain peaks.",
      },
      {
        name: "Peyto Lake",
        desc: "Walk to the viewpoint for a striking view of the lake and surrounding valley.",
      },
      {
        name: "Crowfoot Glacier Lookout",
        desc: "Stop for glacier views and an introduction to the changing mountain landscape.",
      },
      {
        name: "Waterfowl Lakes",
        desc: "Enjoy a scenic pause beside the parkway’s mountain-framed lakes.",
      },
      {
        name: "Big Bend Viewpoint",
        desc: "Look across a sweeping valley and the parkway’s dramatic mountain curves.",
      },
      {
        name: "Athabasca Glacier & Columbia Icefield Area",
        desc: "Discover one of the journey’s most impressive glacier landscapes. Glacier travel is available through the optional Ice Explorer.",
      },
      {
        name: "Ice Explorer — Optional Add-On",
        desc: "Board a specialised glacier vehicle for an organised visit onto the Athabasca Glacier. Admission costs extra.",
        isOptional: true,
      },
      {
        name: "Columbia Icefield Skywalk — Optional Add-On",
        desc: "Step onto a glass-floored walkway with views into the Sunwapta Valley. Admission costs extra.",
        isOptional: true,
      },
      {
        name: "Lunch at the Columbia Icefield Centre",
        desc: "Purchase lunch before continuing north.",
      },
      {
        name: "Continue to Jasper",
        desc: "Travel onward through Jasper National Park and finish at your booked accommodation in Jasper town.",
      },
    ],
    closing: "Overnight: Jasper. Accommodation must be booked directly by guests and is not included.",
  },
  {
    dayNumber: 4,
    title: "Day 4 — Maligne Valley, Waterfalls & Your Return Journey",
    stops: [
      {
        name: "Medicine Lake",
        desc: "Pause beside a lake known for its changing water levels and mountain setting.",
      },
      {
        name: "Maligne Lake",
        desc: "Discover the lakeshore and surrounding peaks, with time to appreciate one of Jasper’s signature landscapes.",
      },
      {
        name: "Maligne Lake Cruise toward Spirit Island — Optional Add-On",
        desc: "Choose a scenic cruise with views of Spirit Island and the surrounding mountains. Tickets cost extra and are subject to seasonal operation and availability. Spirit Island views are part of the cruise experience, rather than the standard lakeshore stop.",
        isOptional: true,
      },
      {
        name: "Maligne Canyon — Only If Reopened",
        desc: "If officially reopened and safe to visit for your departure, explore the canyon’s dramatic limestone scenery. While closed, it is excluded and your guide will adjust the day’s sightseeing.",
      },
      {
        name: "Lunch in Jasper Town",
        desc: "Enjoy a break to purchase lunch before travelling south.",
      },
      {
        name: "Athabasca Falls",
        desc: "See the powerful Athabasca River rush through a narrow rocky gorge, with viewing paths and photo opportunities.",
      },
      {
        name: "Sunwapta Falls",
        desc: "Pause at a striking waterfall surrounded by forest and mountain scenery.",
      },
      {
        name: "Return Along the Icefields Parkway",
        desc: "Continue south to your prearranged final destination: Banff, Lake Louise, Canmore or Calgary.",
      },
    ],
    closing:
      "Day four includes substantial driving, especially for a Calgary finish. Departure time, attraction reservations and sightseeing stops will be coordinated around your final destination. Discuss any same-day flight with us before booking it.",
  },
];

const INCLUSIONS = [
  "Private vehicle for your group during the four-day journey.",
  "A dedicated driver-guide.",
  "Doorstep pickup from your starting accommodation in Banff, Canmore or Lake Louise.",
  "Sightseeing transportation throughout the planned itinerary.",
  "Transfer to your booked Jasper accommodation after day three.",
  "Pickup from your Jasper accommodation on day four.",
  "Final drop-off in Banff, Lake Louise, Canmore or Calgary, as agreed when booking.",
  "Required national park admission fees.",
  "Moraine Lake access arrangements when included in the operating itinerary.",
  "Taxes and other mandatory fees charged by authorities for the included tour services.",
];

const EXCLUSIONS = [
  "Accommodation, including the required Jasper overnight stay.",
  "Lunch, breakfast, dinner and personal purchases.",
  "Optional third-party activities, including the Banff Gondola, lake cruises, canoe rentals, Ice Explorer and Skywalk.",
  "Airport transfers outside the agreed itinerary unless separately arranged and added.",
  "Gratuities.",
];

const IMPORTANT_INFO = [
  "Your vehicle and driver-guide are exclusive to your group. Third-party attractions may be shared with other visitors.",
  "Activity tickets are optional extras and depend on availability and operating schedules.",
  "Maligne Canyon is included only if officially reopened for your departure.",
  "Seasonal roads and attractions affect access to Moraine Lake, Takakkaw Falls and other itinerary locations.",
  "Walking may involve steps, slopes and uneven surfaces. Discuss accessibility requirements before booking.",
  "Bring walking shoes, weatherproof layers and additional warm clothing for the glacier area.",
  "Wildlife sightings and clear mountain views cannot be guaranteed.",
  "Vehicle selection must accommodate both passengers and luggage.",
  "Moraine Lake transportation arrangements depend on the vehicle booked and may involve a shuttle transfer.",
];

export default function FourDayRockiesAndJasperPage() {
  const requestHref = "/contact-us?package=four-day-rockies-and-jasper";

  return (
    <>
      <PageSeoExtras path="/four-day-rockies-and-jasper" />
      <div className="bg-obsidian-50 text-obsidian-900">
        {/* Hero */}
        <section
          data-nav-hero
          aria-label="Four-Day Rockies & Jasper Tour"
          className="relative isolate flex min-h-[36rem] items-end overflow-hidden bg-obsidian-950 text-white sm:min-h-[42rem] lg:min-h-[76vh]"
        >
          <div className="absolute inset-0 -z-10">
            <Image
              src="/media/photos/spirit-island.webp"
              alt="Maligne Lake Spirit Island in Jasper National Park"
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
                  Four-Day Rockies &amp; Jasper
                </li>
              </ol>
            </nav>

            <span className="mb-3 inline-block rounded-full bg-summit-500/20 px-3.5 py-1 text-xs font-medium uppercase tracking-[0.2em] text-summit-300 ring-1 ring-summit-400/30 backdrop-blur-md">
              Private Tour · 4 Days
            </span>

            <h1 className="text-balance text-[clamp(2.25rem,8vw,4.5rem)] font-light leading-[1.05] tracking-tight text-white motion-safe:animate-[fadeUp_900ms_ease-out]">
              Four-Day Rockies &amp; Jasper
            </h1>
            <p className="mt-3 text-base sm:text-xl font-light text-summit-200 tracking-wide">
              Private Banff, Yoho, Columbia Icefield &amp; Jasper Tour
            </p>
            <p className="mx-auto mt-5 max-w-3xl text-base sm:text-lg font-light leading-relaxed text-slate-100">
              Explore further across four days of lakes, waterfalls, mountain roads and glacier scenery. Travel privately with your own driver-guide, continue to Jasper after day three, and finish in Banff, Lake Louise, Canmore or Calgary.
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
                Experience the variety of the Canadian Rockies on a private four-day journey through Banff, Yoho and Jasper national parks.
              </p>
              <p className="text-base sm:text-lg font-light leading-relaxed text-slate-700">
                Begin with Banff’s lakes and viewpoints, discover Lake Louise, Moraine Lake and Yoho, then follow the Icefields Parkway to the Columbia Icefield. Continue to Jasper for an overnight stay before exploring Maligne Valley and the waterfalls along your return route.
              </p>
              <p className="text-base sm:text-lg font-light leading-relaxed text-slate-700">
                Personalise your experience with optional activities such as the Banff Gondola, Ice Explorer, Skywalk and a Maligne Lake cruise toward Spirit Island. Your driver-guide coordinates the journey around your selected experiences and the day’s conditions.
              </p>
              <p className="text-base sm:text-lg font-light leading-relaxed text-slate-700">
                Guests book their own accommodation, including a required stay in Jasper after day three.
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
                    className="overflow-hidden rounded-[1.5rem] border border-obsidian-900/[0.08] bg-white p-6 sm:p-8 shadow-sm"
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
                  <strong className="font-semibold">Itinerary note:</strong> Stop order may change around accommodation locations, selected activities, traffic, weather and road access. Optional activities affect the time available elsewhere.
                </p>
              </div>
            </section>

            {/* Inclusions and Exclusions */}
            <section aria-labelledby="inclusions-heading" className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-[1.5rem] bg-white p-6 sm:p-8 border border-obsidian-900/[0.08] shadow-sm">
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

              <div className="rounded-[1.5rem] bg-white p-6 sm:p-8 border border-obsidian-900/[0.08] shadow-sm">
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
              <div className="rounded-[1.5rem] bg-white p-6 sm:p-8 border border-obsidian-900/[0.08]">
                <h3 className="text-xl font-normal text-obsidian-900 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-ocean-600" />
                  <span>Pickup &amp; Drop-Off</span>
                </h3>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                  Your journey begins with doorstep pickup from your accommodation in Banff, Canmore or Lake Louise. Provide your accommodation details and chosen final destination when booking.
                </p>
                <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                  On day three, bring your luggage for the overnight stay in Jasper. Please tell us your luggage requirements before selecting a vehicle so there is suitable space for your group and bags.
                </p>
                <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                  Your guide will be assigned the day before your tour, with contact details shared once confirmed. We aim to provide the same guide throughout the journey, subject to availability and operational requirements.
                </p>
                <p className="mt-2 text-sm text-ocean-700 font-medium">
                  Additional airport transfers can be arranged alongside this package. Any Calgary Airport drop-off must be agreed in advance, with sufficient time allowed for the journey.
                </p>
              </div>

              <div className="rounded-[1.5rem] bg-white p-6 sm:p-8 border border-obsidian-900/[0.08]">
                <h3 className="text-xl font-normal text-obsidian-900 flex items-center gap-2">
                  <BedDouble className="h-5 w-5 text-ocean-600" />
                  <span>Accommodation</span>
                </h3>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 font-light">
                  Guests choose, book and pay for their own accommodation.
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700 font-light">
                  <li className="flex items-start gap-2">
                    <span className="text-ocean-600" aria-hidden="true">•</span>
                    <span><strong>Before and during days one and two:</strong> Stay in Banff, Canmore or Lake Louise.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-ocean-600" aria-hidden="true">•</span>
                    <span><strong>After day three:</strong> Stay in Jasper town.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-ocean-600" aria-hidden="true">•</span>
                    <span><strong>After day four:</strong> Arrange accommodation at your final destination if required.</span>
                  </li>
                </ul>
                <p className="mt-3 text-xs uppercase tracking-wider text-amber-800 font-medium bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  Please confirm the tour dates before making non-refundable accommodation bookings.
                </p>
              </div>
            </section>

            {/* Important Guest Information */}
            <section aria-labelledby="important-info-heading" className="rounded-[1.5rem] bg-white p-6 sm:p-8 border border-obsidian-900/[0.08]">
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
            className="rounded-[1.75rem] bg-obsidian-950 p-6 text-white sm:p-8 lg:sticky lg:top-[calc(var(--vc-header-h,80px)+24px)] shadow-xl border border-white/10"
            aria-label="Price and booking request"
          >
            <div className="border-b border-white/10 pb-5">
              <span className="text-xs uppercase tracking-[0.2em] text-summit-300">Private Journey</span>
              <h3 className="mt-1 text-2xl font-light text-white">Four-Day Rockies &amp; Jasper</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-xs text-white/55">From</span>
                <span className="text-4xl font-light tabular-nums text-white">CAD $4,860</span>
                <span className="text-xs text-white/70">per vehicle</span>
              </div>
              <p className="mt-1 text-xs text-white/60">Taxes and required fees included</p>
            </div>

            <ul className="mt-6 space-y-3.5 text-sm text-white/85">
              <li className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-summit-300 shrink-0" aria-hidden="true" />
                <span>4-day private journey</span>
              </li>
              <li className="flex items-center gap-3">
                <Users className="h-4 w-4 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Exclusive private vehicle for your group</span>
              </li>
              <li className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Starts in Banff/Canmore, finishes in Calgary/Banff</span>
              </li>
              <li className="flex items-center gap-3">
                <Plane className="h-4 w-4 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Airport transfers available to add</span>
              </li>
              <li className="flex items-center gap-3">
                <BedDouble className="h-4 w-4 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Jasper stay required after day 3</span>
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
                Tell us your travel dates, passenger count and luggage needs. We’ll reply with a confirmed quote.
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
