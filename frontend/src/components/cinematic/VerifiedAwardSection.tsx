import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Compass, MessageSquareQuote, Sparkles, Star, Trophy, Users } from "lucide-react";

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

// Company-wide figures (supplied by Vista Chase), not counts for the award-winning tour alone.
const STATS = [
  { value: "15,000+", to: 15000, suffix: "+", label: "Guests guided through the Canadian Rockies", icon: Compass },
  { value: "1,700+", to: 1700, suffix: "+", label: "Reviews across Tripadvisor, Google & GetYourGuide", icon: MessageSquareQuote },
  { value: "5-Star", label: "Overall guest rating", icon: Star },
  { value: "Maximum 12", label: "Guests on shared tours", icon: Users },
];

/** A real guest review of the award-winning tour (from /api/reviews); nothing renders without one. */
export interface AwardQuote {
  authorName: string;
  body: string;
  rating: number;
}

const TRIPADVISOR_URL =
  "https://www.tripadvisor.ca/Attraction_Review-g154911-d26518659-Reviews-Vista_Chase-Banff_Banff_National_Park_Alberta.html";

export function VerifiedAwardSection({ quote }: { quote?: AwardQuote | null }) {
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

              {/* A real guest's words about this tour, with their name and where they wrote it */}
              {quote && (
                <figure className="mt-6 rounded-2xl border border-summit-500/25 bg-white/90 p-5 shadow-sm">
                  <div className="mb-2 flex gap-0.5" aria-label={`${quote.rating} out of 5 stars`} role="img">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < Math.round(quote.rating) ? "fill-summit-500 text-summit-500" : "text-slate-300"}`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <blockquote className="text-base font-light leading-relaxed text-obsidian-900">
                    &ldquo;{quote.body.length > 280 ? `${quote.body.slice(0, 277).trimEnd()}…` : quote.body}&rdquo;
                  </blockquote>
                  <figcaption className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
                    <span className="text-obsidian-900">{quote.authorName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <BadgeCheck className="h-4 w-4 text-ocean-600" aria-hidden="true" />
                      Verified Vista Chase booking
                    </span>
                  </figcaption>
                </figure>
              )}

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

            {/* Right Column: the official 2026 award badge, large and readable */}
            <div className="flex justify-center lg:col-span-5" data-reveal="scale">
              <Link
                href="/banff-highlights-tour"
                className="block w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_30px_70px_-25px_rgba(15,23,42,0.25)] ring-1 ring-summit-500/30 transition-transform duration-500 hover:scale-[1.02] sm:p-10"
              >
                <Image
                  src="/media/badges/tripadvisor-best-of-the-best-2026.png"
                  alt="Tripadvisor Travelers' Choice Best of the Best 2026 award for our shared Banff tour"
                  width={1000}
                  height={392}
                  sizes="(max-width: 640px) 90vw, 400px"
                  className="h-auto w-full"
                />
                <p className="mt-4 text-center text-sm uppercase tracking-[0.18em] text-obsidian-900">Best of the Best 2026</p>
              </Link>
            </div>

          </div>

          {/* 4 Showcase Proof Pillars / Pedestals */}
          <div className="relative mt-12 sm:mt-16 pt-10 sm:pt-12 border-t border-[#d4af37]/25">
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-stagger>
              {STATS.map((s) => {
                const StatIcon = s.icon;
                return (
                  <div
                    key={s.label}
                    className="group relative flex flex-col items-center text-center rounded-2xl bg-white/95 p-6 sm:p-7 border border-summit-500/25 shadow-sm transition-all duration-300 hover:shadow-md hover:border-summit-500/50 hover:-translate-y-0.5"
                  >
                    {/* Top gold accent line on pedestal */}
                    <div className="absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-summit-500 to-transparent opacity-40 group-hover:opacity-100 transition-opacity" />

                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-summit-500/10 text-summit-600 group-hover:scale-110 transition-transform">
                      <StatIcon className="h-5 w-5" />
                    </div>

                    <dd
                      className="whitespace-nowrap text-3xl font-light tabular-nums tracking-tight text-obsidian-900 sm:text-4xl"
                      {...(s.to ? { "data-count-to": s.to, "data-count-suffix": s.suffix } : {})}
                    >
                      {s.value}
                    </dd>

                    <dt className="mt-2 text-xs sm:text-sm leading-snug text-slate-600 font-light">
                      {s.label}
                    </dt>
                  </div>
                );
              })}
            </dl>
          </div>

        </div>
      </div>
    </section>
  );
}
