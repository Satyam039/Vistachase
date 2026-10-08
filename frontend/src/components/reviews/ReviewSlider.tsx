"use client";

// Guest reviews as a slider: moves on by itself every few seconds, with previous/next buttons and
// native swipe (a scroll-snap track). It pauses while you hover or focus it and has a visible
// pause button (WCAG 2.2.2); with reduced motion it doesn't move on its own. Only real reviews go
// in: ones guests wrote against a Vista Chase booking (backend /api/reviews filters the rest), and
// each card says so.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronLeft, ChevronRight, Pause, Play, Star } from "lucide-react";

export interface SliderReview {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  tourTitle?: string;
  tourSlug?: string;
}

const INTERVAL_MS = 6000;
export const REVIEW_SOURCE = "Verified Vista Chase booking";

export function ReviewSlider({ reviews, tone = "light", label = "Guest reviews" }: { reviews: SliderReview[]; tone?: "light" | "dark"; label?: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false); // the pause button
  const [held, setHeld] = useState(false); // hover or focus inside
  const [reduced, setReduced] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const dark = tone === "dark";

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const updateEnds = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }, []);

  // One card's width plus the gap: how far prev/next and the timer move.
  const step = () => {
    const el = track.current;
    const card = el?.firstElementChild as HTMLElement | null;
    return card ? card.offsetWidth + parseFloat(getComputedStyle(el!).columnGap || "0") : 0;
  };

  const go = useCallback(
    (dir: 1 | -1, wrap = false) => {
      const el = track.current;
      if (!el) return;
      const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      const behavior = reduced ? "auto" : "smooth";
      if (wrap && dir === 1 && end) el.scrollTo({ left: 0, behavior });
      else el.scrollBy({ left: dir * step(), behavior });
    },
    [reduced],
  );

  const moving = reviews.length > 1 && !paused && !held && !reduced;
  useEffect(() => {
    if (!moving) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") go(1, true);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [moving, go]);

  useEffect(updateEnds, [updateEnds, reviews.length]);

  if (reviews.length === 0) return null;

  const btn = `inline-flex h-11 w-11 items-center justify-center rounded-full ring-1 transition-colors disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
    dark ? "text-white ring-white/20 hover:bg-white/10 focus-visible:outline-summit-300" : "text-obsidian-900 ring-obsidian-900/15 hover:bg-obsidian-900/5 focus-visible:outline-ocean-600"
  }`;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHeld(false);
      }}
    >
      <ul
        ref={track}
        onScroll={updateEnds}
        aria-live={moving ? "off" : "polite"}
        className="vc-rail flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 motion-reduce:scroll-auto"
      >
        {reviews.map((r, i) => (
          <li
            key={r.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${reviews.length}`}
            className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
          >
            <figure
              className={`flex h-full flex-col rounded-[1.75rem] p-6 sm:p-7 ${
                dark ? "bg-white/[0.05] ring-1 ring-white/10" : "bg-white ring-1 ring-obsidian-900/[0.07]"
              }`}
            >
              <p className="flex items-center gap-1" role="img" aria-label={`${r.rating} out of 5`}>
                {Array.from({ length: 5 }, (_, s) => (
                  <Star key={s} className={`h-4 w-4 ${s < r.rating ? "fill-summit-500 text-summit-500" : dark ? "text-white/25" : "text-slate-300"}`} aria-hidden="true" />
                ))}
              </p>
              <blockquote className="mt-4 flex-1">
                <p className={`text-lg font-light ${dark ? "text-white" : "text-obsidian-900"}`}>{r.title}</p>
                <p className={`mt-2 line-clamp-6 text-base leading-relaxed ${dark ? "text-slate-200" : "text-slate-700"}`}>{r.body}</p>
              </blockquote>
              <figcaption className={`mt-5 border-t pt-4 text-sm ${dark ? "border-white/10 text-slate-300" : "border-obsidian-900/[0.06] text-slate-600"}`}>
                <span className={dark ? "text-white" : "text-obsidian-900"}>{r.authorName}</span> · {r.date}
                {r.tourTitle && r.tourSlug && (
                  <Link href={`/${r.tourSlug}`} className={`mt-1 block truncate underline-offset-4 hover:underline ${dark ? "text-summit-200" : "text-ocean-600"}`}>
                    {r.tourTitle}
                  </Link>
                )}
                <span className="mt-2 flex items-center gap-1.5">
                  <BadgeCheck className={`h-4 w-4 ${dark ? "text-summit-300" : "text-emerald-700"}`} aria-hidden="true" />
                  {REVIEW_SOURCE}
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      {reviews.length > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" className={btn} onClick={() => go(-1)} disabled={atStart} aria-label="Previous review">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          {!reduced && (
            <button type="button" className={btn} onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play reviews" : "Pause reviews"}>
              {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
          <button type="button" className={btn} onClick={() => go(1)} disabled={atEnd} aria-label="Next review">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
