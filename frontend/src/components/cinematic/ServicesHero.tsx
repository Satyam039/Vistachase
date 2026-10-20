"use client";

// Home hero: a full-bleed, golden-hour photograph of the Rockies (one per experience, slow
// cross-fade and push-in) under a cinematic grade, with one centred, booking-focused column:
// a gold eyebrow, the two-line uppercase headline, a short intro, then a frosted search panel
// whose top edge carries the experience tabs (plain text, the selected one underlined in gold).
// Under the panel, the selected experience's "from" offer, worked out from its tours' data
// (categoryOffer), and at the foot a compact row of trust indicators with gold icons.
//
// Carousel accessibility (WAI-ARIA carousel pattern, WCAG 2.2.2): motion is bounded instead of
// needing a pause button. Rotation makes one pass through the experiences and stops, stops for
// good as soon as the visitor picks one, pauses while the pointer or keyboard focus is in the
// switcher, and never runs with reduced motion (nor does the push-in). The switcher is a tablist;
// the offer under the search is the tabpanel, announced only when the visitor makes a change.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, Newspaper, Star } from "lucide-react";
import { HeroSearch } from "@/components/home/HeroSearch";
import { money } from "@/lib/pricing";
import type { Service } from "@/lib/services";
import type { CategoryOffer } from "@/lib/tours";

export interface HeroTour {
  slug: string;
  title: string;
  rating: number;
  reviewCount: number;
  price: number;
  unit: string;
}

export interface HeroSlide extends Service {
  tours: HeroTour[];
  /** The category's "from" offer (null when none of its tours has a price yet). */
  offer: CategoryOffer | null;
}

const ROTATE_MS = 8000;

/**
 * Golden-hour stills for the hero, one per experience, chosen so the light sits low in the frame
 * and the darker ridgelines and sky carry the headline. Stills (not the service clips) so the
 * background supports the text rather than competing with it.
 */
const HERO_IMAGE: Record<string, { src: string; position: string }> = {
  shared: { src: "/media/photos/lake-louise-sunrise.webp", position: "50% 60%" },
  private: { src: "/media/photos/bow-lake-dock-sunrise.webp", position: "50% 55%" },
  shuttles: { src: "/media/photos/moraine-lake-perfect-reflection.webp", position: "50% 45%" },
  multiday: { src: "/media/photos/bow-lake-reflection.webp", position: "50% 50%" },
};

/** Short switcher labels so all five fit one row. */
const TAB_LABEL: Record<string, string> = {
  shared: "Shared tours",
  private: "Private tours",
  shuttles: "Lake shuttles",
  multiday: "Multi-Day Journeys",
  tickets: "Activity tickets",
};

/** Trust indicators at the foot of the hero, as supplied by Vista Chase (owner's copy, 2026-10-19). */
const TRUST = [
  { icon: Star, text: "1,700+ reviews across Tripadvisor, Google & GetYourGuide", stars: true },
  { icon: Newspaper, text: "Featured in National Geographic Traveller", stars: false },
  { icon: Award, text: "TripAdvisor Best of the Best award-winning tour", stars: false },
];

export function ServicesHero({ slides }: { slides: HeroSlide[] }) {
  const items = useMemo(
    () => slides.filter((s) => s.id !== "tickets" && s.category !== "TICKET"),
    [slides],
  );
  const [index, setIndex] = useState(0);
  // Rotation ends for good after one full pass, or as soon as the visitor picks a service.
  const [stopped, setStopped] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [announce, setAnnounce] = useState(false);
  // The search's Experience field follows the tab the visitor picks (never the automatic rotation).
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const rotating = !stopped && !hovering && !reducedMotion;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => {
      setAnnounce(false);
      setIndex((i) => {
        const next = (i + 1) % items.length;
        if (next === 0) setStopped(true); // back at the start: one pass done, rest here
        return next;
      });
    }, ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, index, items.length]);

  const go = useCallback(
    (next: number, focus = false) => {
      const i = (next + items.length) % items.length;
      setAnnounce(true);
      setStopped(true);
      setIndex(i);
      setPickedCategory(items[i]?.category ?? null);
      if (focus) tabRefs.current[i]?.focus();
    },
    [items],
  );

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1, true); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1, true); }
    if (e.key === "Home") { e.preventDefault(); go(0, true); }
    if (e.key === "End") { e.preventDefault(); go(items.length - 1, true); }
  };

  const slide = items[index] ?? items[0];

  return (
    <section
      aria-label="Vista Chase: tours in the Canadian Rockies"
      className="relative isolate flex min-h-[100vh] min-h-[100dvh] flex-col overflow-hidden bg-obsidian-950 text-white"
    >
      {/* Background: golden-hour stills cross-fade with a slow push-in, under a cinematic grade. */}
      <div className="absolute inset-0 -z-10">
        {items.map((s, i) => {
          const hero = HERO_IMAGE[s.id] ?? { src: s.image, position: "50% 50%" };
          return (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-[1600ms] ease-out ${i === index ? "opacity-100" : "opacity-0"}`}
            >
              <Image
                src={hero.src}
                alt=""
                fill
                priority={i === 0}
                quality={85}
                sizes="100vw"
                style={{ objectPosition: hero.position }}
                className={`object-cover transition-transform duration-[12000ms] ease-out motion-reduce:transition-none ${
                  i === index ? "scale-[1.06]" : "scale-100"
                }`}
              />
            </div>
          );
        })}
        {/* Grade: deep at the top for the header and headline, open through the middle so the lake
            glows, rich at the foot for the panel and trust row; a soft vignette frames it all. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-obsidian-950/60 via-obsidian-950/5 to-obsidian-950/80" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_42%,rgba(0,0,0,0.3),transparent_72%)]" />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_180px_rgba(0,0,0,0.4)]" />
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-page pb-4 pt-[calc(var(--vc-header-h,62px)+1rem)] text-center lg:pt-14" data-scroll-fade>
        {/* 1 · Message */}
        <p className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-summit-300 sm:tracking-[0.32em] motion-safe:animate-[fadeUp_700ms_ease-out]">
          <span className="hidden h-px w-8 bg-summit-300/70 sm:block" aria-hidden="true" />
          Explore more. We&rsquo;ll handle the details.
          <span className="hidden h-px w-8 bg-summit-300/70 sm:block" aria-hidden="true" />
        </p>
        <h1 className="mt-5 max-w-6xl text-balance uppercase text-white [text-shadow:0_4px_30px_rgba(0,0,0,0.45)] motion-safe:animate-[fadeUp_900ms_ease-out]">
          <span className="block text-[clamp(2.125rem,6.5vw,4.5rem)] font-light leading-[1.02] tracking-[0.06em]">The Canadian Rockies.</span>
          <span className="mx-auto mt-4 block h-px w-16 bg-gradient-to-r from-transparent via-summit-300 to-transparent sm:mt-5" aria-hidden="true" />
          <span className="mt-4 block text-[clamp(0.9375rem,2.1vw,1.375rem)] font-light leading-snug tracking-[0.22em] text-white/90 sm:mt-5">
            Extraordinary Places. Exceptional Guides.
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-sm font-light leading-relaxed text-white/80 sm:text-base [text-shadow:0_1px_12px_rgba(0,0,0,0.5)] motion-safe:animate-[fadeUp_1100ms_ease-out]">
          Discover Banff, Lake Louise, Moraine Lake and beyond with passionate local guides. Join a small-group tour with no
          more than 12 guests, enjoy a private journey, or explore the lakes with our convenient shuttles.
        </p>

        {/* 2 · Booking panel: experience tabs on its top edge, the search below them */}
        <div className="mt-9 w-full max-w-4xl rounded-[1.75rem] border border-white/15 bg-obsidian-950/35 p-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:mt-8 motion-safe:animate-[fadeUp_1300ms_ease-out]">
          <div
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onFocusCapture={() => setHovering(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovering(false);
            }}
          >
            <div
              role="tablist"
              aria-label="Tour categories"
              className="vc-rail flex gap-6 overflow-x-auto px-4 pt-1.5 sm:gap-9 sm:overflow-visible sm:px-6 [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto"
            >
              {items.map((s, i) => {
                const on = i === index;
                return (
                  <button
                    key={s.id}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls="services-hero-panel"
                    tabIndex={on ? 0 : -1}
                    onClick={() => go(i)}
                    onKeyDown={(e) => onTabKey(e, i)}
                    className={`relative shrink-0 whitespace-nowrap pb-3 pt-2 text-xs uppercase tracking-[0.16em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-500 sm:text-sm ${
                      on ? "text-white" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {TAB_LABEL[s.id] ?? s.title}
                    {on && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white/20" aria-hidden="true">
                        <span
                          key={`${index}-${rotating}`}
                          className={`block h-full rounded-full bg-summit-400 ${rotating ? "animate-[heroProgress_8000ms_linear_forwards]" : "w-full"}`}
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <HeroSearch className="mt-2 w-full" category={pickedCategory} />
        </div>

        {/* The selected experience (tabpanel): its "from" offer and link, right under the panel. */}
        <div
          id="services-hero-panel"
          role="tabpanel"
          aria-label={`${index + 1} of ${items.length}: ${TAB_LABEL[slide.id] ?? slide.title}`}
          aria-live={announce ? "polite" : "off"}
          className="mt-4 flex w-full max-w-4xl flex-col items-center gap-1 text-sm text-white/85 [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]"
        >
          <div key={slide.id} className="flex flex-col items-center gap-1 motion-safe:animate-[fadeUp_600ms_ease-out]">
            {slide.offer ? (
              <>
                <p className="flex flex-wrap items-baseline justify-center gap-x-2.5 text-white">
                  <span>
                    From <span className="text-lg text-summit-200 sm:text-xl">CAD {money(slide.offer.from)}</span> {slide.offer.unit}
                  </span>
                  <span className="text-summit-300/70" aria-hidden="true">·</span>
                  <span className="text-white/80">Taxes included</span>
                  {slide.offer.maxGuests && (
                    <>
                      <span className="text-summit-300/70" aria-hidden="true">·</span>
                      <span className="text-white/80">Maximum {slide.offer.maxGuests} guests</span>
                    </>
                  )}
                </p>
                {slide.offer.inclusions.length > 0 && (
                  <p className="max-w-3xl text-balance text-white/70">
                    {/* Each item keeps its separator, so a wrapped line never starts with a dot. */}
                    {slide.offer.inclusions.map((item, n, all) => (
                      <Fragment key={item}>
                        <span className="whitespace-nowrap">{n < all.length - 1 ? `${item} ·` : item}</span>
                        {n < all.length - 1 && " "}
                      </Fragment>
                    ))}
                  </p>
                )}
              </>
            ) : (
              <p>Prices on request</p>
            )}
          </div>
          <Link
            href={slide.href}
            className="group inline-flex min-h-11 items-center gap-1.5 text-summit-300 underline decoration-summit-300/40 underline-offset-4 hover:decoration-summit-300"
          >
            Explore {(TAB_LABEL[slide.id] ?? slide.title).toLowerCase()}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        {/* 3 · Trust indicators, compact, under the offer */}
        <ul
          aria-label="Reviews and recognition"
          className="mt-7 flex w-full max-w-5xl flex-col items-center gap-2 border-t border-summit-300/20 pt-5 text-xs text-white/85 sm:mt-8 sm:text-sm lg:flex-row lg:justify-center lg:gap-0 lg:text-xs [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]"
        >
          {TRUST.map(({ icon: Icon, text, stars }, i) => (
            <li
              key={text}
              className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center lg:flex-nowrap lg:whitespace-nowrap lg:px-5 ${i > 0 ? "lg:border-l lg:border-summit-300/30" : ""}`}
            >
              {stars ? (
                <span className="inline-flex gap-0.5" role="img" aria-label="Five stars">
                  {Array.from({ length: 5 }).map((_, n) => (
                    <Star key={n} className="h-3.5 w-3.5 fill-summit-400 text-summit-400" aria-hidden="true" />
                  ))}
                </span>
              ) : (
                <Icon className="h-4 w-4 shrink-0 text-summit-300" aria-hidden="true" />
              )}
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

    </section>
  );
}
