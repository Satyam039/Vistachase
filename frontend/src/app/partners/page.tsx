// Partner program landing (GetYourGuide / Viator affiliate pages): hero, what partners get, who
// it's for, how it works, then the application form. The commission rate is set per partner
// (default 10%) in the partner record.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgePercent, Briefcase, ChevronRight, Hotel, Link2, LineChart, Megaphone } from "lucide-react";
import { PartnerApplyForm } from "@/components/partners/PartnerApplyForm";

export const metadata: Metadata = {
  title: "Partner Program | Earn on Banff Tours & Shuttles | Vista Chase",
  description: "Hotels, travel agents and creators earn commission on Vista Chase tours, shuttles and tickets booked through their link.",
  alternates: { canonical: "/partners" },
};

const BENEFITS = [
  { icon: BadgePercent, title: "Commission on bookings", text: "Earn 10% of every tour, shuttle and ticket booked through your links." },
  { icon: Link2, title: "Links to any page", text: "Share any tour or the whole site. Bookings within 30 days of a click count." },
  { icon: LineChart, title: "Your own dashboard", text: "See referred bookings, guests and earnings as they come in." },
];

const WHO = [
  { icon: Hotel, title: "Hotels and hosts", text: "A trusted way for guests to see Moraine Lake and the Icefields." },
  { icon: Briefcase, title: "Agents and tour desks", text: "Top-rated Rockies experiences with live availability." },
  { icon: Megaphone, title: "Creators and travel sites", text: "Turn your Banff guides into bookings." },
];

const STEPS = ["Apply below and get your referral code.", "Once approved, copy links from your dashboard and share them anywhere.", "Earn commission on bookings made within 30 days of a click."];

export default function PartnersPage() {
  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <section className="relative isolate flex min-h-[64vh] items-end overflow-hidden bg-ocean-950 text-white">
        <Image src="/media/photos/lake-louise-from-chateau.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover" data-parallax="10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/55 to-ocean-950/25" />
        <div className="mx-auto flex w-full flex-col items-center text-center max-w-7xl px-page pb-14 pt-24" data-scroll-fade>
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
                Partner program
              </li>
            </ol>
          </nav>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-6xl motion-safe:animate-[fadeUp_900ms_ease-out]">
            Recommend the Rockies. Earn on every booking.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-light leading-relaxed text-white/85 motion-safe:animate-[fadeUp_1100ms_ease-out]">
            For hotels, travel agents and creators. Share your link, your guests book top-rated tours and shuttles, and you earn commission.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 motion-safe:animate-[fadeUp_1300ms_ease-out]">
            <a href="#apply" className="golden-summit-btn inline-flex h-12 items-center rounded-full px-7 text-base">
              Apply now
            </a>
            <Link href="/partners/login" className="inline-flex h-12 items-center rounded-full border border-white/30 bg-white/10 px-7 text-base text-white backdrop-blur-md hover:bg-white/20">
              Partner sign in
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="benefits-heading" className="mx-auto max-w-7xl px-page py-20 sm:py-24">
        <div className="mx-auto mb-10 max-w-3xl text-center" data-reveal>
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">Why partner with us</p>
          <h2 id="benefits-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl">
            Simple links, real earnings
          </h2>
        </div>
        <ul className="grid gap-5 md:grid-cols-3" data-stagger>
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-[1.75rem] bg-white p-7 ring-1 ring-obsidian-900/[0.07]">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ocean-950 text-summit-400">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-6 text-2xl font-light text-obsidian-900">{title}</h3>
              <p className="mt-2 text-base font-light leading-relaxed text-slate-700">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="who-heading" className="bg-ocean-950 py-20 text-white sm:py-24">
        <div className="mx-auto max-w-7xl px-page">
          <h2 id="who-heading" className="mb-10 text-center text-3xl font-light tracking-tight text-white sm:text-4xl" data-reveal>
            Who it&rsquo;s for
          </h2>
          <ul className="grid gap-5 md:grid-cols-3" data-stagger>
            {WHO.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7">
                <Icon className="h-6 w-6 text-summit-400" aria-hidden="true" />
                <h3 className="mt-5 text-xl font-light text-white">{title}</h3>
                <p className="mt-2 text-base text-white/75">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="mx-auto max-w-7xl px-page py-20 sm:py-24">
        <h2 id="how-heading" className="mb-10 text-center text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl" data-reveal>
          How it works
        </h2>
        <ol className="grid gap-5 md:grid-cols-3" data-stagger>
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-4 rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-summit-200 text-obsidian-900" aria-hidden="true">
                {i + 1}
              </span>
              <span className="pt-1.5 text-base text-obsidian-900">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="apply" aria-labelledby="apply-heading" className="scroll-mt-32 border-t border-obsidian-900/[0.06] bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-page lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div data-reveal>
            <h2 id="apply-heading" className="text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">
              Apply to partner
            </h2>
            <p className="mt-4 text-lg font-light text-slate-700">
              Tell us a little about you. You&rsquo;ll get your referral code right away and can start sharing once we approve your account.
            </p>
            <p className="mt-4 text-base text-slate-700">
              Already a partner?{" "}
              <Link href="/partners/login" className="text-ocean-700 underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </div>
          <PartnerApplyForm />
        </div>
      </section>
    </div>
  );
}
