// Contact, structured like the help pages of the booking sites studied: photo hero, the fastest
// ways to reach us first (call, email, AI concierge, office), then the message form, then
// self-serve shortcuts. "Request this tour" links land here with the tour and party size filled.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, ChevronRight, HelpCircle, Mail, MapPin, Phone, Sparkles, Ticket } from "lucide-react";
import { ContactForm } from "@/components/forms/ContactForm";
import { TWO_DAY_PACKAGE } from "@/lib/sharedTours";
import { SHUTTLE_DEPARTURES, SHUTTLE_PICKUPS, clock } from "@/lib/shuttleSchedule";
import { getTours } from "@/lib/api/catalog";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";

const baseMetadata: Metadata = {
  title: "Contact Us | Vista Chase Banff & Canmore",
  description: "Call +1 (825) 734-9456, email support@vistachase.com or send us a message. Vista Chase is based in Canmore, Alberta.",
  alternates: { canonical: "/contact-us" },
};

const CHANNELS = [
  { icon: Phone, title: "Call us", value: "+1 (825) 734-9456", note: "Lines open 6 a.m. – 9 p.m. Mountain Time", href: "tel:+18257349456" },
  { icon: Mail, title: "Booking inquiries", value: "bookings@vistachase.com", note: "Tours, shuttles & reservations", href: "mailto:bookings@vistachase.com" },
  { icon: Mail, title: "Support email", value: "support@vistachase.com", note: "General questions & customer care", href: "mailto:support@vistachase.com" },
  { icon: Sparkles, title: "AI concierge", value: "Ask anything, any time", note: "Tours, pickups and bookings", href: "/concierge" },
];

const SELF_SERVE = [
  { icon: Ticket, label: "Find my booking", href: "/account/trips" },
  { icon: MapPin, label: "Hotel pickup finder", href: "/pickup-finder" },
  { icon: HelpCircle, label: "FAQ & cancellation", href: "/faq" },
];

export default async function ContactUsPage({ searchParams }: { searchParams: Promise<{ tour?: string; guests?: string; package?: string; shuttle?: string; date?: string; pickup?: string }> }) {
  const params = await searchParams;
  const pkg = params.package;
  const isTwoDayShared = pkg === TWO_DAY_PACKAGE.slug;
  const isTwoDayPrivate = pkg === "two-day-rockies-explorer-private";
  const isThreeDay = pkg === "three-day-rockies-discovery";
  const isFourDay = pkg === "four-day-rockies-and-jasper";

  let packageTitle = "";
  let packageSubtitle = "";
  let packageMessage = "";

  if (isTwoDayShared) {
    packageTitle = `Request the ${TWO_DAY_PACKAGE.title}`;
    packageSubtitle = "Tell us your two dates and how many guests. Our team confirms both days and sends one booking with 10% off.";
    packageMessage = TWO_DAY_PACKAGE.requestMessage;
  } else if (isTwoDayPrivate) {
    packageTitle = "Request the Private Two-Day Rockies Explorer";
    packageSubtitle = "Tell us your preferred dates and party size. Our team confirms your private vehicle and driver-guide for both days with 10% off.";
    packageMessage = "I'd like to book the Private Two-Day Rockies Explorer (Private Banff & Yoho + Columbia Icefield Adventure, 10% off).\nPreferred Day 1 date:\nPreferred Day 2 date:\nGroup size:\nWhere we're staying:";
  } else if (isThreeDay) {
    packageTitle = "Request the Three-Day Rockies Discovery";
    packageSubtitle = "Tell us your preferred dates and group size. Our team will coordinate your 3-day private itinerary, driver-guide, and vehicle.";
    packageMessage = "I'd like to book the Three-Day Rockies Discovery (Private Banff, Yoho & Columbia Icefield Tour).\nPreferred start date:\nGroup size:\nWhere we're staying (Banff, Canmore, or Lake Louise):\nOptional activities of interest (Banff Gondola, Ice Explorer, Skywalk):";
  } else if (isFourDay) {
    packageTitle = "Request the Four-Day Rockies & Jasper";
    packageSubtitle = "Tell us your preferred dates, group size, and final drop-off location. Our team will tailor your 4-day journey across Banff, Yoho, and Jasper.";
    packageMessage = "I'd like to book the Four-Day Rockies & Jasper Private Tour.\nPreferred start date:\nGroup size:\nLuggage count:\nFinal drop-off destination (Banff, Lake Louise, Canmore, or Calgary):\nOptional activities of interest:";
  }

  // "Book This Departure" on /shuttles when that departure isn't bookable online yet.
  const shuttle = SHUTTLE_DEPARTURES.find((d) => String(d.number) === params.shuttle);
  if (!packageTitle && shuttle) {
    const pickup = SHUTTLE_PICKUPS.find((p) => p.id === params.pickup) ?? SHUTTLE_PICKUPS[1];
    const time = shuttle.pickup[pickup.id];
    const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date : "";
    packageTitle = "Book your lake shuttle";
    packageSubtitle = `Departure ${shuttle.number} · ${shuttle.name}. Tell us how many guests and we'll confirm your seats by email.`;
    packageMessage = `I'd like to book the Moraine Lake & Lake Louise Shuttle.\nDeparture: ${shuttle.number} · ${shuttle.name}\nDate: ${date}\nPickup: ${pickup.label}${time ? ` (${clock(time)})` : ""}\nNumber of guests:`;
  }

  let tours: { slug: string; title: string }[] = [];
  try {
    const rawTours = await getTours();
    tours = rawTours.map((t) => ({ slug: t.slug, title: t.title }));
  } catch {
    tours = [];
  }
  const requested = tours.find((t) => t.slug === params.tour);
  const guests = Number(params.guests);

  return (
    <>
      <PageSeoExtras path="/contact-us" />
    <div className="bg-obsidian-50 text-obsidian-900">
      {/* Hero */}
      <section data-nav-hero className="relative isolate flex min-h-[52vh] items-end overflow-hidden bg-obsidian-950 text-white">
        <Image src="/media/photos/bow-lake-reflection.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover" data-parallax="10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/45 to-ocean-950/20" />
        <div className="mx-auto flex w-full flex-col items-center text-center max-w-7xl px-page pb-12 pt-[calc(var(--vc-nav-open-h,100px)+1.5rem)]" data-scroll-fade>
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
                Contact
              </li>
            </ol>
          </nav>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-6xl motion-safe:animate-[fadeUp_900ms_ease-out]">
            {packageTitle || (requested ? "Request this tour" : "Talk to a local")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-light leading-relaxed text-white/85 motion-safe:animate-[fadeUp_1100ms_ease-out]">
            {packageSubtitle || (requested
              ? `Tell us your dates for ${requested.title} and we'll reply with availability and a price.`
              : "Questions about Moraine Lake access, pickups or a custom private day? Our Canmore team is here to help.")}
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl items-start gap-8 px-page py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-12">
        {/* Ways to reach us */}
        <aside className="space-y-4" aria-label="Ways to reach us">
          <ul className="space-y-3" data-stagger>
            {CHANNELS.map(({ icon: Icon, title, value, note, href }) => (
              <li key={title}>
                <Link
                  href={href}
                  className="group flex items-center gap-4 rounded-[1.5rem] bg-white p-5 ring-1 ring-obsidian-900/[0.07] transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-28px_rgba(12,31,33,0.5)]"
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-summit-200 text-obsidian-900">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-600">{title}</span>
                    <span className="block text-lg text-obsidian-900">{value}</span>
                    <span className="block text-sm text-slate-600">{note}</span>
                  </span>
                  <ArrowUpRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-obsidian-900" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        {/* Form */}
        <section aria-labelledby="form-heading" className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-10" data-reveal>
          <h2 id="form-heading" className="text-2xl font-light text-obsidian-900 sm:text-3xl">
            Send us a message
          </h2>
          <p className="mb-8 mt-2 text-base text-slate-600">Group trips, custom private days, accessibility needs or anything else.</p>
          <ContactForm
            tours={tours}
            defaultTour={requested?.slug}
            defaultGuests={Number.isFinite(guests) && guests > 0 ? guests : undefined}
            defaultMessage={packageMessage || undefined}
          />
        </section>
      </div>

      {/* Self-serve */}
      <section aria-labelledby="selfserve-heading" className="mx-auto max-w-7xl px-page pb-20">
        <h2 id="selfserve-heading" className="mb-5 text-xl font-light text-obsidian-900" data-reveal>
          You might find the answer here
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3" data-stagger>
          {SELF_SERVE.map(({ icon: Icon, label, href }) => (
            <li key={href}>
              <Link href={href} className="group flex items-center justify-between rounded-2xl bg-white px-5 py-4 ring-1 ring-obsidian-900/[0.07] transition-colors hover:ring-ocean-600/40">
                <span className="flex items-center gap-3 text-base text-obsidian-900">
                  <Icon className="h-5 w-5 text-ocean-600" aria-hidden="true" />
                  {label}
                </span>
                <ChevronRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
    </>
  );
}

export function generateMetadata(): Promise<Metadata> {
  return withSeo("/contact-us", baseMetadata);
}
