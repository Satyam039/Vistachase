// FAQ / help centre. Answers come from the live vistachase.com product pages (the catalog) and
// the original FAQ page; the cancellation answer follows the legal 72-hour policy.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, MessageCircle, Phone, Sparkles } from "lucide-react";
import { FaqBrowser, type FaqItem } from "@/components/faq/FaqBrowser";

export const metadata: Metadata = {
  title: "FAQ | Vista Chase Tours & Shuttles",
  description:
    "Answers on booking, the 72-hour cancellation policy, hotel pickups, Moraine Lake access, Parks Canada passes, what to bring and weather.",
  alternates: { canonical: "/faq" },
};

const TOPICS = ["Booking", "Pickup & access", "On the day", "Parks & seasons"];

const FAQS: FaqItem[] = [
  { topic: "Booking", q: "What is your cancellation policy?", a: "Cancel at least 72 hours before your tour for a full refund (groups of 1–6). For groups of 7 or more and multi-day trips, the 20% deposit is non-refundable and the rest is refunded. Cancellations within 72 hours, late arrivals and no-shows aren't refunded. Refunds take 5–10 business days; see our full cancellation policy." },
  { topic: "Booking", q: "How do I book and pay?", a: "Choose a date on the tour page and check out securely online; you'll get a confirmation email with your voucher. Your guide contacts you the day before with final pickup details." },
  { topic: "Booking", q: "Can a tour be customised?", a: "Shared tours follow a set route, so changes are limited. For your own stops and pace, request a private tour and we'll build the day around you." },
  { topic: "Booking", q: "How many people are in each group?", a: "Shared tours are capped at 12 guests per vehicle, so there's more time with your guide and more flexible photo stops." },
  { topic: "Pickup & access", q: "Can I drive my own or a rental car to Moraine Lake?", a: "No. Parks Canada has closed Moraine Lake Road to personal and rental vehicles. Licensed commercial operators like Vista Chase can still take you there directly." },
  { topic: "Pickup & access", q: "Do you offer doorstep pickup and drop-off?", a: "Yes, from most hotels in Banff and Canmore. If your accommodation is outside the pickup area, we'll confirm the nearest meeting point before your travel date. Use the hotel pickup finder to check yours." },
  { topic: "Pickup & access", q: "Where do you pick up in Banff, Canmore and Lake Louise?", a: "We pick up at more than 25 hotels and lodges, including Fairmont Banff Springs, Banff Caribou Lodge, Moose Hotel, Rimrock Resort, Coast Canmore Hotel and Lake Louise Inn. Staying in a rental? We'll arrange the closest safe boarding point." },
  { topic: "Pickup & access", q: "Do you run the Moraine Lake shuttle?", a: "Yes. Our shuttles run from Banff and Canmore while Moraine Lake is open, roughly June to early October." },
  { topic: "Pickup & access", q: "What time do the sunrise shuttles pick up?", a: "Usually between 4:45 and 5:15 a.m., depending on your hotel and that month's sunrise, so you reach Moraine Lake before first light on the Ten Peaks." },
  { topic: "On the day", q: "What should I bring?", a: "Comfortable walking shoes and layers, since mountain weather changes quickly. Bring a jacket, camera, sunscreen and a refillable water bottle. In winter, add warm waterproof layers, gloves and insulated boots." },
  { topic: "On the day", q: "Is lunch included?", a: "Lunch isn't included on full-day tours. Your guide plans a stop where you can choose from restaurants and cafés, and a water bottle is provided." },
  { topic: "On the day", q: "What if the weather changes?", a: "Tours run in most conditions; your guide may adjust stops for comfort and visibility. If Parks Canada closes a road, we'll offer a free reschedule or a full refund." },
  { topic: "On the day", q: "Are tours suitable for children and seniors?", a: "Yes. Walks at scenic stops are short and light to moderate, and guides pace the day for everyone in the group." },
  { topic: "Parks & seasons", q: "When is Moraine Lake open?", a: "Usually from June 1 to around October 10, depending on road and weather conditions. Outside those dates, tours visit Emerald Lake and the Natural Bridge instead." },
  { topic: "Parks & seasons", q: "Do I need a Parks Canada pass?", a: "Every visitor to Banff National Park needs a valid Parks Canada pass. Several of our tours include park entry (see What's included on the tour page); otherwise buy one online from Parks Canada or at the park gate." },
  { topic: "Parks & seasons", q: "What wildlife might we see?", a: "Elk, deer, bighorn sheep and mountain goats are common, and sometimes bears. Spring and fall mornings are often best. Sightings can't be guaranteed." },
  { topic: "Parks & seasons", q: "Can I tour in winter?", a: "Yes. From December to April our Winter Special visits frozen lakes, waterfalls and Abraham Lake's ice bubbles, with ice cleats and a heated vehicle." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function FAQPage() {
  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative isolate flex min-h-[48vh] items-end overflow-hidden bg-ocean-950 text-white">
        <Image src="/media/photos/moraine-lake-classic.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover" data-parallax="10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/60 to-ocean-950/20" />
        <div className="mx-auto w-full max-w-7xl px-page pb-12 pt-24" data-scroll-fade>
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-1.5 text-sm text-slate-200">
              <li>
                <Link href="/" className="hover:text-white hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-white">
                FAQ
              </li>
            </ol>
          </nav>
          <h1 className="max-w-3xl text-balance text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-6xl motion-safe:animate-[fadeUp_900ms_ease-out]">
            How can we help?
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-light leading-relaxed text-white/85 motion-safe:animate-[fadeUp_1100ms_ease-out]">
            Booking, pickups, Moraine Lake access, park passes and what to expect on the day.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-page py-14 sm:py-20">
        <FaqBrowser items={FAQS} topics={TOPICS} />

        {/* Still need help */}
        <section aria-labelledby="help-heading" className="mt-14 rounded-[1.75rem] bg-ocean-950 p-7 text-white sm:p-9" data-reveal>
          <h2 id="help-heading" className="text-2xl font-light text-white">
            Still need help?
          </h2>
          <p className="mt-2 text-base text-white/80">Our Canmore team and AI concierge are happy to answer anything else.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/concierge" className="golden-summit-btn inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Ask the concierge
            </Link>
            <Link href="/contact-us" className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm text-white hover:bg-white/10">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Send a message
            </Link>
            <a href="tel:+18257349456" className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm text-white hover:bg-white/10">
              <Phone className="h-4 w-4" aria-hidden="true" />
              +1 (825) 734-9456
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
