// Contact, structured like the help pages of the booking sites studied: photo hero, the fastest
// ways to reach us first (call, email, AI concierge, office), then the message form, then
// self-serve shortcuts. "Request this tour" links land here with the tour and party size filled.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, ChevronRight, HelpCircle, Mail, MapPin, Phone, Sparkles, Ticket } from "lucide-react";
import { ContactForm } from "@/components/forms/ContactForm";
import { getTours } from "@/lib/api/catalog";

export const metadata: Metadata = {
  title: "Contact Us | Vista Chase Banff & Canmore",
  description: "Call +1 (825) 734-9456, email info@vistachase.com or send us a message. Vista Chase is based in Canmore, Alberta.",
  alternates: { canonical: "/contact-us" },
};

const CHANNELS = [
  { icon: Phone, title: "Call us", value: "+1 (825) 734-9456", note: "Lines open 6 a.m. – 9 p.m. Mountain Time", href: "tel:+18257349456" },
  { icon: Mail, title: "Email", value: "info@vistachase.com", note: "We usually reply within a day", href: "mailto:info@vistachase.com" },
  { icon: Sparkles, title: "AI concierge", value: "Ask anything, any time", note: "Tours, pickups and bookings", href: "/concierge" },
];

const SELF_SERVE = [
  { icon: Ticket, label: "Find my booking", href: "/account/trips" },
  { icon: MapPin, label: "Hotel pickup finder", href: "/pickup-finder" },
  { icon: HelpCircle, label: "FAQ & cancellation", href: "/faq" },
];

export default async function ContactUsPage({ searchParams }: { searchParams: Promise<{ tour?: string; guests?: string }> }) {
  const params = await searchParams;
  const tours = (await getTours()).map((t) => ({ slug: t.slug, title: t.title }));
  const requested = tours.find((t) => t.slug === params.tour);
  const guests = Number(params.guests);

  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      {/* Hero */}
      <section className="relative isolate flex min-h-[52vh] items-end overflow-hidden bg-ocean-950 text-white">
        <Image src="/media/photos/bow-lake-reflection.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover" data-parallax="10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/45 to-ocean-950/20" />
        <div className="mx-auto flex w-full flex-col items-center text-center max-w-7xl px-page pb-12 pt-24" data-scroll-fade>
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
            {requested ? "Request this tour" : "Talk to a local"}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-light leading-relaxed text-white/85 motion-safe:animate-[fadeUp_1100ms_ease-out]">
            {requested
              ? `Tell us your dates for ${requested.title} and we'll reply with availability and a price.`
              : "Questions about Moraine Lake access, pickups or a custom private day? Our Canmore team is here to help."}
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

          <div className="rounded-[1.5rem] bg-ocean-950 p-6 text-white" data-reveal>
            <p className="flex items-center gap-2 text-sm text-summit-300">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Our office
            </p>
            <p className="mt-2 text-lg text-white">121 Bow Meadows Crescent #110</p>
            <p className="text-base text-white/80">Canmore, AB T1W 2W8, Canada</p>
            <a
              href="https://www.google.com/maps/search/?api=1&query=121+Bow+Meadows+Crescent+%23110+Canmore+AB"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 border-b border-summit-500 pb-0.5 text-sm text-white"
            >
              Open in Google Maps
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </aside>

        {/* Form */}
        <section aria-labelledby="form-heading" className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-10" data-reveal>
          <h2 id="form-heading" className="text-2xl font-light text-obsidian-900 sm:text-3xl">
            Send us a message
          </h2>
          <p className="mb-8 mt-2 text-base text-slate-600">Group trips, custom private days, accessibility needs or anything else.</p>
          <ContactForm tours={tours} defaultTour={requested?.slug} defaultGuests={Number.isFinite(guests) && guests > 0 ? guests : undefined} />
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
  );
}
