"use client";

// Home hero, built on the pattern every booking site studied uses (GetYourGuide, Viator,
// Expedia, Project Expedition, Civitatis): full-bleed imagery and one centred column in three
// groups: the message, the search (with the booking promises as its footer) and an experience
// switcher (each with its "from" price) whose selected item shows its line and link. The five
// Vista Chase services rotate behind it (slow cross-fade with a gentle zoom, clips where they exist).
//
// Carousel accessibility (WAI-ARIA carousel pattern, WCAG 2.2.2): motion is bounded instead of
// needing a pause button. Rotation makes one pass through the five services (~40s) and stops,
// stops for good as soon as the visitor picks a service, pauses while the pointer or keyboard
// focus is in the switcher, and never runs with reduced motion; the clip pauses when it stops. The switcher is a tablist; the caption above it is the tabpanel, and
// changes are announced only when the visitor makes them.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarCheck, MapPin, MountainSnow, Star } from "lucide-react";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";
import { HeroSearch } from "@/components/home/HeroSearch";
import { hasPrice, money } from "@/lib/pricing";
import type { Service } from "@/lib/services";

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
}

const ROTATE_MS = 8000;

/** Short switcher labels so all five fit one row. */
const TAB_LABEL: Record<string, string> = {
  shared: "Shared tours",
  private: "Private tours",
  shuttles: "Lake shuttles",
  multiday: "Multi-day trips",
  tickets: "Activity tickets",
};

/** "Why choose a shared tour? Small groups, big days out." → "Small groups, big days out." */
const shortTagline = (tagline: string) => tagline.split("? ").pop() ?? tagline;

export function ServicesHero({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  // Rotation ends for good after one full pass, or as soon as the visitor picks a service.
  const [stopped, setStopped] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [announce, setAnnounce] = useState(false);
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
        const next = (i + 1) % slides.length;
        if (next === 0) setStopped(true); // back at the start: one pass done, rest here
        return next;
      });
    }, ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, index, slides.length]);

  const go = useCallback(
    (next: number, focus = false) => {
      const i = (next + slides.length) % slides.length;
      setAnnounce(true);
      setStopped(true);
      setIndex(i);
      if (focus) tabRefs.current[i]?.focus();
    },
    [slides.length],
  );

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1, true); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1, true); }
    if (e.key === "Home") { e.preventDefault(); go(0, true); }
    if (e.key === "End") { e.preventDefault(); go(slides.length - 1, true); }
  };

  // Lowest real price per service for the switcher ("From $99").
  const fromPrices = useMemo(
    () =>
      slides.map((s) => {
        const priced = s.tours.filter((t) => hasPrice(t.price));
        return priced.length ? Math.min(...priced.map((t) => t.price)) : null;
      }),
    [slides],
  );

  const slide = slides[index];

  return (
    <section
      aria-label="Vista Chase: tours in the Canadian Rockies"
      className="relative isolate flex min-h-[max(42rem,calc(100svh-var(--vc-header-h,80px)))] flex-col overflow-hidden bg-obsidian-950 text-white"
    >
      {/* Background: each service's photo cross-fades with a slow zoom; the active clip plays. */}
      <div className="absolute inset-0 -z-10">
        {slides.map((s, i) => (
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
        {slide.video && (
          <AmbientVideo
            key={slide.id}
            src={slide.video.src}
            srcHd={slide.video.srcHd}
            poster={slide.video.poster}
            className="absolute inset-0 h-full w-full object-cover"
            paused={stopped}
          />
        )}
        {/* Scrims: soft at the top, centre darkened for the headline, strong at the foot. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ocean-950/45 via-ocean-950/30 to-ocean-950/85" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,19,20,0.45),transparent_75%)]" />
      </div>

      {/* One centred column in three groups with even spacing (GetYourGuide / Airbnb hero
          hierarchy): 1 message (proof chip, headline, one line), 2 action (search with the three
          booking promises as its footer, one frosted unit), 3 explore (experience switcher with
          the selected one's line and link). Bottom padding keeps the floating concierge button
          clear of the switcher. */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-page pb-10 pt-12 text-center sm:pt-16 lg:pb-24" data-scroll-fade>
        {/* 1 · Message */}
        <a
          href="#reviews-heading"
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs text-white sm:px-4 sm:text-sm backdrop-blur-md hover:bg-white/15 motion-safe:animate-[fadeUp_700ms_ease-out]"
        >
          <Star className="h-3.5 w-3.5 fill-summit-500 text-summit-500 sm:h-4 sm:w-4" aria-hidden="true" />
          5.0<span className="sr-only"> out of 5</span> · 1,000+ reviews
          <span className="hidden text-white/50 sm:inline" aria-hidden="true">
            |
          </span>
          <span className="hidden sm:inline">#6 experience in Canada</span>
        </a>
        <h1 className="mt-5 max-w-6xl text-balance text-[clamp(2.25rem,9.5vw,2.75rem)] font-light leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl motion-safe:animate-[fadeUp_900ms_ease-out]">
          The Canadian Rockies, your way
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-base font-light leading-relaxed text-white/90 sm:mt-4 sm:text-lg lg:text-xl [text-shadow:0_1px_12px_rgba(0,0,0,0.45)] motion-safe:animate-[fadeUp_1100ms_ease-out]">
          Small-group tours, private journeys and guaranteed lake shuttles from Banff and Canmore.
        </p>

        {/* 2 · Action: search + promises as one frosted unit */}
        <div className="mt-9 w-full max-w-4xl rounded-[2.25rem] bg-white/10 p-1.5 ring-1 ring-white/20 backdrop-blur-md motion-safe:animate-[fadeUp_1300ms_ease-out] sm:mt-10">
          <HeroSearch className="w-full" />
          <ul className="flex flex-col items-center gap-1.5 px-4 py-3 text-xs text-white sm:text-sm sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6" aria-label="Booking with Vista Chase">
            {[
              { icon: CalendarCheck, text: "Free cancellation up to 72 hours" },
              { icon: MapPin, text: "Hotel pickup in Banff & Canmore" },
              { icon: MountainSnow, text: "Guaranteed Moraine Lake access" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-summit-400" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* 3 · Explore by experience */}
        <div
          className="mt-10 w-full max-w-5xl sm:mt-12"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onFocusCapture={() => setHovering(true)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovering(false);
          }}
        >
          <p id="services-hero-label" className="text-xs uppercase tracking-[0.18em] text-white/75 sm:tracking-[0.2em]">
            Or explore by experience
          </p>
          <div
            role="tablist"
            aria-labelledby="services-hero-label"
            className="vc-rail -mx-page mt-4 flex gap-2 overflow-x-auto px-page pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
          >
            {slides.map((s, i) => {
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
                  className={`relative flex shrink-0 items-center gap-2.5 overflow-hidden rounded-2xl py-1.5 pl-1.5 pr-4 text-left ring-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-500 ${
                    on ? "bg-white text-obsidian-900 ring-white" : "bg-white/10 text-white ring-white/20 backdrop-blur-md hover:bg-white/20"
                  }`}
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl">
                    <Image src={s.image} alt="" fill sizes="40px" className="object-cover" />
                  </span>
                  <span className="min-w-0 whitespace-nowrap">
                    <span className="block text-sm leading-tight">{TAB_LABEL[s.id] ?? s.title}</span>
                    <span className={`block text-xs leading-tight ${on ? "text-slate-600" : "text-white/75"}`}>
                      {fromPrices[i] !== null ? `From ${money(fromPrices[i] as number)}` : "Price on request"}
                    </span>
                  </span>
                  {/* rotation progress along the active pill's foot */}
                  {on && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 bg-obsidian-900/10" aria-hidden="true">
                      <span
                        key={`${index}-${rotating}`}
                        className={`block h-full bg-summit-500 ${rotating ? "animate-[heroProgress_8000ms_linear_forwards]" : "w-full"}`}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* The selected experience (tabpanel): its line and link, right under the switcher. */}
          <div
            id="services-hero-panel"
            role="tabpanel"
            aria-label={`${index + 1} of ${slides.length}: ${slide.title}`}
            aria-live={announce ? "polite" : "off"}
            className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-white/90 sm:text-base"
          >
            <span key={slide.id} className="[text-shadow:0_1px_10px_rgba(0,0,0,0.5)] motion-safe:animate-[fadeUp_600ms_ease-out]">
              {shortTagline(slide.tagline)}
            </span>
            <Link href={slide.href} className="group inline-flex items-center gap-1.5 text-summit-300 underline decoration-summit-300/50 underline-offset-4 hover:decoration-summit-300">
              Explore {(TAB_LABEL[slide.id] ?? slide.title).toLowerCase()}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
