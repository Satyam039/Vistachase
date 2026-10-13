import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Award, Compass, ShieldCheck, Sparkles, Star, Trophy, Users } from "lucide-react";
import { AwardSeal } from "@/components/brand/AwardSeal";

/** Ornate vector corner flourish for classical certificate / award showcase framing */
function AwardCorner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M 3 41 V 12 C 3 7.029 7.029 3 12 3 H 41"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M 9 41 V 16 C 9 12.134 12.134 9 16 9 H 41"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeDasharray="2.5 2.5"
      />
      <path
        d="M 17 17 L 20 13 L 23 17 L 20 21 Z"
        fill="currentColor"
      />
      <circle cx="28" cy="9" r="1.25" fill="currentColor" />
      <circle cx="9" cy="28" r="1.25" fill="currentColor" />
    </svg>
  );
}

/** Subtle guilloche rosette watermark in the background of the showcase */
function AwardRosette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.75" strokeDasharray="3 3" />
      <circle cx="100" cy="100" r="82" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="68" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 4" />
      <circle cx="100" cy="100" r="54" stroke="currentColor" strokeWidth="0.5" />
      {Array.from({ length: 16 }).map((_, i) => (
        <line
          key={i}
          x1="100"
          y1="18"
          x2="100"
          y2="182"
          stroke="currentColor"
          strokeWidth="0.5"
          transform={`rotate(${i * 11.25} 100 100)`}
        />
      ))}
      <circle cx="100" cy="100" r="28" stroke="currentColor" strokeWidth="1" />
      <polygon
        points="100,78 106,94 122,100 106,106 100,122 94,106 78,100 94,94"
        fill="currentColor"
      />
    </svg>
  );
}

const STATS = [
  {
    to: 10000,
    suffix: "+",
    label: "travellers guided through the Rockies",
    icon: Compass,
    badge: "10k+ Guests",
  },
  {
    to: 6,
    prefix: "#",
    label: "experience in Canada, TripAdvisor 2026",
    icon: Trophy,
    badge: "Top 10 Canada",
  },
  {
    to: 5,
    decimals: 1,
    label: "average rating from our guests",
    icon: Star,
    badge: "Flawless 5.0",
  },
  {
    to: 1000,
    suffix: "+",
    label: "verified 5-star reviews",
    icon: ShieldCheck,
    badge: "1,000+ Reviews",
  },
];

const TRIPADVISOR_URL =
  "https://www.tripadvisor.ca/Attraction_Review-g154911-d26518659-Reviews-Vista_Chase-Banff_Banff_National_Park_Alberta.html";

export function VerifiedAwardSection() {
  return (
    <section
      aria-labelledby="award-heading"
      className="relative overflow-hidden bg-gradient-to-b from-[#fbfaf8] via-white to-[#f8f6f0] py-16 sm:py-24 border-b border-obsidian-900/[0.06]"
    >
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(212,175,55,0.08),transparent_70%)]" />

      <div className="mx-auto max-w-7xl px-page">
        {/* Outer Award Showcase Frame */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-[#fffefc] via-[#fcfaf5] to-[#f7f3e8] border-2 border-[#d4af37]/45 shadow-[0_30px_90px_-20px_rgba(15,23,42,0.18),0_0_0_1px_rgba(212,175,55,0.2),inset_0_0_0_1px_rgba(255,255,255,0.9),inset_0_2px_30px_rgba(212,175,55,0.09)] p-6 sm:p-12 lg:p-16">
          
          {/* Guilloche Rosette Watermarks */}
          <AwardRosette className="pointer-events-none absolute -right-24 -top-24 h-[440px] w-[440px] text-[#c99a32] opacity-[0.045] lg:opacity-[0.06]" />
          <AwardRosette className="pointer-events-none absolute -left-28 -bottom-28 h-[400px] w-[400px] text-[#c99a32] opacity-[0.035] lg:opacity-[0.05]" />

          {/* Inset Outer Hairline Border */}
          <div
            className="pointer-events-none absolute inset-2 sm:inset-3.5 lg:inset-4 rounded-[2.1rem] border border-[#d4af37]/20"
            aria-hidden="true"
          />

          {/* Inset Inner Certificate Border with Classical Corner Accents */}
          <div
            className="pointer-events-none absolute inset-3.5 sm:inset-5 lg:inset-6 rounded-[1.9rem] border border-[#d4af37]/40 border-dashed sm:border-solid"
            aria-hidden="true"
          >
            {/* 4 Ornate Gold Certificate Corner Brackets */}
            <AwardCorner className="absolute top-2 left-2 h-7 w-7 sm:h-9 sm:w-9 text-summit-500/85" />
            <AwardCorner className="absolute top-2 right-2 h-7 w-7 sm:h-9 sm:w-9 text-summit-500/85 rotate-90" />
            <AwardCorner className="absolute bottom-2 right-2 h-7 w-7 sm:h-9 sm:w-9 text-summit-500/85 rotate-180" />
            <AwardCorner className="absolute bottom-2 left-2 h-7 w-7 sm:h-9 sm:w-9 text-summit-500/85 -rotate-90" />
          </div>

          {/* Top Showcase Banner */}
          <div className="relative mb-6 sm:mb-12 flex items-center justify-center text-center">
            <div className="flex items-center gap-2 sm:gap-4 max-w-full">
              <span className="hidden sm:block h-px w-8 sm:w-16 lg:w-24 bg-gradient-to-r from-transparent to-[#c99a32]/70" />
              <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-medium uppercase tracking-[0.16em] sm:tracking-[0.24em] text-[#8e6817]">
                <Sparkles className="h-3 w-3 shrink-0 text-summit-500" />
                <span>TripAdvisor Travellers&rsquo; Choice · Best of the Best 2026 Showcase</span>
                <Sparkles className="h-3 w-3 shrink-0 text-summit-500" />
              </span>
              <span className="hidden sm:block h-px w-8 sm:w-16 lg:w-24 bg-gradient-to-l from-transparent to-[#c99a32]/70" />
            </div>
          </div>

          {/* Main Showcase Grid */}
          <div className="relative grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
            
            {/* Left Column: Headline, Narrative & Proof Points */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-summit-500/40 bg-summit-500/15 px-3.5 py-1 text-xs font-medium uppercase tracking-[0.2em] text-[#78570f] mb-4 shadow-sm" data-reveal>
                <Trophy className="h-3.5 w-3.5 text-summit-600" />
                <span>Global Top 1% Excellence</span>
              </div>

              <h2
                id="award-heading"
                className="text-balance text-3xl font-light leading-[1.15] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl"
                data-reveal
              >
                Ranked the <span className="font-normal font-serif">#6 Experience</span> in all of Canada
              </h2>

              <p className="mt-5 text-base sm:text-lg font-light leading-relaxed text-slate-600" data-reveal>
                Our shared Banff tour was officially awarded one of Canada&rsquo;s top 10 experiences in TripAdvisor&rsquo;s
                prestigious <strong className="font-medium text-obsidian-900">Best of the Best Awards</strong>. Chosen directly from
                unfiltered traveller reviews, fewer than 1% of the 8 million listings worldwide earn this top-tier honour.
              </p>

              {/* Trust proof callout card */}
              <div className="mt-6 rounded-2xl bg-white/90 p-4 border border-[#d4af37]/25 shadow-sm flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-summit-500/15 text-summit-600">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#825e11]">
                    Unmatched Rockies Hospitality
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                    Over 1,000 verified 5-star ratings with guaranteed Moraine Lake access, luxury Mercedes fleet, and premier local guides.
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-4" data-reveal>
                <Link
                  href="/banff-highlights-tour"
                  className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-medium shadow-md"
                >
                  Book the award-winning tour
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href={TRIPADVISOR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-obsidian-900/20 bg-white/80 px-6 text-sm text-obsidian-900 hover:bg-white transition-colors shadow-sm"
                >
                  Read our TripAdvisor reviews
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
            </div>

            {/* Right Column: 3D Trophy Medallion Showcase */}
            <div className="flex justify-center lg:col-span-5" data-reveal="scale">
              <div className="relative group w-full max-w-sm">
                
                {/* Ribbon tails hanging under medallion */}
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex gap-2 z-0">
                  <div className="w-4 sm:w-5 h-10 sm:h-12 bg-gradient-to-b from-[#c59a35] to-[#78540a] shadow-md [clip-path:polygon(0_0,100%_0,100%_100%,50%_75%,0_100%)]" />
                  <div className="w-4 sm:w-5 h-10 sm:h-12 bg-gradient-to-b from-[#d4af37] to-[#8d6512] shadow-md [clip-path:polygon(0_0,100%_0,100%_100%,50%_75%,0_100%)]" />
                </div>

                {/* 3D Gold-Beveled Medallion Disc */}
                <div className="relative aspect-square w-full rounded-full bg-gradient-to-br from-[#ffffff] via-[#fcfbf7] to-[#f4eee0] p-8 sm:p-12 shadow-[0_30px_70px_-20px_rgba(180,130,20,0.35),0_0_0_2px_rgba(212,175,55,0.4),inset_0_0_0_4px_rgba(255,255,255,0.9),inset_0_0_30px_rgba(212,175,55,0.15)] ring-4 ring-[#fcf5d6] transition-transform duration-500 group-hover:scale-[1.02]">
                  {/* Inset dashed ring */}
                  <div className="pointer-events-none absolute inset-4 sm:inset-5 rounded-full border-2 border-dashed border-[#c59a35]/40" />
                  <AwardSeal className="relative z-10 h-full w-full" />
                </div>

                {/* Ribbon pill badge across the bottom of the medal */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-summit-500 via-[#d4af37] to-summit-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-obsidian-950 shadow-lg ring-2 ring-white">
                  <Award className="h-3.5 w-3.5" />
                  <span>Top 1% Worldwide</span>
                </div>

              </div>
            </div>

          </div>

          {/* 4 Showcase Proof Pillars / Pedestals */}
          <div className="relative mt-12 sm:mt-16 pt-10 sm:pt-12 border-t border-[#d4af37]/25">
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-stagger>
              {STATS.map((s) => {
                const final = `${s.prefix ?? ""}${s.to.toLocaleString("en-CA", { minimumFractionDigits: s.decimals ?? 0 })}${s.suffix ?? ""}`;
                const StatIcon = s.icon;
                return (
                  <div
                    key={s.label}
                    className="group relative flex flex-col items-center text-center rounded-2xl bg-white/95 p-6 sm:p-7 border border-[#d4af37]/25 shadow-sm transition-all duration-300 hover:shadow-md hover:border-[#d4af37]/50 hover:-translate-y-0.5"
                  >
                    {/* Top gold accent line on pedestal */}
                    <div className="absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-summit-500 to-transparent opacity-40 group-hover:opacity-100 transition-opacity" />

                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-summit-500/10 text-summit-600 group-hover:scale-110 transition-transform">
                      <StatIcon className="h-5 w-5" />
                    </div>

                    <dd
                      className="text-4xl font-light tabular-nums tracking-tight text-obsidian-900 sm:text-5xl"
                      data-count-to={s.to}
                      data-count-prefix={s.prefix}
                      data-count-suffix={s.suffix}
                      data-count-decimals={s.decimals}
                    >
                      {final}
                    </dd>

                    <dt className="mt-2 text-xs sm:text-sm leading-snug text-slate-600 font-light">
                      {s.label}
                    </dt>

                    <span className="mt-3 inline-block rounded-full bg-obsidian-50 px-2.5 py-0.5 text-[10px] font-medium text-[#7a5710] border border-obsidian-900/[0.04]">
                      {s.badge}
                    </span>
                  </div>
                );
              })}
            </dl>
          </div>

          {/* Certificate Verification Footer Strip */}
          <div className="relative mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-[#d4af37]/25 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-summit-500 ring-4 ring-summit-500/20" />
              <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-[#825e11] font-medium">
                Accreditation Record No: TA-BEST-2026-BANFF
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 text-center sm:text-right">
              Conferred by TripAdvisor • Ranked #6 Experience in Canada • 1,000+ Verified 5-Star Reviews
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
