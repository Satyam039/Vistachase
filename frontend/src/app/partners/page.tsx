import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgePercent, Link2, LineChart, Hotel, Megaphone, Briefcase } from "lucide-react";
import { PartnerApplyForm } from "@/components/partners/PartnerApplyForm";

export const metadata: Metadata = {
  title: "Partner Program | Earn on Banff Tours & Shuttles | Vista Chase",
  description:
    "Hotels, travel agents and creators earn commission on every Vista Chase tour, shuttle and activity booked through their link. Apply in two minutes.",
  alternates: { canonical: "/partners" },
};

const BENEFITS = [
  { icon: BadgePercent, title: "Commission on every booking", text: "Earn 10% of every tour, shuttle and ticket booked through your links, paid monthly." },
  { icon: Link2, title: "Links for any page", text: "Share a link to any tour or the whole site. Bookings within 30 days of a click count." },
  { icon: LineChart, title: "Your own dashboard", text: "See referred bookings, guests and earnings as they happen." },
];

const WHO = [
  { icon: Hotel, title: "Hotels and hosts", text: "Give guests a trusted way to see Moraine Lake and the Icefields." },
  { icon: Briefcase, title: "Agents and tour desks", text: "Sell top-rated Rockies experiences with live availability." },
  { icon: Megaphone, title: "Creators and travel sites", text: "Turn your Banff guides into bookings." },
];

export default function PartnersPage() {
  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <section className="relative overflow-hidden bg-ocean-900 px-page pb-16 pt-24 text-white lg:min-h-[60vh] lg:flex lg:items-end">
        <Image src="/media/photos/lake-louise-from-chateau.webp" alt="" fill priority sizes="100vw" className="object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-ocean-950 via-ocean-950/70 to-ocean-950/30" />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-5">
          <p className="text-xs uppercase tracking-[0.24em] text-summit-300">Vista Chase partner program</p>
          <h1 className="max-w-3xl text-4xl font-light leading-[1.1] sm:text-6xl">Recommend the Rockies. Earn on every booking.</h1>
          <p className="max-w-2xl text-lg font-light text-slate-200">
            For hotels, travel agents and creators. Share your link, your guests book top-rated tours and shuttles, and you earn
            commission. Partner bookings flow through our Bokun booking system like every other channel.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#apply" className="golden-summit-btn inline-flex h-12 items-center rounded-md px-7 text-sm uppercase tracking-[0.14em]">
              Apply now
            </a>
            <Link href="/partners/login" className="inline-flex h-12 items-center rounded-md border border-white/30 bg-white/10 px-7 text-sm uppercase tracking-[0.14em] hover:bg-white/20">
              Partner sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-16 px-page py-20">
        <ul className="grid gap-6 md:grid-cols-3">
          {BENEFITS.map((b) => (
            <li key={b.title} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-7">
              <b.icon className="h-7 w-7 text-ocean-600" aria-hidden="true" />
              <h2 className="text-2xl font-light">{b.title}</h2>
              <p className="text-base text-slate-700">{b.text}</p>
            </li>
          ))}
        </ul>

        <div className="space-y-8">
          <h2 className="text-3xl font-light">Who it&apos;s for</h2>
          <ul className="grid gap-6 md:grid-cols-3">
            {WHO.map((w) => (
              <li key={w.title} className="flex gap-4">
                <w.icon className="mt-1 h-6 w-6 shrink-0 text-ocean-600" aria-hidden="true" />
                <span>
                  <span className="block text-xl font-light">{w.title}</span>
                  <span className="block text-base text-slate-700">{w.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl font-light">How it works</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {["Apply below. We review applications within two business days.", "Copy your links from the dashboard and share them anywhere.", "Earn commission on every booking made within 30 days of a click."].map((step, i) => (
              <li key={step} className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-6">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ocean-600 text-white" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="text-base text-slate-800">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div id="apply" className="scroll-mt-40 grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            <h2 className="text-3xl font-light">Apply to partner</h2>
            <p className="text-base text-slate-700">
              Tell us a little about you. You&apos;ll get your referral code straight away and can start sharing as soon as we approve
              your account.
            </p>
            <p className="text-base text-slate-700">
              Already a partner?{" "}
              <Link href="/partners/login" className="text-ocean-600 underline underline-offset-4">
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
