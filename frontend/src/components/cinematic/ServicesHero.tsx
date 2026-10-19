"use client";

// Home hero, built on the pattern every booking site studied uses (GetYourGuide, Viator,
// Expedia, Project Expedition, Civitatis): full-bleed imagery and one centred column in three
// groups: the message (headline, intro and the trust lines the owner supplied), the experience
// switcher as plain text tabs (the selected one underlined) directly above the search, and under
// the search the selected experience's "from" offer, worked out from its tours' data
// (categoryOffer), with its link. Background, Rolls-Royce style: a full-screen clip plays automatically in a
// seamless loop under light, transparent overlays (the selected service's clip, else the house
// clip). The services' photos sit underneath as the fallback: they show on phones on data saver,
// with reduced motion, and whenever a clip fails to load.
//
// Carousel accessibility (WAI-ARIA carousel pattern, WCAG 2.2.2): motion is bounded instead of
// needing a pause button. Rotation makes one pass through the five services (~40s) and stops,
// stops for good as soon as the visitor picks a service, pauses while the pointer or keyboard
// focus is in the switcher, and never runs with reduced motion. The looping clip has its own
// visible Pause / Play button (WCAG 2.2.2) and never plays with reduced motion. The switcher is a
// tablist; the caption above it is the tabpanel, and changes are announced only when the visitor
// makes them.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Pause, Play, Star } from "lucide-react";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";
import { HeroSearch } from "@/components/home/HeroSearch";
import { money } from "@/lib/pricing";
import { SERVICES, type Service } from "@/lib/services";
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

/** Clip for services without one of their own, so the hero always has moving footage. */
const HOUSE_CLIP = SERVICES.find((s) => s.video)?.video;

/** Short switcher labels so all five fit one row. */
const TAB_LABEL: Record<string, string> = {
  shared: "Shared tours",
  private: "Private tours",
  shuttles: "Lake shuttles",
  multiday: "Multi-Day Journeys",
  tickets: "Activity tickets",
};

/** Trust lines under the intro, as supplied by Vista Chase (owner's copy, 2026-10-19). */
const TRUST_LINES = [
  { text: "1,700+ reviews across Tripadvisor, Google & GetYourGuide", stars: true },
  { text: "Featured in National Geographic Traveller", stars: false },
  { text: "TripAdvisor Best of the Best award-winning tour", stars: false },
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
  const [videoPaused, setVideoPaused] = useState(false);
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
  const clip = slide?.video ?? HOUSE_CLIP;

  return (
    <section
      aria-label="Vista Chase: tours in the Canadian Rockies"
      className="relative isolate flex min-h-[100vh] min-h-[100dvh] flex-col overflow-hidden bg-obsidian-950 text-white"
    >
      {/* Background: each service's photo cross-fades with a slow zoom; the active clip plays. */}
      <div className="absolute inset-0 -z-10">
        {items.map((s, i) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${i === index ? "opacity-100" : "opacity-0"}`}
          >
            <Image
              src={s.image}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className={`object-cover transition-transform duration-[9000ms] ease-out motion-reduce:transition-none ${
                i === index ? "scale-100" : "scale-110"
              }`}
            />
          </div>
        ))}
        {clip && (
          <AmbientVideo
            key={clip.src}
            src={clip.src}
            srcHd={clip.srcHd}
            poster={clip.poster}
            className="absolute inset-0 h-full w-full object-cover"
            paused={videoPaused}
          />
        )}
        {/* Transparent overlays: clear in the middle so the footage reads, a soft shade behind the
            headline and a deeper one at the foot for the switcher and search. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/70" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.3),transparent_70%)]" />
      </div>

      {/* The clip loops, so it gets a visible pause control (bottom left, clear of the concierge). */}
      {clip && !reducedMotion && (
        <button
          type="button"
          onClick={() => setVideoPaused((p) => !p)}
          aria-label={videoPaused ? "Play background video" : "Pause background video"}
          className="absolute bottom-4 left-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-md hover:bg-black/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-500"
        >
          {videoPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        </button>
      )}

      {/* Message, then the switcher sitting on the search, then the selected experience's offer. */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-page pb-10 pt-16 text-center sm:pt-20 sm:pb-12 lg:pt-24 lg:pb-14" data-scroll-fade>
        {/* 1 · Message */}
        <h1 className="max-w-5xl text-balance font-light text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.35)] motion-safe:animate-[fadeUp_900ms_ease-out]">
          <span className="block text-[clamp(2.375rem,7.5vw,4.25rem)] leading-[1.04] tracking-[-0.01em]">The Canadian Rockies.</span>
          <span className="mt-2 block text-[clamp(1.375rem,3.4vw,2.25rem)] leading-[1.15] text-white/90 sm:mt-3">
            Extraordinary Places. Exceptional Guides.
          </span>
        </h1>
        <p className="mt-5 max-w-3xl text-pretty text-base font-light leading-relaxed text-white/90 sm:mt-6 sm:text-lg [text-shadow:0_1px_12px_rgba(0,0,0,0.45)] motion-safe:animate-[fadeUp_1100ms_ease-out]">
          Discover Banff, Lake Louise, Moraine Lake and beyond with passionate local guides. Join a small-group tour with no
          more than 12 guests, enjoy a private journey, or explore the lakes with our convenient shuttles.
        </p>
        <ul
          aria-label="Reviews and recognition"
          className="mt-5 flex flex-col items-center gap-1 text-sm text-white sm:mt-6 sm:text-base [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] motion-safe:animate-[fadeUp_1200ms_ease-out]"
        >
          {TRUST_LINES.map(({ text, stars }) => (
            <li key={text} className="text-balance">
              {stars && (
                <span className="mr-2 inline-flex gap-0.5 align-[-0.125em]" role="img" aria-label="Five stars">
                  {Array.from({ length: 5 }).map((_, n) => (
                    <Star key={n} className="h-3.5 w-3.5 fill-summit-500 text-summit-500 sm:h-4 sm:w-4" aria-hidden="true" />
                  ))}
                </span>
              )}
              {text}
            </li>
          ))}
        </ul>

        {/* Switcher and search share one width; the tabs sit on the search's top edge. */}
        <div className="mt-8 w-full sm:mt-9 sm:max-w-4xl lg:mt-10">
          {/* 2 · Experience switcher: plain text tabs, the selected one underlined */}
          <div
            className="w-full"
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
              className="vc-rail -mx-page flex gap-6 overflow-x-auto px-page sm:mx-0 sm:gap-8 sm:overflow-visible sm:px-0 [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto"
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
                    className={`relative shrink-0 whitespace-nowrap pb-2.5 pt-1 text-sm transition-colors [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-summit-500 sm:text-base ${
                      on ? "text-white" : "text-white/70 hover:text-white"
                    }`}
                  >
                    {TAB_LABEL[s.id] ?? s.title}
                    {on && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white/45" aria-hidden="true">
                        <span
                          key={`${index}-${rotating}`}
                          className={`block h-full rounded-full bg-summit-500 ${rotating ? "animate-[heroProgress_8000ms_linear_forwards]" : "w-full"}`}
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 · Search */}
          <div className="mt-4 w-full rounded-[2rem] bg-white/10 p-1.5 shadow-2xl ring-1 ring-white/20 backdrop-blur-md motion-safe:animate-[fadeUp_1300ms_ease-out]">
            <HeroSearch className="w-full" category={pickedCategory} />
          </div>

          {/* The selected experience (tabpanel): its "from" offer and link, right under the search. */}
          <div
            id="services-hero-panel"
            role="tabpanel"
            aria-label={`${index + 1} of ${items.length}: ${TAB_LABEL[slide.id] ?? slide.title}`}
            aria-live={announce ? "polite" : "off"}
            className="mt-4 flex w-full flex-col items-center gap-1 text-sm text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] sm:text-base"
          >
            <div key={slide.id} className="flex flex-col items-center gap-1 motion-safe:animate-[fadeUp_600ms_ease-out]">
              {slide.offer ? (
                <>
                  <p className="text-white">
                    From <span className="text-lg sm:text-xl">CAD {money(slide.offer.from)}</span> {slide.offer.unit}
                    <span className="mx-2 text-white/50" aria-hidden="true">·</span>
                    <em className="not-italic text-white/80">Taxes included</em>
                  </p>
                  {slide.offer.inclusions.length > 0 && (
                    <p className="max-w-3xl text-balance text-white/80">
                      {/* Each item keeps its separator, so a wrapped line never starts with a dot. */}
                      {slide.offer.inclusions.map((item, n, all) => (
                        <Fragment key={item}>
                          <span className="whitespace-nowrap">{n < all.length - 1 ? `${item} ·` : item}</span>
                          {n < all.length - 1 && " "}
                        </Fragment>
                      ))}
                    </p>
                  )}
                  {slide.offer.maxGuests && <p className="text-white/80">Maximum {slide.offer.maxGuests} guests</p>}
                </>
              ) : (
                <p>Prices on request</p>
              )}
            </div>
            <Link href={slide.href} className="group inline-flex min-h-11 items-center gap-1.5 text-summit-300 underline decoration-summit-300/50 underline-offset-4 hover:decoration-summit-300">
              Explore {(TAB_LABEL[slide.id] ?? slide.title).toLowerCase()}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <p className="mt-5 text-base font-light text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] sm:mt-6 sm:text-lg">
          Explore more. We&rsquo;ll handle the details.
        </p>
      </div>
    </section>
  );
}
