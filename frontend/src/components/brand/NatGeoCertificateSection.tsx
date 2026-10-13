import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Award, CheckCircle, ShieldCheck, Sparkles } from "lucide-react";

/** Ornate vector corner flourish for classical certificate framing */
function CertificateCorner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer corner line */}
      <path
        d="M 3 41 V 12 C 3 7.029 7.029 3 12 3 H 41"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Inset dashed detail line */}
      <path
        d="M 9 41 V 16 C 9 12.134 12.134 9 16 9 H 41"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeDasharray="2.5 2.5"
      />
      {/* Corner accent diamond */}
      <path
        d="M 17 17 L 20 13 L 23 17 L 20 21 Z"
        fill="currentColor"
      />
      {/* Fine corner accent dots */}
      <circle cx="28" cy="9" r="1.25" fill="currentColor" />
      <circle cx="9" cy="28" r="1.25" fill="currentColor" />
    </svg>
  );
}

/** Subtle guilloche rosette watermark in the background of the certificate */
function CertificateRosette({ className }: { className?: string }) {
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
      {/* 16-point guilloche star starburst */}
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

export function NatGeoCertificateSection() {
  return (
    <section
      aria-labelledby="natgeo-certificate-heading"
      className="relative overflow-hidden bg-gradient-to-b from-[#fbfaf8] via-white to-[#f8f6f0] py-16 sm:py-24 border-b border-obsidian-900/[0.06]"
    >
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(212,175,55,0.08),transparent_70%)]" />

      <div className="mx-auto max-w-7xl px-page">
        {/* Certificate Outer Showcase Frame */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-[#fffefc] via-[#fcfaf5] to-[#f7f3e8] border-2 border-[#d4af37]/45 shadow-[0_30px_90px_-20px_rgba(15,23,42,0.18),0_0_0_1px_rgba(212,175,55,0.2),inset_0_0_0_1px_rgba(255,255,255,0.9),inset_0_2px_30px_rgba(212,175,55,0.09)] p-6 sm:p-12 lg:p-16">
          
          {/* Subtle Guilloche Watermark behind the certificate */}
          <CertificateRosette className="pointer-events-none absolute -right-24 -top-24 h-[440px] w-[440px] text-[#c99a32] opacity-[0.045] lg:opacity-[0.06]" />
          <CertificateRosette className="pointer-events-none absolute -left-28 -bottom-28 h-[400px] w-[400px] text-[#c99a32] opacity-[0.035] lg:opacity-[0.05]" />

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
            <CertificateCorner className="absolute top-2 left-2 h-7 w-7 sm:h-9 sm:w-9 text-summit-500/85" />
            <CertificateCorner className="absolute top-2 right-2 h-7 w-7 sm:h-9 sm:w-9 text-summit-500/85 rotate-90" />
            <CertificateCorner className="absolute bottom-2 right-2 h-7 w-7 sm:h-9 sm:w-9 text-summit-500/85 rotate-180" />
            <CertificateCorner className="absolute bottom-2 left-2 h-7 w-7 sm:h-9 sm:w-9 text-summit-500/85 -rotate-90" />
          </div>

          {/* Embossed Gold Medal / Wax Seal on Certificate Showcase (desktop & tablet) */}
          <div className="hidden sm:flex absolute top-10 right-10 lg:top-11 lg:right-12 z-10 flex-col items-center">
            {/* Dual ribbon tails hanging beneath medallion */}
            <div className="absolute top-14 flex gap-1 -z-10">
              <div className="w-3.5 h-8 bg-gradient-to-b from-[#c59a35] to-[#805b0e] shadow-sm [clip-path:polygon(0_0,100%_0,100%_100%,50%_75%,0_100%)]" />
              <div className="w-3.5 h-8 bg-gradient-to-b from-[#d4af37] to-[#8d6512] shadow-sm [clip-path:polygon(0_0,100%_0,100%_100%,50%_75%,0_100%)]" />
            </div>
            {/* Medallion disc with 3D gold bevel */}
            <div className="relative flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-full bg-gradient-to-br from-[#fdf0be] via-[#d4af37] to-[#8c610d] p-[3px] shadow-[0_10px_24px_-4px_rgba(180,130,20,0.45)] ring-2 ring-[#fcf2c5]">
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-dashed border-[#855f10]/40 bg-gradient-to-b from-[#fbe39d] to-[#c99a32] text-center shadow-inner">
                <Award className="h-5 w-5 text-[#523903]" />
                <span className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-wider text-[#473003] leading-none mt-0.5">
                  Accredited
                </span>
                <span className="font-serif text-[9.5px] sm:text-[10px] font-bold text-[#382602] leading-tight">
                  2026
                </span>
              </div>
            </div>
          </div>

          {/* Certificate Header Banner */}
          <div className="relative mb-6 sm:mb-12 flex items-center justify-center text-center">
            <div className="flex items-center gap-2 sm:gap-4 max-w-full">
              <span className="hidden sm:block h-px w-8 sm:w-16 lg:w-24 bg-gradient-to-r from-transparent to-[#c99a32]/70" />
              <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-medium uppercase tracking-[0.16em] sm:tracking-[0.24em] text-[#8e6817]">
                <Sparkles className="h-3 w-3 shrink-0 text-summit-500" />
                <span>Official Certificate of Excellence & Selection</span>
                <Sparkles className="h-3 w-3 shrink-0 text-summit-500" />
              </span>
              <span className="hidden sm:block h-px w-8 sm:w-16 lg:w-24 bg-gradient-to-l from-transparent to-[#c99a32]/70" />
            </div>
          </div>

          {/* Certificate Body Grid */}
          <div className="relative grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
            
            {/* Left Column: Official Certificate Visual Mounted Plaque */}
            <div className="flex justify-center lg:col-span-5">
              <div className="relative group w-full max-w-md">
                
                {/* Plaque matting / mounting frame */}
                <div className="relative overflow-hidden rounded-2xl bg-white p-6 sm:p-8 shadow-[0_16px_40px_-12px_rgba(12,31,33,0.14)] ring-1 ring-[#d4af37]/35 border border-obsidian-900/[0.04] transition-all duration-500 hover:shadow-[0_20px_50px_-12px_rgba(12,31,33,0.2)] hover:scale-[1.01]">
                  
                  {/* Subtle inner matting border */}
                  <div className="pointer-events-none absolute inset-2 rounded-xl border border-[#d4af37]/20 border-dashed" />

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
                    
                    <div className="w-full border-t border-dashed border-[#c99a32]/30 pt-4 mt-2">
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

                {/* Decorative gold badge pill on plaque */}
                <div className="absolute -bottom-3 -right-3 sm:-bottom-4 sm:-right-4 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-summit-500 to-[#d4af37] px-4 py-1.5 text-xs font-semibold text-obsidian-950 shadow-md ring-2 ring-white">
                  <ShieldCheck className="h-4 w-4 text-obsidian-950" aria-hidden="true" />
                  <span>Official 2026 Feature</span>
                </div>
              </div>
            </div>

            {/* Right Column: Narrative & Accreditation Details */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-summit-500/40 bg-summit-500/15 px-3.5 py-1 text-xs font-medium uppercase tracking-[0.2em] text-[#78570f] mb-4 shadow-sm">
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

              {/* Trust validation points styled like official seals */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 rounded-2xl bg-white/90 p-4 border border-[#d4af37]/25 shadow-sm">
                  <CheckCircle className="h-5 w-5 text-summit-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-obsidian-900">Luxury Collection Curated</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Selected among top tier global journeys and Canadian experiences.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-white/90 p-4 border border-[#d4af37]/25 shadow-sm">
                  <CheckCircle className="h-5 w-5 text-summit-600 shrink-0 mt-0.5" />
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
                  className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-medium shadow-md"
                >
                  Book the award-winning tour
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>

                <Link
                  href="/private-tours"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-obsidian-900/20 bg-white/80 px-6 text-sm text-obsidian-900 hover:bg-white transition-colors shadow-sm"
                >
                  Explore luxury private fleet
                </Link>
              </div>

            </div>

          </div>

          {/* Certificate Footer Verification Strip */}
          <div className="relative mt-10 sm:mt-12 pt-6 sm:pt-8 border-t border-[#d4af37]/25 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-summit-500 ring-4 ring-summit-500/20" />
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#825e11] font-medium">
                Accreditation Record No: NGT-VC-2026-CAN
              </span>
            </div>
            <p className="text-[11px] text-slate-500 text-center sm:text-right">
              Conferred by National Geographic Traveller (UK) • Verified Canadian Rockies Operator
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
