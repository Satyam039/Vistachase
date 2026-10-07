"use client";

// Site-wide scroll motion, driven by data attributes so server components can opt in without
// becoming client components. Mounted once in SiteFrame.
//
//   data-reveal[="up"|"fade"|"scale"|"left"|"right"|"clip"]   element rises / fades in on entry
//   data-reveal-delay="120"                                     ms delay for that element
//   data-stagger                                                children reveal one after another
//   data-parallax="12"                                          media drifts ±12% while in view
//   data-count-to="742"                                         number counts up when revealed
//
// Content is never hidden without JavaScript: the `vc-motion` class that arms the hidden state is
// added here, after anything already on screen has been marked revealed (no flash). Elements
// added later (client navigation) are picked up by a MutationObserver. With reduced motion
// nothing is hidden, nothing moves and counters show their final value (globals.css).
//
// Parallax uses CSS scroll-driven animations where supported (globals.css); this runtime is
// the fallback for browsers without `animation-timeline: view()`.

import { useEffect } from "react";

const REVEAL = "[data-reveal],[data-stagger]";

export function MotionRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const revealNow = (el: Element) => {
      el.setAttribute("data-shown", "");
      if (el instanceof HTMLElement && el.dataset.countTo) countUp(el);
      el.querySelectorAll<HTMLElement>("[data-count-to]").forEach(countUp);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          revealNow(entry.target);
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    // Per run, not a DOM flag: a remount (Strict Mode, fast refresh) must rebind everything.
    const bound = new WeakSet<Element>();
    const prepare = (scope: ParentNode, initial: boolean) => {
      scope.querySelectorAll<HTMLElement>(REVEAL).forEach((el) => {
        if (bound.has(el) || el.hasAttribute("data-shown")) return;
        bound.add(el);
        if (el.hasAttribute("data-stagger")) {
          Array.from(el.children).forEach((child, i) => (child as HTMLElement).style.setProperty("--i", String(i)));
        }
        if (el.dataset.revealDelay) el.style.setProperty("--reveal-delay", `${el.dataset.revealDelay}ms`);
        // On first load, whatever is already on screen stays put rather than blinking out.
        if (initial && el.getBoundingClientRect().top < window.innerHeight) {
          el.setAttribute("data-shown", "");
          return;
        }
        io.observe(el);
      });
    };

    prepare(document, true);
    root.classList.add("vc-motion");

    const mo = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches(REVEAL)) prepare(n.parentElement ?? document, false);
          else prepare(n, false);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Parallax fallback (only where CSS scroll timelines are missing).
    let raf = 0;
    const cssTimelines = CSS.supports("animation-timeline: view()");
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const vh = window.innerHeight;
        document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
          const box = (el.parentElement ?? el).getBoundingClientRect();
          if (box.bottom < 0 || box.top > vh) return;
          const progress = (box.top + box.height / 2 - vh / 2) / (vh / 2 + box.height / 2); // -1..1
          const amount = Number(el.dataset.parallax) || 10;
          el.style.transform = `translate3d(0, ${(-progress * amount).toFixed(2)}%, 0) scale(1.18)`;
        });
      });
    };
    if (!cssTimelines) {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    // Reduced motion switched on mid-visit: show everything and stop.
    const onReduce = () => {
      if (!reduced.matches) return;
      root.classList.remove("vc-motion");
      document.querySelectorAll(REVEAL).forEach(revealNow);
    };
    reduced.addEventListener("change", onReduce);

    return () => {
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
      reduced.removeEventListener("change", onReduce);
      cancelAnimationFrame(raf);
      root.classList.remove("vc-motion");
    };
  }, []);

  return null;
}

/** Counts a number up to data-count-to, keeping its prefix/suffix (data-count-format). */
function countUp(el: HTMLElement) {
  if (el.dataset.counted) return;
  el.dataset.counted = "1";
  const target = Number(el.dataset.countTo);
  if (!Number.isFinite(target)) return;
  const decimals = Number(el.dataset.countDecimals ?? 0);
  const prefix = el.dataset.countPrefix ?? "";
  const suffix = el.dataset.countSuffix ?? "";
  const start = performance.now();
  const duration = 1400;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = `${prefix}${(target * eased).toLocaleString("en-CA", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
