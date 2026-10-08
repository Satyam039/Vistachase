// "Moraine Lake access" explainer (GetYourGuide / Viator "good to know" pattern): the problem in
// one line, how the shuttle solves it in three facts, then the CTA. Every fact is from the FAQ:
// the road closure, sunrise pickup window and season. Rating is the real catalog value.

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Ban, CalendarRange, ShieldCheck, Star, Sunrise } from "lucide-react";

const FACTS = [
  { icon: Ban, title: "No private cars", body: "Parks Canada has closed Moraine Lake Road to personal and rental vehicles." },
  { icon: Sunrise, title: "Sunrise at the lake", body: "Hotel pickups from about 4:45 a.m., so you're at the shore before first light." },
  { icon: CalendarRange, title: "While the lake is open", body: "Shuttles run from Banff and Canmore, roughly June to early October." },
];

export function PlanAheadGuaranteedAccess() {
  return (
    <section aria-labelledby="access-heading" className="overflow-hidden bg-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-page lg:grid-cols-12 lg:gap-16">
        <div className="relative lg:col-span-6">
          <div className="relative h-[26rem] overflow-hidden rounded-[2rem] sm:h-[36rem]" data-reveal="clip">
            <Image
              src="/media/site/about-image-1.webp"
              alt="Red canoes docked at Moraine Lake shoreline"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              data-parallax="10"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ocean-950/60 via-transparent to-transparent" />
          </div>
          <div className="absolute -bottom-6 right-4 flex max-w-xs items-center gap-3 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-obsidian-900/[0.06] sm:right-6" data-reveal="scale" data-reveal-delay="200">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-summit-100 text-obsidian-900">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm text-slate-600">Licensed commercial operator</span>
              <span className="block text-base text-obsidian-900">Guaranteed Moraine Lake access</span>
            </span>
          </div>
        </div>

        <div className="lg:col-span-6" data-reveal>
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">Plan ahead</p>
          <h2 id="access-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl">
            You can&apos;t drive to Moraine Lake. We can.
          </h2>
          <p className="mt-5 text-lg font-light leading-relaxed text-slate-600">
            Skip the parking and the shuttle lottery: we pick you up at your hotel in Banff or Canmore and drive you straight to the shoreline.
          </p>

          <ul className="mt-8 space-y-4" data-stagger>
            {FACTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ocean-50 text-ocean-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-base text-obsidian-900">{title}</span>
                  <span className="mt-0.5 block text-base leading-relaxed text-slate-600">{body}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href="/shuttles" className="golden-summit-btn group inline-flex h-12 items-center gap-2 rounded-full px-7 text-base">
              See shuttle times
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link href="/private-tours" className="text-base text-obsidian-900 underline decoration-summit-500 decoration-2 underline-offset-[6px] hover:text-ocean-700">
              Or go private
            </Link>
            <span className="flex items-center gap-1.5 text-sm text-slate-600">
              <Star className="h-4 w-4 fill-summit-500 text-summit-500" aria-hidden="true" />
              <span className="text-obsidian-900">5.0</span> from 1,000+ reviews
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
