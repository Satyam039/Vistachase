"use client";

// Day 1–N tabs for a journey's detailed itinerary (owner, 2026-11-18): click (or tap) a day to see its
// full itinerary in place, with no page change, so nothing the guest has filled in elsewhere on the
// page is lost. WAI-ARIA tabs: arrow keys, Home and End move between days. The tabs scroll sideways
// on narrow screens rather than wrapping.

import { useRef, useState, type KeyboardEvent } from "react";
import { MapPin } from "lucide-react";
import type { PackageDay } from "@/lib/itineraries";

/** A day as the tabs show it; the two-day journey's days have no closing line. */
type TabDay = Omit<PackageDay, "closing"> & { closing?: string };

/** "Day 1 — Banff's Lakes" → "Banff's Lakes". */
const shortTitle = (title: string) => title.replace(/^Day\s*\d+\s*[—–-]\s*/, "");

export function ItineraryDayTabs({ days, idPrefix = "itinerary" }: { days: TabDay[]; idPrefix?: string }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const day = days[active];
  if (!day) return null;

  const go = (i: number) => {
    const next = (i + days.length) % days.length;
    setActive(next);
    tabs.current[next]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight") go(active + 1);
    else if (e.key === "ArrowLeft") go(active - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(days.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div>
      <div role="tablist" aria-label="Itinerary by day" className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d, i) => {
          const selected = i === active;
          return (
            <button
              key={d.dayNumber}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${d.dayNumber}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={onKey}
              className={`min-h-11 shrink-0 border px-4 py-2 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600 sm:min-w-40 ${
                selected
                  ? "border-obsidian-950 bg-obsidian-950 text-white"
                  : "border-obsidian-900/[0.12] bg-white text-obsidian-900 [@media(hover:hover)]:hover:border-ocean-600 [@media(hover:hover)]:hover:bg-ocean-50"
              }`}
            >
              <span className={`block text-xs uppercase tracking-[0.2em] ${selected ? "text-summit-200" : "text-ocean-600"}`}>Day {d.dayNumber}</span>
              <span className="hidden max-w-52 truncate text-sm sm:block">{shortTitle(d.title)}</span>
            </button>
          );
        })}
      </div>

      <article
        id={`${idPrefix}-panel`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-${day.dayNumber}`}
        tabIndex={0}
        className="mt-4 overflow-hidden rounded-none border border-obsidian-900/[0.08] bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="border-b border-obsidian-900/[0.08] pb-4">
          <span className="text-xs uppercase tracking-[0.24em] text-ocean-600">
            Day {day.dayNumber} of {days.length}
          </span>
          <h3 className="mt-1 text-xl font-normal text-obsidian-900 sm:text-2xl">{day.title}</h3>
        </div>

        <ul className="mt-6 space-y-4 divide-y divide-obsidian-900/[0.05]">
          {day.stops.map((stop) => (
            <li key={stop.name} className="pt-4 first:pt-0">
              <div className="flex items-start gap-2">
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
                <div>
                  <h4 className="text-base font-medium text-obsidian-900">
                    {stop.name}
                    {stop.isOptional && <span className="ml-2 inline-block rounded bg-summit-500/15 px-2 py-0.5 text-xs font-normal text-[#78570f]">Optional Add-On</span>}
                  </h4>
                  <p className="mt-1 text-sm font-light leading-relaxed text-slate-600">{stop.desc}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {day.closing && <p className="mt-6 border-t border-obsidian-900/[0.06] pt-4 text-xs italic text-slate-500 sm:text-sm">{day.closing}</p>}
      </article>
    </div>
  );
}
