// Travel trade page for agents, hotel concierge desks and tour operators: who we work with, the
// agent portal login, and the way in (the partner application on /partners). Only claims the
// rest of the site already makes: group sizes, vehicles, pickup, cancellation, Moraine Lake access
// and the TripAdvisor ranking. Applications go through the partner form, never URL parameters.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, Building, CheckCircle2, ExternalLink, Phone, Route } from "lucide-react";
import { SectionHeading } from "@/components/home/SectionHeading";

export const metadata: Metadata = {
  title: "Travel Trade & Agents | Vista Chase",
  description:
    "For travel agents, hotel concierge desks and tour operators: small-group and private Canadian Rockies tours with hotel pickup and commercial access to Moraine Lake.",
  alternates: { canonical: "/affiliates" },
};

const AUDIENCES = [
  {
    icon: Building,
    title: "Hotel concierge desks",
    text: "Moraine Lake is closed to private vehicles; our tours and shuttles have commercial access. Guests are picked up at their hotel.",
    points: ["Pickup at more than 25 hotels in Banff, Canmore and Lake Louise", "Free cancellation up to 72 hours before", "Referral links with commission tracking"],
  },
  {
    icon: Briefcase,
    title: "Travel advisors",
    text: "Private tours for your clients only: a luxury SUV for up to 6 guests or an executive van for up to 13, on a route they choose.",
    points: ["Customizable private itineraries", "Multi-day packages of 2–7 days", "Quotes from our team, usually within a day"],
  },
  {
    icon: Route,
    title: "Tour operators",
    text: "Add Vista Chase days to Western Canada itineraries: Banff, Yoho, Jasper and the Icefields Parkway.",
    points: ["Shared tours capped at 12 guests", "Private departures for groups", "Group requests handled by our team"],
  },
];

export default function AffiliatesPage() {
  const agentPortalUrl = process.env.NEXT_PUBLIC_BOKUN_AGENT_PORTAL_URL || "https://vistachase.bokun.io/agent";

  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <section className="bg-obsidian-950 text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-page pb-16 pt-24 text-center sm:pb-20 sm:pt-28">
          <p className="mb-4 text-sm uppercase tracking-[0.22em] text-summit-300">Travel trade</p>
          <h1 className="text-balance text-4xl font-light leading-[1.1] tracking-tight text-white sm:text-6xl">Partner with Vista Chase</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-light leading-relaxed text-slate-300">
            For agents, hotel concierge desks and tour operators. Small-group and private Rockies days for your guests, ranked the #6
            experience in Canada by TripAdvisor (2025).
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/partners#apply" className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-7 text-base">
              Apply to partner
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href={agentPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 px-7 text-base text-white hover:bg-white/10"
            >
              Agent portal login
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </div>
      </section>

      <section aria-labelledby="who-heading" className="mx-auto max-w-7xl px-page py-20 sm:py-24">
        <SectionHeading id="who-heading" eyebrow="Who we work with" title="Built around your guests" />
        <ul className="grid gap-6 md:grid-cols-3" data-stagger>
          {AUDIENCES.map(({ icon: Icon, title, text, points }) => (
            <li key={title} className="flex flex-col rounded-[1.75rem] bg-white p-7 ring-1 ring-obsidian-900/[0.07]">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-summit-200 text-obsidian-900">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-xl font-light text-obsidian-900">{title}</h2>
              <p className="mt-2 text-base leading-relaxed text-slate-700">{text}</p>
              <ul className="mt-5 space-y-2 border-t border-obsidian-900/[0.06] pt-5 text-sm text-slate-700">
                {points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
                    {p}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="join-heading" className="bg-obsidian-950 text-white">
        <div className="mx-auto max-w-3xl px-page py-20 text-center sm:py-24">
          <SectionHeading
            id="join-heading"
            eyebrow="Get started"
            title="Apply in a few minutes"
            intro="Tell us about your hotel, agency or company through the partner application. Once approved you get your referral links and dashboard; for group or wholesale requests, talk to our team."
            tone="dark"
          />
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/partners#apply" className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-7 text-base">
              Go to the partner application
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/contact-us" className="inline-flex h-12 items-center rounded-full border border-white/25 px-7 text-base text-white hover:bg-white/10">
              Contact our team
            </Link>
          </div>
          <a href="tel:+18257349456" className="mt-8 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <Phone className="h-4 w-4 text-summit-300" aria-hidden="true" />
            +1 (825) 734-9456
          </a>
        </div>
      </section>
    </div>
  );
}
