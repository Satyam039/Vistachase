// Moraine Lake & Lake Louise shuttle, laid out per the owner's doc (Shuttles section): hero, then
// "Choose your lake day" (booking bar + one card per departure from lib/shuttleSchedule.ts), the
// live online date rail, what's included and how the day works. The road-closure notice lives in
// the site announcement bar only. Inclusions and pickup points are the catalog's.

import Image from "next/image";
import Link from "next/link";
import { SEATS_MESSAGE } from "@/lib/policy";
import type { Metadata } from "next";
import { ArrowRight, CalendarCheck, CheckCircle2, ChevronRight, Clock, MapPin, Sunrise, TicketCheck } from "lucide-react";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";
import { ShuttleDayPlanner, type LiveShuttleDeparture } from "@/components/shuttles/ShuttleDayPlanner";
import { albertaToday } from "@/lib/shuttleSchedule";
import { TrustRow } from "@/components/home/TrustRow";
import { getShuttleRoutes, getTours } from "@/lib/api/catalog";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";

const baseMetadata: Metadata = {
  title: "Moraine Lake & Lake Louise Shuttles | Vista Chase (Guaranteed Access)",
  description:
    "Sunrise and day shuttles to Moraine Lake and Lake Louise from Canmore and Banff. Parks Canada entry, a local guide and guaranteed access included.",
  alternates: { canonical: "/shuttles" },
};

const INCLUDED = [
  "Guaranteed Moraine Lake and Lake Louise access",
  "Parks Canada entry fees",
  "A professional local guide",
  "Bottled water and a hot drink",
  "Round trip from Canmore, Banff or Lake Louise",
  "Small groups, up to 12 guests",
];

const STEPS = [
  { icon: TicketCheck, title: "Pick a departure", body: "Choose sunrise or the day shuttle and your date below." },
  { icon: Clock, title: "Get your pickup time", body: "We confirm your exact pickup time the day before." },
  { icon: Sunrise, title: "Ride to the lakes", body: "No driving, no parking: we take the road closed to cars." },
  { icon: CalendarCheck, title: "Free time, then home", body: "Time at Moraine Lake and Lake Louise, then back to Banff or Canmore." },
];

const shortDate = (d: string) => {
  const p = new Date(`${d}T00:00:00`);
  return Number.isNaN(p.getTime()) ? { day: d, date: "" } : { day: p.toLocaleDateString("en-CA", { weekday: "short" }), date: p.toLocaleDateString("en-CA", { month: "short", day: "numeric" }) };
};

export default async function ShuttlesPage() {
  const [routes, shuttles] = await Promise.all([getShuttleRoutes(), getTours({ category: "SHUTTLE" })]);
  const live: LiveShuttleDeparture[] = routes.flatMap((r) =>
    r.departures.map((d) => ({ id: d.id, date: d.date.slice(0, 10), time: d.departureTime.slice(0, 5), price: d.price, seatsAvailable: d.seatsAvailable })),
  );
  const prices = shuttles.map((t) => t.basePrice).filter((p): p is number => typeof p === "number" && p > 0);
  const fromPrice = prices.length ? Math.min(...prices) : null;

  return (
    <>
      <PageSeoExtras path="/shuttles" />
    <div className="bg-obsidian-50 text-obsidian-900">
      {/* Hero */}
      <section data-nav-hero className="relative isolate flex min-h-[78vh] items-end overflow-hidden bg-obsidian-950 text-white">
        <Image src="/media/photos/moraine-lake-perfect-reflection.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
        <AmbientVideo
          src="/media/videos/lake-louise-summer.mp4"
          srcHd="/media/videos/lake-louise-summer-1080.mp4"
          poster="/media/videos/lake-louise-summer-poster.webp"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          once
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/45 to-ocean-950/10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ocean-950/70 to-transparent" />
        <div className="mx-auto flex w-full flex-col items-center text-center max-w-7xl px-page pb-14 pt-[calc(var(--vc-nav-open-h,100px)+1.5rem)]" data-scroll-fade>
          <nav aria-label="Breadcrumb" className="mb-6">
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
                Lake shuttles
              </li>
            </ol>
          </nav>
          <p className="mb-4 text-sm uppercase tracking-[0.24em] text-summit-300 motion-safe:animate-[fadeUp_800ms_ease-out]">Two Iconic Lakes. One Easy Booking.</p>
          <h1 className="mx-auto max-w-4xl text-balance text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl motion-safe:animate-[fadeUp_900ms_ease-out]">
            Moraine Lake &amp; Lake Louise Shuttle
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-light leading-relaxed text-white/85 motion-safe:animate-[fadeUp_1100ms_ease-out]">
            Visit both lakes with convenient pickups in Banff, Canmore and Lake Louise Village. Choose your departure, enjoy time to explore
            independently and leave the driving to us.
          </p>
          <a href="#departures" className="golden-summit-btn mt-7 inline-flex h-12 items-center gap-2 rounded-full px-6 text-base motion-safe:animate-[fadeUp_1300ms_ease-out]">
            Choose Your Departure
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <p className="mt-6 text-sm text-white/85">Both Lakes Included · Round-Trip Transportation · Small Groups</p>
          <p className="mt-1 text-sm text-white/70">Operating June–September · Multiple Daily Departures</p>
        </div>
      </section>

      {/* Choose your lake day */}
      <section id="departures" aria-labelledby="lake-day-heading" className="scroll-mt-32 mx-auto max-w-7xl px-page py-16 sm:py-20">
        <div className="mx-auto mb-10 max-w-3xl text-center" data-reveal>
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">Choose your lake day</p>
          <h2 id="lake-day-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl">
            Two Lakes. A Departure That Fits.
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Start early or explore later in the day. Every departure visits Moraine Lake and Lake Louise, with round-trip transportation and time to
            enjoy each lake independently.
          </p>
          <p className="mt-3 text-base text-slate-600">Choose your date and pickup location to see available departures.</p>
          <p className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-obsidian-900">
            <span>June–July: 7 Daily Departures</span>
            <span>August–September: 5 Daily Departures</span>
          </p>
        </div>
        <ShuttleDayPlanner today={albertaToday()} live={live} fromPrice={fromPrice} />
      </section>

      {/* Departure picker */}
      <section id="book-online" aria-labelledby="departures-heading" className="scroll-mt-32 border-y border-obsidian-900/[0.06] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-page">
          <div className="mx-auto mb-10 max-w-3xl text-center" data-reveal>
            <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">Upcoming departures</p>
            <h2 id="departures-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl">
              Pick your date
            </h2>
            <p className="mt-3 text-base text-slate-600">{SEATS_MESSAGE}. Choose a date to hold your seats.</p>
          </div>
          <div className="space-y-10">
            {routes.map((route) => (
              <div key={route.id} data-reveal>
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-xl font-light text-obsidian-900">{route.name}</h3>
                  <p className="flex items-center gap-1.5 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 text-ocean-600" aria-hidden="true" />
                    {route.origin} → {route.destination}
                  </p>
                </div>
                {route.departures.length === 0 ? (
                  <p className="text-base text-slate-600">New dates are on the way. <Link href="/contact-us" className="text-ocean-700 underline">Ask us</Link> about your date.</p>
                ) : (
                  <ul className="vc-rail -mx-page flex gap-3 overflow-x-auto px-page pb-2" aria-label={`${route.name} departures`}>
                    {route.departures.map((dep) => {
                      const { day, date } = shortDate(dep.date);
                      const open = dep.seatsAvailable > 0;
                      const body = (
                        <>
                          <span className="block text-sm text-slate-600">{day}</span>
                          <span className="block text-lg text-obsidian-900">{date}</span>
                          <span className="block text-sm text-slate-600">{dep.departureTime}</span>
                          <span className="mt-2 block text-base text-obsidian-900">${dep.price}</span>
                          <span className={`mt-1 block text-xs ${open ? "text-emerald-800" : "text-red-700"}`}>
                            {open ? "Available" : "Sold out"}
                          </span>
                        </>
                      );
                      return (
                        <li key={dep.id} className="shrink-0">
                          {open ? (
                            <Link
                              href={`/book?departureId=${dep.id}`}
                              aria-label={`Book ${route.name}, ${day} ${date} at ${dep.departureTime}, $${dep.price}, available`}
                              className="block w-32 rounded-2xl border border-obsidian-900/10 bg-white px-4 py-3.5 text-center transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-ocean-600/50 hover:shadow-[0_16px_30px_-22px_rgba(12,31,33,0.5)]"
                            >
                              {body}
                            </Link>
                          ) : (
                            <div className="w-32 rounded-2xl border border-obsidian-900/10 bg-obsidian-50 px-4 py-3.5 text-center opacity-70">{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Included + how it works */}
      <section className="mx-auto grid max-w-7xl gap-12 px-page py-16 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <div data-reveal>
          <h2 className="text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">What&rsquo;s included</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {INCLUDED.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-base text-slate-700">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                {i}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-base text-slate-600">
            Pickup points are in Canmore, Banff and Lake Louise (Samson Mall).{" "}
            <Link href="/pickup-finder" className="text-ocean-700 underline underline-offset-2">
              Find your nearest pickup
            </Link>
            .
          </p>
        </div>
        <div>
          <h2 className="text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl" data-reveal>
            How it works
          </h2>
          <ol className="mt-6 space-y-3" data-stagger>
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex items-start gap-4 rounded-2xl bg-white p-5 ring-1 ring-obsidian-900/[0.07]">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-obsidian-950 text-summit-400">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-base text-obsidian-900">
                    {i + 1}. {title}
                  </span>
                  <span className="block text-sm text-slate-600">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <TrustRow />
    </div>
    </>
  );
}

export function generateMetadata(): Promise<Metadata> {
  return withSeo("/shuttles", baseMetadata);
}
