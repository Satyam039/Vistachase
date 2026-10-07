import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Briefcase,
  ExternalLink,
  CheckCircle2,
  Lock,
  Building,
  Mail,
  Phone,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Affiliate & Travel Trade Partner Portal | Vista Chase",
  description:
    "Official partner portal for travel agents, concierges, and wholesale tour operators. Bókun agent login, net rates, and guaranteed Moraine Lake commercial access.",
  alternates: {
    canonical: "/affiliates",
  },
};

export default function AffiliatesPage() {
  const bokunAgentPortalUrl =
    process.env.NEXT_PUBLIC_BOKUN_AGENT_PORTAL_URL ||
    "https://vistachase.bokun.io/agent";

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* 01. EDITORIAL HERO BANNER */}
      <section className="bg-ocean-950 text-white pt-28 pb-16 px-4 sm:px-6 lg:px-12 relative overflow-hidden border-b border-white/10">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-summit-300 text-xs font-semibold uppercase tracking-wider border border-white/15">
            <Briefcase className="w-4 h-4 text-summit-500" />
            <span>Travel Trade &amp; Concierge Network</span>
          </div>

          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl sm:text-6xl font-serif font-light tracking-tight text-white leading-[1.1]">
              Partner with Vista Chase
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-sans font-light">
              Elevate your guests&apos; Canadian Rockies itinerary. Access live wholesale availability,
              instant Bókun agent booking holds, and guaranteed commercial access to Moraine Lake and Lake Louise.
            </p>
          </div>
        </div>
      </section>

      {/* 02. BÓKUN AGENT ACCESS BOX & DIRECT LOGIN */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 -mt-8 relative z-10">
        <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200/90 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ocean-600">
              <Lock className="w-4 h-4" />
              <span>Bókun Verified System of Record</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-medium text-obsidian-900">
              Registered Partner &amp; Agent Login
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              If your agency or hotel concierge desk holds active credentials, log in directly via the
              Bókun Agent Booking Portal to reserve private SUVs and small-group seats at your contracted commission rate.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Real-time seat inventory
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Automatic voucher issuance
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> WhatsApp pickup notifications
              </span>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-3">
            <a
              href={bokunAgentPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-6 rounded-xl golden-summit-btn text-obsidian-900 text-sm font-semibold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg text-center"
            >
              <span>Access Bókun Portal</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <span className="text-[11px] text-center text-slate-400">
              Powered by TripAdvisor Bókun Agent Network
            </span>
          </div>
        </div>
      </section>

      {/* 03. PARTNERSHIP TIERS & BENEFITS */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-20 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs uppercase tracking-widest text-ocean-600 font-bold block">
            Why Partner With Vista Chase
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-light text-obsidian-900">
            Unrivaled Quality in the Rockies
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            TripAdvisor #6 Best Experience in Canada with guaranteed commercial access to restricted alpine lakes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-xl bg-ocean-50 text-ocean-600 flex items-center justify-center">
              <Building className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-medium text-obsidian-900">Hotel Concierge Desks</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Solve your guests&apos; #1 frustration: Moraine Lake parking closures. Provide instant, seamless reservations
              with doorstep pickup at Fairmont Banff Springs, Rimrock, Moose Hotel, and Canmore lodges.
            </p>
            <ul className="text-xs text-slate-700 space-y-2 pt-2 border-t border-slate-100">
              <li>• Direct commission tracking</li>
              <li>• Priority last-minute availability</li>
              <li>• 24/7 dedicated local dispatch</li>
            </ul>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-xl bg-summit-50 text-summit-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-medium text-obsidian-900">Travel Advisors &amp; OTAs</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Offer your luxury clients bespoke private SUV itineraries in GMC Yukon XL vehicles with certified interpretive
              guides, tailored pacing, and scenic gourmet stops.
            </p>
            <ul className="text-xs text-slate-700 space-y-2 pt-2 border-t border-slate-100">
              <li>• IATA / CLIA / Virtuoso friendly</li>
              <li>• Flexible net pricing tiers</li>
              <li>• Tailored custom multi-day quotes</li>
            </ul>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-medium text-obsidian-900">Tour Operators &amp; Wholesalers</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Integrate Vista Chase guaranteed departures into your broader Western Canada itineraries with full API integration,
              guaranteed group holds, and branded reporting.
            </p>
            <ul className="text-xs text-slate-700 space-y-2 pt-2 border-t border-slate-100">
              <li>• Bókun API &amp; Channel Manager</li>
              <li>• High-capacity Sprinter fleet</li>
              <li>• Full liability insurance &amp; park permits</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 04. NEW PARTNER REGISTRATION FORM */}
      <section className="bg-ocean-900 text-white py-20 px-4 sm:px-6 lg:px-12 border-t border-white/10">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs uppercase tracking-widest text-summit-400 font-bold block">
              Apply For Partnership
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-light text-white">
              Request Bókun Agent Credentials
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Fill in your agency details. Our partnerships team will review your application and issue
              your Bókun booking engine access within 24 business hours.
            </p>
          </div>

          <form
            action="/contact-us"
            method="GET"
            className="p-8 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="agency-name" className="text-xs uppercase tracking-wider text-slate-300 font-semibold block">
                  Agency / Hotel Name
                </label>
                <input
                  id="agency-name"
                  name="agency"
                  type="text"
                  required
                  placeholder="e.g. Fairmont Banff Springs Concierge"
                  className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-summit-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-name" className="text-xs uppercase tracking-wider text-slate-300 font-semibold block">
                  Lead Contact Name
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-summit-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="contact-email" className="text-xs uppercase tracking-wider text-slate-300 font-semibold block">
                  Business Email
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  placeholder="concierge@hotel.com"
                  className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-summit-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-phone" className="text-xs uppercase tracking-wider text-slate-300 font-semibold block">
                  Phone / WhatsApp
                </label>
                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  placeholder="+1 (403) 555-0199"
                  className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-summit-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="agency-type" className="text-xs uppercase tracking-wider text-slate-300 font-semibold block">
                Primary Business Focus
              </label>
              <select
                id="agency-type"
                name="type"
                className="w-full p-3 rounded-xl bg-ocean-950 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-summit-500"
              >
                <option value="concierge">Hotel Concierge / Guest Services Desk</option>
                <option value="advisor">Independent Luxury Travel Advisor</option>
                <option value="operator">Inbound Tour Operator / Wholesaler</option>
                <option value="corporate">Corporate / Incentive Group Organizer</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-4 rounded-xl golden-summit-btn text-obsidian-900 font-semibold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl hover:shadow-summit-500/20"
              >
                <span>Submit Partner Application</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-summit-400" />
              <span>Direct Trade Support: partnerships@vistachase.com</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-summit-400" />
              <span>Dispatcher Desk: +1 (825) 734-9456</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
