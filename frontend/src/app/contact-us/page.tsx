import { MapPin, Phone, Mail, Clock, MessageSquare, ShieldCheck, ChevronRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | Vista Chase Banff & Canmore HQ",
  description:
    "Get in touch with Vista Chase. Phone: +1-825-734-9456. Email: info@vistachase.com. Based in Canmore & Banff, Alberta.",
  alternates: {
    canonical: "/contact-us",
  },
};

export default function ContactUsPage() {
  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* 01. EDITORIAL HERO BANNER */}
      <section className="bg-ocean-900 text-white pt-24 pb-16 px-4 sm:px-6 lg:px-12 text-center relative overflow-hidden border-b border-white/10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-summit-300 text-xs font-semibold uppercase tracking-wider border border-white/15">
            <MessageSquare className="w-3.5 h-3.5 text-summit-500" />
            <span>Canadian Rockies Concierge Base</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-light font-serif tracking-tight text-white leading-[1.1]">
            Contact Vista Chase
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-sans max-w-2xl mx-auto">
            Have questions about Moraine Lake road closures, pickup timing, or custom private SUV charters? Our local
            team is here 7 days a week.
          </p>
        </div>
      </section>

      {/* 02. CONTACT INFORMATION & FORM */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-16 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Contact Info (5 Cols) */}
        <div className="lg:col-span-5 space-y-8">
          <div className="space-y-3">
            <span className="text-xs uppercase tracking-widest text-ocean-600 font-bold">Bow Valley Headquarters</span>
            <h2 className="text-2xl sm:text-3xl font-serif font-light text-obsidian-900">
              Based in Canmore &amp; Banff, Alberta
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Our operations office is located in Canmore, minutes from the Banff National Park gates. We operate
              daily departures across Canmore, Banff, and Lake Louise.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-ocean-900 text-summit-300 shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="text-sm space-y-1">
                <p className="font-bold text-obsidian-900">Office Address</p>
                <p className="text-slate-600 text-xs sm:text-sm">
                  121 Bow Meadows Crescent #110, Canmore, AB T1W 2W8, Canada
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-ocean-900 text-summit-300 shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div className="text-sm space-y-1">
                <p className="font-bold text-obsidian-900">Telephone Support</p>
                <a href="tel:+18257349456" className="text-ocean-600 hover:underline font-semibold block text-base">
                  +1 (825) 734-9456
                </a>
                <p className="text-xs text-slate-500">Lines open 6:00 AM – 9:00 PM Mountain Time</p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-ocean-900 text-summit-300 shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="text-sm space-y-1">
                <p className="font-bold text-obsidian-900">Email Concierge</p>
                <a href="mailto:info@vistachase.com" className="text-ocean-600 hover:underline font-semibold block text-base">
                  info@vistachase.com
                </a>
                <p className="text-xs text-slate-500">Fast response within 2 business hours</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-lg space-y-6">
            <div className="space-y-1 border-b border-slate-100 pb-5">
              <h3 className="text-2xl font-serif font-light text-obsidian-900">Send a Direct Message</h3>
              <p className="text-xs text-slate-500">
                Reach our local Bow Valley tour specialists for advice, group inquiries, or custom itineraries.
              </p>
            </div>

            <form className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="app-contact-us-full-name" className="text-xs font-bold uppercase tracking-wider text-slate-700">Full Name</label>
                  <input id="app-contact-us-full-name" autoComplete="name"
                    type="text"
                    placeholder="Sarah Jenkins"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="app-contact-us-email-address" className="text-xs font-bold uppercase tracking-wider text-slate-700">Email Address</label>
                  <input id="app-contact-us-email-address" autoComplete="email"
                    type="email"
                    placeholder="sarah@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="app-contact-us-phone-number-optional" className="text-xs font-bold uppercase tracking-wider text-slate-700">Phone Number (Optional)</label>
                <input id="app-contact-us-phone-number-optional" autoComplete="tel"
                  type="tel"
                  placeholder="+1 (403) 555-0192"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="app-contact-us-message-tour-inquiry" className="text-xs font-bold uppercase tracking-wider text-slate-700">Message / Tour Inquiry</label>
                <textarea id="app-contact-us-message-tour-inquiry"
                  rows={4}
                  placeholder="Inquiring about private sunrise tour for 4 guests on July 14..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>

              <button
                type="button"
                className="w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest text-obsidian-900 golden-summit-btn shadow-lg transition-all"
              >
                Submit Inquiry to Concierge
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
