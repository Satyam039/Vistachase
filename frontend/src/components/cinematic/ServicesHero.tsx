"use client";

// Home hero: the five Vista Chase services rotate one by one, each with its "why choose"
// reasons, a background clip or photo, and its tours with rating, reviews and price.
//
// Carousel accessibility (WAI-ARIA carousel pattern, WCAG 2.2.2): auto-rotation can be paused
// with a visible button, stops while the pointer or keyboard focus is inside the hero, and
// never runs with reduced motion. The slide pickers are a tablist; slide changes are announced
// only when the visitor makes them (aria-live is off while rotating).

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Pause, Play, Star } from "lucide-react";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";
import { hasPrice, money, originalPrice } from "@/lib/pricing";
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

const reviews = (n: number) => (n >= 1000 ? `${n.toLocaleString("en-CA")}+` : String(n));

export function ServicesHero({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
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

  const rotating = !userPaused && !hovering && !reducedMotion;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => {
      setAnnounce(false);
      setIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, index, slides.length]);

  const go = useCallback((next: number, focus = false) => {
    const i = (next + slides.length) % slides.length;
    setAnnounce(true);
    setIndex(i);
    if (focus) tabRefs.current[i]?.focus();
  }, [slides.length]);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1, true); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1, true); }
    if (e.key === "Home") { e.preventDefault(); go(0, true); }
    if (e.key === "End") { e.preventDefault(); go(slides.length - 1, true); }
  };

  const slide = slides[index];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Vista Chase experiences"
      className="relative flex min-h-[92vh] w-full items-end overflow-hidden bg-ocean-950 lg:min-h-screen"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setHovering(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovering(false);
      }}
    >
      {/* Background: each service's photo cross-fades; the active one plays its clip. No z-index
          on this layer, so the video's pause button stays above the content. */}
      <div className="absolute inset-0">
        {slides.map((s, i) => (
          <Image
            key={s.id}
            src={s.image}
            alt=""
            fill
            priority={i === 0}
            sizes="100vw"
            className={`object-cover transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"}`}
            data-parallax="10"
          />
        ))}
        {slide.video && (
          <AmbientVideo
            key={slide.id}
            src={slide.video.src}
            srcHd={slide.video.srcHd}
            poster={slide.video.poster}
            className="absolute inset-0 h-full w-full object-cover"
            buttonClassName="top-6 right-6"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ocean-950 via-ocean-950/70 to-ocean-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-ocean-950/80 via-ocean-950/30 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-page pb-24 pt-28 sm:pb-28" data-scroll-fade>
        <p className="mb-4 text-xs uppercase tracking-[0.24em] text-summit-300">Vista Chase · Canadian Rockies</p>
        <h1 className="max-w-4xl text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
          Discover the Canadian Rockies your way
        </h1>

        <div
          id="services-hero-slide"
          role="tabpanel"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${slides.length}: ${slide.title}`}
          aria-live={announce ? "polite" : "off"}
          className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end"
        >
          {/* Why choose this service */}
          <div key={slide.id} className="space-y-5 motion-safe:animate-[fadeUp_700ms_ease-out]">
            <h2 className="text-2xl font-light text-white sm:text-3xl">{slide.title}</h2>
            <p className="max-w-xl text-lg font-light text-slate-200">{slide.tagline}</p>
            <ul className="grid max-w-xl gap-2.5 sm:grid-cols-2">
              {slide.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-base text-slate-100">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-summit-500" aria-hidden="true" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href={slide.href} className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-md px-7 text-sm uppercase tracking-[0.14em]">
                {slide.cta}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/search"
                className="inline-flex h-12 items-center rounded-md border border-white/30 bg-white/10 px-7 text-sm uppercase tracking-[0.14em] text-white backdrop-blur-md hover:bg-white/20"
              >
                Find dates
              </Link>
            </div>
          </div>

          {/* This service's tours with rating, reviews and price */}
          {slide.tours.length > 0 && (
            <ul key={`${slide.id}-tours`} className="space-y-2.5 motion-safe:animate-[fadeUp_900ms_ease-out]" aria-label={`${slide.title}: tours`}>
              {slide.tours.map((t) => {
                const original = originalPrice(t.price);
                return (
                  <li key={t.slug}>
                    <Link
                      href={`/${t.slug}`}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-white/15 bg-obsidian-900/55 px-5 py-4 text-white backdrop-blur-md hover:bg-obsidian-900/75"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-base">{t.title}</span>
                        {t.reviewCount > 0 ? (
                          <span className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-300">
                            <Star className="h-4 w-4 fill-summit-500 text-summit-500" aria-hidden="true" />
                            <span>
                              {t.rating.toFixed(1)}
                              <span className="sr-only"> out of 5</span> · {reviews(t.reviewCount)} reviews
                            </span>
                          </span>
                        ) : (
                          <span className="mt-0.5 block text-sm text-slate-300">New on Vista Chase</span>
                        )}
                      </span>
                      <span className="shrink-0 text-right">
                        {hasPrice(t.price) ? (
                          <>
                            {original && (
                              <del className="block text-xs text-slate-300">
                                <span className="sr-only">Original price </span>
                                {money(original)}
                              </del>
                            )}
                            <ins className="block text-lg no-underline">
                              {original && <span className="sr-only">Offer price </span>}
                              {money(t.price)}
                            </ins>
                            <span className="block text-xs text-slate-300">{t.unit}</span>
                          </>
                        ) : (
                          <span className="text-sm text-slate-200">Price on request</span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Slide pickers + rotation control */}
        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-white/15 pt-5">
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? "Start rotating the experiences" : "Stop rotating the experiences"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-500"
          >
            {userPaused || reducedMotion ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          </button>
          <div role="tablist" aria-label="Choose an experience" className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-controls="services-hero-slide"
                tabIndex={i === index ? 0 : -1}
                onClick={() => go(i)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`relative min-h-11 pb-2 text-left text-sm uppercase tracking-[0.14em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-summit-500 ${
                  i === index ? "text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                {s.title}
                {/* progress bar while this slide is showing */}
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20" aria-hidden="true">
                  {i === index && (
                    <span
                      key={`${index}-${rotating}`}
                      className={`block h-full bg-summit-500 ${rotating ? "animate-[heroProgress_8000ms_linear_forwards]" : "w-full"}`}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
