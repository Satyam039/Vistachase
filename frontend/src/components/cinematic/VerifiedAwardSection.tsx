// TripAdvisor Best of the Best 2026 award with the headline numbers. Numbers count up as they
// scroll into view (MotionRuntime, data-count-to); the final value is in the markup, so it is
// what screen readers, search engines and reduced-motion visitors get.
// Figures match the live site: 10,000+ travellers, 5.0 from 1,000+ reviews, #6 in Canada.

import Image from "next/image";
import { AwardSeal } from "@/components/brand/AwardSeal";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const STATS = [
  { to: 10000, suffix: "+", label: "travellers guided through the Rockies" },
  { to: 6, prefix: "#", label: "experience in Canada, TripAdvisor 2026" },
  { to: 5, decimals: 1, label: "average rating from our guests" },
  { to: 1000, suffix: "+", label: "verified reviews" },
];

const TRIPADVISOR_URL =
  "https://www.tripadvisor.ca/Attraction_Review-g154911-d26518659-Reviews-Vista_Chase-Banff_Banff_National_Park_Alberta.html";

export function VerifiedAwardSection() {
  return (
    <section aria-labelledby="award-heading" className="overflow-hidden bg-obsidian-50 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-page lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600" data-reveal>
            TripAdvisor Travellers&rsquo; Choice · Best of the Best 2026
          </p>
          <h2 id="award-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl" data-reveal>
            Ranked the #6 experience in all of Canada
          </h2>
          <p className="mt-6 max-w-2xl text-lg font-light leading-relaxed text-slate-600" data-reveal>
            Our shared Banff tour was named one of Canada&rsquo;s top 10 experiences in TripAdvisor&rsquo;s
            Best of the Best awards, chosen from traveller reviews. Fewer than 1% of the 8 million listings
            worldwide earn it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4" data-reveal>
            <Link href="/banff-highlights-tour" className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-7 text-base">
              Book the award-winning tour
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href={TRIPADVISOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border-b border-ocean-600 pb-0.5 text-base text-obsidian-900"
            >
              Read our TripAdvisor reviews
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </div>

        <div className="flex justify-center lg:col-span-5" data-reveal="scale">
          <div className="relative aspect-square w-full max-w-sm rounded-full bg-white p-12 shadow-[0_40px_80px_-40px_rgba(12,31,33,0.35)] ring-1 ring-obsidian-900/5">
            <AwardSeal className="absolute inset-0 p-12" />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[2rem] bg-obsidian-900/[0.07] lg:col-span-12 lg:grid-cols-4" data-stagger>
          {STATS.map((s) => {
            const final = `${s.prefix ?? ""}${s.to.toLocaleString("en-CA", { minimumFractionDigits: s.decimals ?? 0 })}${s.suffix ?? ""}`;
            return (
              <div key={s.label} className="flex flex-col-reverse items-center justify-end bg-white px-6 py-8 text-center sm:px-8">
                <dt className="mt-2 text-sm leading-snug text-slate-600">{s.label}</dt>
                <dd
                  className="text-4xl font-light tabular-nums text-obsidian-900 sm:text-5xl"
                  data-count-to={s.to}
                  data-count-prefix={s.prefix}
                  data-count-suffix={s.suffix}
                  data-count-decimals={s.decimals}
                >
                  {final}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
