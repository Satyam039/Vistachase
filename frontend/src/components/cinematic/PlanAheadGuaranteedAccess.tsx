// "Plan ahead" explainer for the two lakes (GetYourGuide / Viator "good to know" pattern): the
// problem in one line, three facts, then the CTAs. Copy from the owner's "Update Vista Chase web"
// doc: Moraine Lake Road is closed to personal vehicles and Lake Louise parking is limited.

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Ban, BusFront, CircleParking, ShieldCheck } from "lucide-react";

const FACTS = [
  {
    icon: Ban,
    title: "Moraine Lake Requires Advance Planning",
    body: "Leave your personal or rental vehicle behind and visit with an authorised shuttle or tour operator.",
  },
  {
    icon: CircleParking,
    title: "Lake Louise Parking Is Limited",
    body: "Driving to the lake does not guarantee a parking space. A shuttle or guided tour takes the parking search out of your day.",
  },
  {
    icon: BusFront,
    title: "Let Vista Chase Handle the Journey",
    body: "Choose a lake shuttle or guided experience from Banff or Canmore, with transportation to the lakes arranged for you.",
  },
];

export function PlanAheadGuaranteedAccess() {
  return (
    <section aria-labelledby="access-heading" className="overflow-hidden bg-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-page lg:grid-cols-12 lg:gap-16">
        <div className="relative lg:col-span-6">
          <div className="relative h-[26rem] overflow-hidden rounded-none sm:h-[36rem]" data-reveal="clip">
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
          <div className="absolute -bottom-6 right-4 flex max-w-xs items-center gap-3 rounded-none bg-white p-4 shadow-xl ring-1 ring-obsidian-900/[0.06] sm:right-6" data-reveal="scale" data-reveal-delay="200">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-summit-100 text-obsidian-900">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm text-slate-600">Licensed commercial operator</span>
              <span className="block text-base text-obsidian-900">Lake transportation arranged for you</span>
            </span>
          </div>
        </div>

        <div className="lg:col-span-6" data-reveal>
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">Plan ahead. Enjoy the lakes.</p>
          <h2 id="access-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl">
            Two Iconic Lakes. A Little Planning Makes All the Difference.
          </h2>
          <p className="mt-5 text-lg font-light leading-relaxed text-slate-600">
            Moraine Lake Road is closed to personal vehicles, and parking at Lake Louise is limited during the busy season. Arrange your
            transportation well ahead of your visit so you can focus on the experience.
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
              Explore Lake Shuttles
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link href="/shared-tours" className="text-base text-obsidian-900 underline decoration-summit-500 decoration-2 underline-offset-[6px] hover:text-ocean-700">
              Explore Guided Tours →
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-600">Access arrangements may change. Check current requirements before travelling.</p>
        </div>
      </div>
    </section>
  );
}
