import { ChevronDown, HelpCircle, ShieldCheck } from "lucide-react";
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
    q: "Can I drive my own car to Moraine Lake?",
    a: "No. Parks Canada has permanently closed Moraine Lake Road to personal and rental vehicles. Only authorized commercial tour and shuttle operators like Vista Chase are permitted through the checkpoint.",
  },
  {
    q: "Where do you pick up in Banff and Canmore?",
    a: "We offer complimentary round-trip pickups directly at over 25 hotels in Banff, Canmore, and Lake Louise—including Fairmont Banff Springs, Banff Caribou Lodge, Moose Hotel, Rimrock Resort, Malcolm Hotel Canmore, Coast Canmore Hotel, and Lake Louise Inn. You can also meet us at the Banff Train Station public parking lot.",
  },
  {
    q: "What is your cancellation and refund policy?",
    a: "We offer 100% full refunds on cancellations made at least 48 hours prior to your scheduled departure. For private tours, cancellations made 72 hours prior receive a full refund.",
  },
  {
    q: "Do I need a Parks Canada Discovery Pass?",
    a: "Yes, all visitors entering Banff National Park must have a valid Parks Canada Pass. You can purchase one upon entering the park or add our Parks Canada Pass Assistance add-on during checkout, and our team will have it ready for your vehicle.",
  },
  {
    q: "What happens if it rains or snows?",
    a: "Tours operate rain, shine, or snow! Mountain weather changes rapidly and creates dramatic misty vistas. In the rare event of extreme road closure by Parks Canada (e.g. avalanche control), you will be given the choice between a free reschedule or a 100% full refund.",
  },
  {
    q: "What time does the Sunrise Shuttle depart?",
    a: "Sunrise shuttles typically pick up between 4:45 AM and 5:15 AM depending on your hotel and sunrise timing for that month. We arrive at Moraine Lake with plenty of time to walk up the Rockpile before first light strikes the Ten Peaks.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <section className="bg-forest-950 text-white py-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto space-y-4">
          <span className="text-xs uppercase tracking-widest font-bold text-gold-400">Clear Answers</span>
          <h1 className="text-3xl sm:text-5xl font-bold font-display text-white">
            Frequently Asked Questions
          </h1>
          <p className="text-slate-300 max-w-2xl mx-auto text-base">
            Everything you need to know about planning your Canadian Rockies journey with Vista Chase.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1 w-full space-y-6">
        {FAQS.map((faq, index) => (
          <div
            key={index}
            className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5"
          >
            <h2 className="text-lg font-bold text-forest-950 flex items-start gap-2.5">
              <HelpCircle className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
              <span>{faq.q}</span>
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed pl-7.5">{faq.a}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
