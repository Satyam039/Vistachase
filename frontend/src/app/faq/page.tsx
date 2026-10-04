import { HelpCircle, ChevronRight, ShieldCheck, Clock } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Vista Chase Shuttles & Tours",
  description:
    "Everything you need to know about Moraine Lake vehicle restrictions, Banff hotel pickups, cancellation policies, weather, and National Park Discovery passes.",
  alternates: {
    canonical: "/faq",
  },
};

const FAQS = [
  {
    q: "Can I drive my personal or rental car to Moraine Lake?",
    a: "No. Parks Canada has permanently closed Moraine Lake Road to personal and rental vehicles to protect the fragile alpine corridor. Authorized commercial tour and shuttle operators like Vista Chase are the only guaranteed direct vehicle route without competing in crowded public lotteries.",
  },
  {
    q: "Where do you pick up in Banff, Canmore, and Lake Louise?",
    a: "We offer complimentary round-trip pickups directly at over 25 premier hotels and lodges—including Fairmont Banff Springs, Banff Caribou Lodge, Moose Hotel, Rimrock Resort, Malcolm Hotel Canmore, Coast Canmore Hotel, and Lake Louise Inn. If staying at an Airbnb, we arrange the closest safe boarding point.",
  },
  {
    q: "What is your cancellation and refund guarantee?",
    a: "We offer 100% full refunds on cancellations made at least 48 hours prior to your scheduled departure time. For private SUV tours, cancellations made 72 hours prior receive a complete 100% refund with zero penalties.",
  },
  {
    q: "Do I need a Parks Canada Discovery Pass?",
    a: "Yes, all visitors entering Banff National Park must have a valid Parks Canada Pass. You can purchase one upon entering the national park gate or online via Parks Canada before your tour date.",
  },
  {
    q: "What happens in case of mountain rain or snow?",
    a: "Tours operate in all safe mountain conditions—rain, sunshine, or fresh alpine snow! Weather in the Rockies shifts quickly and creates stunning moody mountain photography. In the rare event of severe road closure by Parks Canada, you will receive an immediate free reschedule or 100% full refund.",
  },
  {
    q: "What time do the Sunrise Shuttles depart?",
    a: "Sunrise shuttles typically pick up between 4:45 AM and 5:15 AM depending on your hotel and sunrise timing for that month. We arrive at Moraine Lake with plenty of time to ascend the Rockpile before first light strikes the Ten Peaks.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* 01. EDITORIAL HERO BANNER */}
      <section className="bg-ocean-900 text-white pt-24 pb-16 px-4 sm:px-6 lg:px-12 text-center relative overflow-hidden border-b border-white/10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-summit-300 text-xs font-semibold uppercase tracking-wider border border-white/15">
            <HelpCircle className="w-3.5 h-3.5 text-summit-500" />
            <span>Guest Information &amp; Advice</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-light font-serif tracking-tight text-white leading-[1.1]">
            Frequently Asked Questions
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-sans max-w-2xl mx-auto">
            Everything you need to know about planning your Canadian Rockies journey, Parks Canada permits, and
            guaranteed Moraine Lake access.
          </p>
        </div>
      </section>

      {/* 02. FAQ LIST */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-12 py-16 space-y-6">
        {FAQS.map((faq, index) => (
          <div
            key={index}
            className="p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-3 hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-serif font-medium text-obsidian-900 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-ocean-500/15 text-ocean-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-sans">
                Q
              </span>
              <span>{faq.q}</span>
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed pl-9">{faq.a}</p>
          </div>
        ))}

        {/* Support Help Banner */}
        <div className="mt-12 p-8 rounded-3xl bg-ocean-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6 border border-white/10">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest text-summit-300 font-bold">Have a specific question?</span>
            <h3 className="text-xl font-serif font-light text-white">Our Banff concierge team is ready to help</h3>
          </div>
          <Link
            href="/contact-us"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-obsidian-900 golden-summit-btn shrink-0"
          >
            <span>Contact Concierge</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
