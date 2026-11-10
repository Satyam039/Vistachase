// FAQ / help centre: the owner's approved FAQ set (lib/faqs.ts), filterable by its nine categories.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, MessageCircle, Phone, Sparkles } from "lucide-react";
import { FaqBrowser, type FaqItem } from "@/components/faq/FaqBrowser";
import { FAQ_TOPICS, SITE_FAQS } from "@/lib/faqs";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";

const baseMetadata: Metadata = {
  title: "FAQ | Vista Chase Tours & Shuttles",
  description:
    "Answers about our tours, lake shuttles, pickups, payments and travel arrangements: cancellation, luggage, child seats, Moraine Lake access and more.",
  alternates: { canonical: "/faq" },
};

// Questions and topics: lib/faqs.ts (owner's FAQ document, 2026-11-10).
const FAQS: FaqItem[] = SITE_FAQS.map(({ topic, q, a }) => ({ topic, q, a }));
const TOPICS = FAQ_TOPICS;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function FAQPage() {
  return (
    <>
      <PageSeoExtras path="/faq" />
    <div className="bg-obsidian-50 text-obsidian-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section data-nav-hero className="relative isolate flex min-h-[48vh] items-end overflow-hidden bg-obsidian-950 text-white">
        <Image src="/media/photos/moraine-lake-classic.webp" alt="Moraine Lake in Banff National Park" fill priority sizes="100vw" className="-z-10 object-cover" data-parallax="10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/45 to-ocean-950/20" />
        <div className="mx-auto flex w-full flex-col items-center text-center max-w-7xl px-page pb-12 pt-[calc(var(--vc-nav-open-h,100px)+1.5rem)]" data-scroll-fade>
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
                FAQ
              </li>
            </ol>
          </nav>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-6xl motion-safe:animate-[fadeUp_900ms_ease-out]">
            How can we help?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-light leading-relaxed text-white/85 motion-safe:animate-[fadeUp_1100ms_ease-out]">
            Find answers about our tours, lake shuttles, pickups, payments and travel arrangements. For a request that needs advance confirmation, contact support@vistachase.com or call +1 (825) 734-9456.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-page py-14 sm:py-20">
        <FaqBrowser items={FAQS} topics={TOPICS} />

        {/* Still need help */}
        <section aria-labelledby="help-heading" className="mt-14 rounded-none bg-obsidian-950 p-7 text-white sm:p-9" data-reveal>
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
    </>
  );
}

export function generateMetadata(): Promise<Metadata> {
  return withSeo("/faq", baseMetadata);
}
