import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgePercent, Building, CheckCircle2, ChevronRight, DollarSign, LineChart, Link2, Users } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";

export const metadata: Metadata = {
  title: "Affiliate Portal | Vista Chase",
  description: "Independent partner and affiliate portal for hotels, travel advisors and content creators.",
};

const BENEFITS = [
  {
    icon: BadgePercent,
    title: "Earn Top Commissions",
    text: "Earn commission on every verified tour, shuttle and ticket booking referred through your links.",
  },
  {
    icon: Link2,
    title: "Flexible Referral Links",
    text: "Generate links to any tour page, destination guide, or the homepage with our 30-day tracking window.",
  },
  {
    icon: LineChart,
    title: "Dedicated Partner Portal",
    text: "Independent portal to track referred clicks, live booking status, commission statements and payouts.",
  },
];

const AUDIENCES = [
  {
    icon: Building,
    title: "Hotels & Concierge Desks",
    text: "Guarantee your guests commercial access to Moraine Lake and Lake Louise with hotel pickup in Banff, Canmore and Lake Louise.",
  },
  {
    icon: Users,
    title: "Travel Advisors & Agents",
    text: "Book small-group tours capped at 12 guests and bespoke private luxury SUV journeys for your clients across Western Canada.",
  },
  {
    icon: DollarSign,
    title: "Creators & Publishers",
    text: "Monetize your Canadian Rockies travel guides with top-converting, TripAdvisor top-rated experiences.",
  },
];

export default function AffiliatePortalLanding() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-page py-4">
          <Link href="/affiliate" className="flex items-center gap-3">
            <BrandMark size={38} variant="dark" />
            <div className="flex flex-col">
              <span className="font-serif text-lg font-light tracking-wide text-slate-900">Vista Chase</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ocean-700">Affiliate Portal</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/affiliate/login"
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Partner Sign In
            </Link>
            <Link
              href="/affiliate/register"
              className="golden-summit-btn inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium"
            >
              Apply to Partner
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-obsidian-950 text-white py-20 px-page">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-summit-400">Vista Chase Partner Program</p>
          <h1 className="mt-4 text-4xl font-light tracking-tight text-white sm:text-6xl text-balance">
            Recommend the Rockies. Earn with every booking.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-light text-slate-300 leading-relaxed">
            Welcome to the Vista Chase Affiliate Portal. A dedicated workspace for hotels, travel advisors and publishers to access referral tools, attribution metrics, commission records and payouts.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/affiliate/login"
              className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-8 text-base font-medium"
            >
              Sign In to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/affiliate/register"
              className="inline-flex h-12 items-center rounded-full border border-white/30 bg-white/10 px-8 text-base font-medium text-white backdrop-blur hover:bg-white/20"
            >
              Apply to Partner
            </Link>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 px-page">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-ocean-50 text-ocean-700">
                  <b.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-medium text-slate-900">{b.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="bg-slate-100/70 py-16 px-page border-y border-slate-200">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-light text-slate-900">Who We Partner With</h2>
            <p className="mt-2 text-sm text-slate-600">Tailored solutions for local hospitality, global travel trade and creators.</p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div key={a.title} className="rounded-2xl bg-white p-7 border border-slate-200 shadow-sm">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-summit-50 text-summit-700">
                  <a.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-medium text-slate-900">{a.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portal Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-page text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Vista Chase Ltd. Partner & Affiliate Operations.</p>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-slate-800">Customer Website</Link>
            <Link href="/affiliate/login" className="hover:text-slate-800">Partner Login</Link>
            <Link href="/affiliate/register" className="hover:text-slate-800">Apply</Link>
            <Link href="/terms-and-conditions" className="hover:text-slate-800">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
