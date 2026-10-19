import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Editorial "As featured in" section for the National Geographic Traveller (UK) Luxury Collection
 * 2026. It presents a magazine feature, nothing more: no certificate framing, seals, "accreditation"
 * or "conferred by" wording and no record number (owner's instruction, 2026-10-19), and no promise of
 * exclusive access to lakes or parks. The publication's own "As featured in" badge sits on the left;
 * the private-tour line and link follow the feature text.
 */
export function NatGeoFeatureSection() {
  return (
    <section aria-labelledby="natgeo-feature-heading" className="border-b border-obsidian-900/[0.06] bg-obsidian-50 py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-page md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <figure className="mx-auto w-full max-w-xs rounded-element bg-white p-8 shadow-low ring-1 ring-obsidian-900/[0.06] sm:max-w-sm sm:p-10" data-reveal="fade">
          <Image
            src="/media/brand/natgeo-luxury-collection-2026.png"
            alt="As featured in National Geographic Traveller Luxury Collection 2026"
            width={908}
            height={1024}
            sizes="(min-width: 768px) 320px, 260px"
            className="h-auto w-full"
          />
        </figure>

        <div className="text-center md:text-left" data-reveal="fade">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-600">As featured in</p>
          <h2 id="natgeo-feature-heading" className="mt-4 text-balance text-3xl font-light leading-[1.12] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl">
            National Geographic Traveller (UK)
            <span className="mt-2 block text-2xl text-slate-600 sm:text-3xl lg:text-4xl">Luxury Collection 2026</span>
          </h2>
          <p className="mt-6 text-pretty text-base leading-relaxed text-slate-700 sm:text-lg">
            Vista Chase is featured in the National Geographic Traveller (UK) Luxury Collection 2026.
          </p>

          <div className="mx-auto mt-8 h-px w-16 bg-summit-500 md:mx-0" aria-hidden="true" />

          <p className="mt-8 text-pretty text-base font-light leading-relaxed text-slate-700 sm:text-lg">
            Experience the Canadian Rockies through thoughtfully planned private tours, passionate local guides and personal
            attention throughout your journey.
          </p>
          <Link
            href="/private-tours"
            className="group mt-6 inline-flex min-h-11 items-center gap-2 text-base text-obsidian-900 underline decoration-obsidian-900/30 underline-offset-[6px] hover:decoration-obsidian-900"
          >
            Explore Private Tours
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
