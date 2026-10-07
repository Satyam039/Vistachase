"use client";

// Horizontal card rail (GetYourGuide / Viator style): native scroll with snap, swipe on touch,
// previous/next buttons on pointer devices. The list stays a real list, so screen readers and
// keyboard users move through cards in order; buttons disable at either end.

import { Children, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface RailProps {
  /** Accessible name for the list, e.g. "Top shared tours". */
  label: string;
  children: React.ReactNode;
  /** Card width utility classes (Tailwind). */
  itemClassName?: string;
  tone?: "light" | "dark";
}

export function Rail({ label, children, itemClassName = "w-[82%] sm:w-[46%] lg:w-[31%] xl:w-[23.5%]", tone = "light" }: RailProps) {
  const ref = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  };

  const btn =
    tone === "dark"
      ? "border-white/25 text-white hover:bg-white hover:text-obsidian-900 disabled:opacity-30"
      : "border-obsidian-900/15 bg-white text-obsidian-900 hover:bg-obsidian-900 hover:text-white disabled:opacity-30";

  return (
    <div className="relative">
      <div className="mb-4 hidden justify-end gap-2 md:flex">
        <button
          type="button"
          onClick={() => page(-1)}
          disabled={atStart}
          aria-label={`Scroll ${label} back`}
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors disabled:cursor-default disabled:hover:bg-transparent ${btn}`}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => page(1)}
          disabled={atEnd}
          aria-label={`Scroll ${label} forward`}
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors disabled:cursor-default disabled:hover:bg-transparent ${btn}`}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <ul
        ref={ref}
        onScroll={update}
        aria-label={label}
        className="vc-rail -mx-page flex gap-5 overflow-x-auto px-page pb-4 scroll-px-page"
        data-stagger
      >
        {Children.map(children, (child) => (
          <li className={`shrink-0 ${itemClassName}`}>{child}</li>
        ))}
      </ul>
    </div>
  );
}
