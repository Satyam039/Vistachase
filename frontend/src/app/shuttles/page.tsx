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
import { FaqBrowser } from "@/components/faq/FaqBrowser";
import { getShuttleRoutes, getTours } from "@/lib/api/catalog";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";
import { cachePublicData } from "@/lib/api/cachePolicy";

// Rendered once and served from cache, refreshed in the background at most every minute, instead of
// on every request (fix recheck, 10 Nov 2026, N2/R2: 2.7-10 s responses and 5xx under a crawl).
// Seats and prices on this page can be up to a minute old; checkout (/book) always reads them live.
export const revalidate = 60;

const baseMetadata: Metadata = {
  title: "Moraine Lake & Lake Louise Shuttle | Vista Chase",
  description:
    "Moraine Lake & Lake Louise Shuttle from Canmore, Banff and Lake Louise Village (Samson Mall), June 1–October 12. Parks Canada admission and bottled water included; access subject to road closures and operating conditions.",
  alternates: { canonical: "/shuttles" },
};

const INCLUDED = [
  "Moraine Lake & Lake Louise shuttle access (subject to closures & operating conditions)",
  "Parks Canada admission fees",
  "Bottled water onboard",
  "Round-trip transportation from Canmore, Banff or Samson Mall",
];

const STEPS = [
  { icon: TicketCheck, title: "Pick a departure", body: "Choose from departures 1–7 (June 1–July 31) or 2–6 (August 1–October 12)." },
  { icon: Clock, title: "Check your pickup time", body: "Board at your listed Banff, Canmore or Samson Mall pickup 10 minutes early." },
  { icon: Sunrise, title: "Ride to the lakes", body: "No driving, no parking: we take the road closed to personal cars." },
  { icon: CalendarCheck, title: "Explore & return", body: "Explore both lakes independently on your booked schedule, then ride back." },
];

const SHUTTLE_INFO = [
  {
    title: "Service",
    body: "This is a shuttle service, not a guided tour. Guests explore independently and must follow their booked schedule. Switching departures or skipping a leg requires team approval.",
  },
  {
    title: "Food and drinks",
    body: "Park admission and bottled water are included. Meals and hot drinks are not included. Packed food is welcome for consumption during lake stops. Eating onboard is not permitted; water is allowed.",
  },
  {
    title: "Timing",
    body: "Be ready at your confirmed pickup point 10 minutes before departure. Visit and return times are approximate and may change due to traffic, road conditions or unexpected disruptions.",
  },
  {
    title: "Samson Mall pickup notice",
    body: "Parking is not provided. Do not leave your vehicle in village public parking, day-use areas or Samson Mall customer parking while using the shuttle. Guests staying in Banff or Canmore should board there.",
  },
  {
    title: "Rescheduling",
    body: "Request rescheduling at least 24 hours before departure, subject to availability and confirmation.",
  },
  {
    title: "Minimum passengers",
    body: "Four passengers are required. If minimum numbers require cancellation, guests are contacted at least one week ahead and offered an alternative or full refund. Bookings made within seven days are protected from minimum-passenger cancellation. Major disruptions may still affect operation.",
  },
  {
    title: "Closures",
    body: "If Parks Canada closes one lake but the shuttle operates, no refund applies for the missed lake. If Vista Chase cancels the entire departure, guests receive a full refund.",
  },
  {
    title: "Missed lake pickup",
    body: "Contact your driver or Vista Chase support immediately. Later transportation depends on availability and is not guaranteed.",
  },
];

const SHUTTLE_FAQS = [
  {
    q: "Where do your shuttles pick up and drop off?",
    a: "Choose from the listed hotel/pickup options in Banff or Canmore, or Samson Mall in Lake Louise Village. Custom pickup addresses are not available for this shared shuttle. Your exact pickup arrangements are confirmed before travel.",
  },
  {
    q: "What time do the early-morning shuttles depart?",
    a: "Departure 1 picks up at 2:45 AM in Canmore, 3:15 AM in Banff and 3:55 AM at Samson Mall. It operates June 1–July 31.\n\nDeparture 2 picks up at 3:45 AM in Canmore, 4:15 AM in Banff and 4:55 AM at Samson Mall. It operates June 1–October 12.\n\nAll times are local Alberta time. Sunrise timing and conditions vary; a particular sunrise view is not guaranteed.",
  },
  {
    q: "When does the shuttle operate?",
    a: "The shuttle operates June 1–October 12, subject to road access and conditions.\n\nJune 1–July 31: departures 1–7.\nAugust 1–October 12: departures 2–6.",
  },
  {
    q: "How much does the shuttle cost?",
    a: "Prices are in Canadian dollars per person, including taxes and mandatory fees:\n\n• Departures 1–2: $135\n• Departures 3–4: $120\n• Departures 5–7: $108\n\nThe same fare applies to adults, children and infants. Every passenger requires a seat.",
  },
  {
    q: "Is this a guided tour?",
    a: "No. This is a shared shuttle service with transportation between the lakes and time to explore independently. A guide does not accompany you at the lakes.",
  },
  {
    q: "Are food and drinks included?",
    a: "Bottled water is included. Meals and hot drinks are not included, and there is no dedicated lunch stop.\n\nBring breakfast, snacks or a packed meal to enjoy during your scheduled lake time, particularly on early departures when food outlets may not be open. Eating onboard is not permitted; drinking water is allowed.",
  },
  {
    q: "How early should I be ready, and can the schedule change?",
    a: "Be ready at your confirmed pickup point 10 minutes before departure. Visit and return times are approximate and may change because of traffic, road conditions or unexpected disruptions.",
  },
  {
    q: "Can I return on a different departure or skip one lake?",
    a: "Your booking follows a fixed schedule covering both lakes and all shuttle legs. You cannot independently switch return departures or skip a leg. Contact us with special requests; changes require approval and depend on availability.",
  },
  {
    q: "What if I miss the shuttle at a lake?",
    a: "Contact your driver or Vista Chase support immediately. We will advise on available options, but later transportation is subject to availability and is not guaranteed.",
  },
  {
    q: "Is there a minimum passenger requirement?",
    a: "Yes, four passengers. If minimum numbers require cancellation, we contact guests at least one week before departure and offer a suitable alternative. If it does not work for you, we provide a full refund.\n\nBookings made within seven days of departure are protected from minimum-passenger cancellation. Major disruptions may still affect operation.",
  },
  {
    q: "What happens if Parks Canada closes one lake?",
    a: "If Parks Canada closes one lake but the shuttle still operates, no refund applies for the missed lake. If Vista Chase cancels the entire departure, you receive a full refund.",
  },
  {
    q: "Can I bring an infant, and are child seats available?",
    a: "Yes. Infants pay the same departure fare and require a seat. Complimentary child seats and boosters are limited and require advance confirmation. Tell us your child’s age and seat requirements before travel.",
  },
  {
    q: "What is your cancellation and rescheduling policy?",
    a: "Cancel at least 24 hours before your confirmed departure for a full refund. Later cancellations, missed pickups and no-shows are non-refundable.\n\nRescheduling requests also require at least 24 hours’ notice and depend on availability and confirmation.",
  },
  {
    q: "Why should I use a shuttle to visit Moraine Lake?",
    a: "The shuttle provides arranged transportation to Moraine Lake and Lake Louise without the need to drive or find parking at the lakes. Access remains subject to road closures, Parks Canada restrictions and operating conditions.",
  },
  {
    q: "Staying in Banff or Canmore? Board your shuttle there.",
    a: "Parking is not provided at Samson Mall. Do not leave your vehicle in village public parking, day-use areas or Samson Mall customer parking while using the shuttle. Guests staying in Banff or Canmore should board there.",
  },
  {
    q: "Can I bring luggage, strollers, or outdoor gear?",
    a: "Small daypacks, camera bags, hiking poles (with rubber tips), and compact foldable strollers are welcome on board. If you have larger luggage or special mobility equipment, please contact us in advance at support@vistachase.com so we can ensure suitable vehicle accommodation.",
  },
];

const shortDate = (d: string) => {
  const p = new Date(`${d}T00:00:00`);
  return Number.isNaN(p.getTime()) ? { day: d, date: "" } : { day: p.toLocaleDateString("en-CA", { weekday: "short" }), date: p.toLocaleDateString("en-CA", { month: "short", day: "numeric" }) };
};

export default async function ShuttlesPage() {
  cachePublicData();
  const [routes, shuttles] = await Promise.all([getShuttleRoutes(), getTours({ category: "SHUTTLE" })]);
  // Departures sold online: the two shuttle products' (seeded from the doc's timetable) and any routes'.
  const live: LiveShuttleDeparture[] = [...shuttles.flatMap((t) => t.departures), ...routes.flatMap((r) => r.departures)].map((d) => ({
    id: d.id,
    date: d.date.slice(0, 10),
    time: d.departureTime.slice(0, 5),
    price: d.price,
    seatsAvailable: d.seatsAvailable,
  }));
  const prices = shuttles.map((t) => t.basePrice).filter((p): p is number => typeof p === "number" && p > 0);
  const fromPrice = prices.length ? Math.min(...prices) : null;

  return (
    <>
      <PageSeoExtras path="/shuttles" />
    <div className="bg-obsidian-50 text-obsidian-900">
      {/* Hero */}
      <section data-nav-hero className="relative isolate flex min-h-[78vh] items-end overflow-hidden bg-obsidian-950 text-white">
        <Image src="/media/photos/moraine-lake-perfect-reflection.webp" alt="Moraine Lake reflection in the Valley of the Ten Peaks" fill priority sizes="100vw" className="-z-10 object-cover" />
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
          <p className="mt-1 text-sm text-white/70">Operating June 1–October 12 · Access subject to road closures &amp; operating conditions</p>
        </div>
      </section>

      {/* Why book with us, just under the hero (owner's notes, point 3) */}
      <TrustRow variant="shuttles" />

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
            <span>June 1–July 31: Departures 1–7</span>
            <span>August 1–October 12: Departures 2–6</span>
            <span>CAD $135 (Dep 1–2) · $120 (Dep 3–4) · $108 (Dep 5–7)</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Adults, children and infants pay the same fare. Every passenger requires a seat.
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
            <p className="mt-3 text-base text-slate-600">{SEATS_MESSAGE}. Select an available departure to begin booking.</p>
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
                          <span className="mt-2 block text-base text-obsidian-900">CAD ${dep.price}</span>
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
                              aria-label={`Book ${route.name}, ${day} ${date} at ${dep.departureTime}, CAD $${dep.price}, available`}
                              className="block w-32 rounded-none border border-obsidian-900/10 bg-white px-4 py-3.5 text-center transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-ocean-600/50 hover:shadow-[0_16px_30px_-22px_rgba(12,31,33,0.5)]"
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
            Listed pickup points only in Canmore, Banff and Lake Louise (Samson Mall) — custom pickup addresses are not available.{" "}
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
              <li key={title} className="flex items-start gap-4 rounded-none bg-white p-5 ring-1 ring-obsidian-900/[0.07]">
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

      {/* Important shuttle information */}
      <section aria-labelledby="shuttle-info-heading" className="border-t border-obsidian-900/[0.06] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-page">
          <div className="mb-10 max-w-2xl">
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-ocean-700">Before you book</p>
            <h2 id="shuttle-info-heading" className="text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">
              Important shuttle information
            </h2>
          </div>
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SHUTTLE_INFO.map((item) => (
              <div key={item.title} className="rounded-none bg-obsidian-50 p-5 ring-1 ring-obsidian-900/[0.07]">
                <dt className="text-base font-medium text-obsidian-900">{item.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section aria-labelledby="shuttles-faq-heading" className="border-t border-obsidian-900/[0.08] bg-obsidian-100/50 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-page">
          <div className="mb-10 text-center" data-reveal>
            <p className="mb-3 text-xs uppercase tracking-[0.24em] text-ocean-700">Need to know</p>
            <h2 id="shuttles-faq-heading" className="text-balance text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
              Everything you need to know about access, pickups, schedules, and riding the Vista Chase lake shuttles.
            </p>
          </div>
          <div data-reveal>
            <FaqBrowser compact topics={[]} items={SHUTTLE_FAQS.map((f) => ({ ...f, topic: "" }))} />
          </div>
        </div>
      </section>

    </div>
    </>
  );
}

export function generateMetadata(): Promise<Metadata> {
  cachePublicData();
  return withSeo("/shuttles", baseMetadata);
}
