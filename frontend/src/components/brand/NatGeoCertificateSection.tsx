import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Award, CheckCircle } from "lucide-react";

export function NatGeoCertificateSection() {
  return (
    <section
      aria-labelledby="natgeo-certificate-heading"
      className="relative overflow-hidden bg-gradient-to-b from-white via-obsidian-50/60 to-white py-16 sm:py-24 border-b border-obsidian-900/[0.06]"
    >
      {/* Subtle luxury background elements */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(245,191,3,0.06),_transparent_60%)]" />

      <div className="mx-auto max-w-7xl px-page">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white border border-obsidian-900/10 shadow-[0_24px_64px_-24px_rgba(12,31,33,0.12)] p-8 sm:p-14 lg:p-16">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
            
            {/* Left Column: Official Certificate Visual */}
            <div className="flex justify-center lg:col-span-5">
              <div className="relative group w-full max-w-md">
                {/* Certificate frame with yellow accent reminiscent of National Geographic */}
                <div className="relative overflow-hidden rounded-2xl bg-white p-6 sm:p-8 shadow-xl ring-1 ring-obsidian-900/10 transition-transform duration-500 hover:scale-[1.01]">
                  <div className="flex flex-col items-center text-center">
                    {/* Nat Geo Luxury Collection Emblem */}
                    <div className="relative w-44 sm:w-56 h-48 sm:h-60 mb-4">
                      <Image
                        src="/media/brand/natgeo-luxury-collection-2026.png"
                        alt="National Geographic Traveller Luxury Collection 2026 Certificate"
                        fill
                        className="object-contain"
                        priority
                      />
                    </div>
                    
                    <div className="w-full border-t border-dashed border-obsidian-900/20 pt-4 mt-2">
                      <p className="font-serif text-lg tracking-wide text-obsidian-900 font-medium">
                        Vista Chase
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mt-1">
                        Featured in National Geographic Traveller (UK)
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Hotels • Experiences • Trends • Destinations • 2026
                      </p>
                    </div>
                  </div>
                </div>

                {/* Decorative gold badge pill */}
                <div className="absolute -bottom-3 -right-3 sm:-bottom-4 sm:-right-4 flex items-center gap-1.5 rounded-full bg-summit-500 px-4 py-1.5 text-xs font-semibold text-obsidian-950 shadow-md">
                  <Award className="h-4 w-4" aria-hidden="true" />
                  <span>Official 2026 Feature</span>
                </div>
              </div>
            </div>

            {/* Right Column: Narrative & Accreditation Details */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-summit-500/30 bg-summit-500/10 px-3.5 py-1 text-xs font-medium uppercase tracking-[0.2em] text-obsidian-900 mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-summit-500" />
                Global Travel Accreditation
              </div>

              <h2
                id="natgeo-certificate-heading"
                className="text-balance text-3xl font-light leading-[1.15] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl"
              >
                Featured in <span className="font-normal font-serif">National Geographic Traveller</span> Luxury Collection 2026
              </h2>

              <p className="mt-5 text-base sm:text-lg font-light leading-relaxed text-slate-600">
                Vista Chase has been officially featured in the prestigious{" "}
                <strong className="font-medium text-obsidian-900">
                  National Geographic Traveller (UK) Luxury Collection 2026
                </strong>
                —celebrating the highest standard of Canadian Rockies exploration, exceptional guest hospitality, and guaranteed private access across Banff, Lake Louise, and Moraine Lake.
              </p>

              {/* Trust validation points */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 rounded-2xl bg-obsidian-50/80 p-4 border border-obsidian-900/[0.04]">
                  <CheckCircle className="h-5 w-5 text-ocean-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-obsidian-900">Luxury Collection Curated</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Selected among top tier global journeys and Canadian experiences.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-obsidian-50/80 p-4 border border-obsidian-900/[0.04]">
                  <CheckCircle className="h-5 w-5 text-ocean-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-obsidian-900">TripAdvisor #6 In Canada</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Best of the Best 2026 award winner with 1,000+ 5-star guest reviews.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/banff-highlights-tour"
                  className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-medium"
                >
                  Book the award-winning tour
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>

                <Link
                  href="/private-tours"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-obsidian-900/20 bg-white px-6 text-sm text-obsidian-900 hover:bg-obsidian-50 transition-colors"
                >
                  Explore luxury private fleet
                </Link>
              </div>

            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
