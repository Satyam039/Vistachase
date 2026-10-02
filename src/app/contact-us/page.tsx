import { MapPin, Phone, Mail, Clock, MessageSquare } from "lucide-react";
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <section className="bg-forest-950 text-white py-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto space-y-4">
          <span className="text-xs uppercase tracking-widest font-bold text-gold-400">We&apos;re Here to Help</span>
          <h1 className="text-3xl sm:text-5xl font-bold font-display text-white">
            Contact Vista Chase
          </h1>
          <p className="text-slate-300 max-w-2xl mx-auto text-base">
            Have questions about Moraine Lake road closures, pickup timing, or private SUV tours? Our local team is here 7 days a week.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Contact Info */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold font-display text-forest-950">Canadian Rockies Base</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Our operations office is located in Canmore, minutes from Banff National Park gates. We operate pickups across Canmore, Banff, and Lake Louise.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-forest-50 text-forest-800 shrink-0">
                <MapPin className="w-5 h-5 text-forest-700" />
              </div>
              <div className="text-sm">
                <p className="font-bold text-forest-950">Office Address</p>
                <p className="text-slate-600">121 Bow Meadows Crescent #110, Canmore, AB T1W 2W8, Canada</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-forest-50 text-forest-800 shrink-0">
                <Phone className="w-5 h-5 text-forest-700" />
              </div>
              <div className="text-sm">
                <p className="font-bold text-forest-950">Telephone</p>
                <a href="tel:+18257349456" className="text-slate-600 hover:text-gold-600 font-medium">
                  +1 (825) 734-9456
                </a>
                <p className="text-xs text-slate-500 mt-0.5">Lines open 6:00 AM - 9:00 PM Mountain Time</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-forest-50 text-forest-800 shrink-0">
                <Mail className="w-5 h-5 text-forest-700" />
              </div>
              <div className="text-sm">
                <p className="font-bold text-forest-950">Email Inquiries</p>
                <a href="mailto:info@vistachase.com" className="text-slate-600 hover:text-gold-600 font-medium">
                  info@vistachase.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
          <div>
            <h3 className="text-xl font-bold font-display text-forest-950">Send an Inquiry</h3>
            <p className="text-xs text-slate-500 mt-1">We typically reply within 2 business hours.</p>
          </div>

          <form className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                placeholder="Sarah Jenkins"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-forest-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Email Address</label>
              <input
                type="email"
                placeholder="sarah@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-forest-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Phone Number (Optional)</label>
              <input
                type="tel"
                placeholder="+1 (403) 555-0192"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-forest-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Message / Tour Inquiry</label>
              <textarea
                rows={4}
                placeholder="Inquiring about sunrise shuttle for 4 people on July 14..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-forest-800"
              />
            </div>

            <button
              type="button"
              className="w-full py-3 rounded-xl font-bold text-sm text-forest-950 gold-gradient hover:opacity-95 transition-opacity"
            >
              Submit Message
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
