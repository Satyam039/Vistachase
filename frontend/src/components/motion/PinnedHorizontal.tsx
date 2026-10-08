"use client";

// Sticky horizontal scroll: on large screens the section pins below the header and scrolling
// down moves its cards sideways, with a progress bar; the section is as tall as the track is
// wide, so the page scroll maps 1:1 onto the track. On phones/tablets and with reduced motion it
// is an ordinary swipeable Rail.
//
// Travel is measured from the cards themselves, so the first card starts on the page margin and
// the last one ends on it (the track's end padding isn't part of scrollWidth). If the cards fit,
// nothing pins. A progress bar and "n / total" counter sit under the track.
//
// Keyboard: when a card link takes focus while off to the side, the page scrolls to the point
// where that card is in view (a transformed track can't be scrolled into view by the browser).

import { Children, useCallback, useEffect, useRef, useState } from "react";
import { Rail } from "@/components/motion/Rail";

export function PinnedHorizontal({
  label,
  heading,
  children,
  itemClassName = "w-[24rem]",
}: {
  label: string;
  heading: React.ReactNode;
  children: React.ReactNode;
  itemClassName?: string;
}) {
  const [pinned, setPinned] = useState(false);
  const section = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);
  const overflowRef = useRef(0);
  const count = Children.count(children);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    const update = () => setPinned(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const measure = useCallback(() => {
    const el = track.current;
    const last = el?.lastElementChild as HTMLElement | null;
    if (!el || !last) return;
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const next = Math.max(0, Math.round(last.offsetLeft + last.offsetWidth + pad - el.clientWidth));
    overflowRef.current = next;
    setOverflow(next);
  }, []);

  useEffect(() => {
    if (!pinned) return;
    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const box = section.current?.getBoundingClientRect();
        const el = track.current;
        if (!box || !el) return;
        const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--vc-header-h")) || 0;
        const travel = box.height - (window.innerHeight - header);
        const progress = travel > 0 ? Math.min(1, Math.max(0, (header - box.top) / travel)) : 0;
        el.style.transform = `translate3d(${-progress * overflowRef.current}px,0,0)`;
        if (bar.current) bar.current.style.transform = `scaleX(${Math.max(progress, 1 / count)})`;
        if (counter.current) counter.current.textContent = String(Math.min(count, 1 + Math.round(progress * (count - 1))));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const remeasure = () => {
      measure();
      onScroll();
    };
    window.addEventListener("resize", remeasure);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("resize", remeasure);
    };
  }, [pinned, measure, count]);

  // Keep a focused card in view by scrolling the page to its point on the track.
  const onFocus = (e: React.FocusEvent<HTMLUListElement>) => {
    const el = track.current;
    const box = section.current;
    const item = (e.target as HTMLElement).closest("li");
    if (!el || !box || !item || overflow === 0) return;
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--vc-header-h")) || 0;
    const travel = box.offsetHeight - (window.innerHeight - header);
    const wanted = Math.min(1, Math.max(0, (item.offsetLeft - el.clientWidth / 2 + item.offsetWidth / 2) / overflow));
    const top = box.getBoundingClientRect().top + window.scrollY - header + wanted * travel;
    window.scrollTo({ top, behavior: "auto" });
  };

  if (!pinned) {
    return (
      <section aria-label={label} className="overflow-hidden bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-page">
          <div className="mb-8">{heading}</div>
          <Rail label={label} itemClassName="w-[78vw] max-w-[24rem] sm:w-[20rem]">
            {children}
          </Rail>
        </div>
      </section>
    );
  }

  // Cards fit on screen: no pinning, just the row (measured once the large layout is on).
  const active = overflow > 0;

  return (
    <section
      ref={section}
      aria-label={label}
      className="relative bg-white"
      // Tall enough that scrolling the page by the track's overflow moves it end to end.
      style={active ? { height: `calc(100vh - var(--vc-header-h, 80px) + ${overflow}px)` } : undefined}
    >
      <div
        className={
          active
            ? "sticky top-[var(--vc-header-h,80px)] flex h-[calc(100vh-var(--vc-header-h,80px))] flex-col justify-center overflow-hidden py-10"
            : "overflow-hidden py-24"
        }
      >
        <div className="mx-auto mb-8 w-full max-w-7xl px-page">{heading}</div>
        <ul
          ref={track}
          aria-label={label}
          onFocus={onFocus}
          className="relative flex gap-6 pl-[max(var(--vc-page-margin-x),calc((100%-80rem)/2+var(--vc-page-margin-x)))] pr-page will-change-transform"
        >
          {Children.map(children, (child) => (
            <li className={`shrink-0 ${itemClassName}`}>{child}</li>
          ))}
        </ul>
        {active && (
          <div className="mx-auto mt-8 flex w-full max-w-7xl items-center gap-4 px-page" aria-hidden="true">
            <span className="tabular-nums text-sm text-slate-600">
              <span ref={counter}>1</span> / {count}
            </span>
            <span className="h-0.5 flex-1 overflow-hidden rounded-full bg-obsidian-900/10">
              <span ref={bar} className="block h-full origin-left bg-ocean-600" style={{ transform: `scaleX(${1 / count})` }} />
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
