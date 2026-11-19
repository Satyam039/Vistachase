"use client";

// Day 1–N tabs for a journey's detailed itinerary (owner, 2026-11-18): click (or tap) a day to see its
// full itinerary in place, with no page change, so nothing the guest has filled in elsewhere on the
// page is lost. WAI-ARIA tabs: arrow keys, Home and End move between days. The tabs scroll sideways
// on narrow screens rather than wrapping.
//
// Owner, 2026-11-19: the booking form sits between the Day buttons and the day's itinerary, so the
// buttons (ItineraryDayTabList) and the day (ItineraryDayPanel) are separate pieces that share the
// chosen day through ItineraryDays.

import { createContext, useContext, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MapPin } from "lucide-react";
import type { PackageDay } from "@/lib/itineraries";

/** A day as the tabs show it; the two-day journey's days have no closing line. */
type TabDay = Omit<PackageDay, "closing"> & { closing?: string };

interface DaysState {
  days: TabDay[];
  idPrefix: string;
  active: number;
  setActive: (i: number) => void;
}

const DaysContext = createContext<DaysState | null>(null);

function useDays(): DaysState {
  const state = useContext(DaysContext);
  if (!state) throw new Error("ItineraryDayTabList and ItineraryDayPanel go inside ItineraryDays.");
  return state;
}

/** Holds which day is chosen, for the Day buttons and the day's itinerary placed anywhere inside it. */
export function ItineraryDays({ days, idPrefix = "itinerary", children }: { days: TabDay[]; idPrefix?: string; children: ReactNode }) {
  const [active, setActive] = useState(0);
  return <DaysContext.Provider value={{ days, idPrefix, active, setActive }}>{children}</DaysContext.Provider>;
}

/** The Day 1, Day 2… buttons. */
export function ItineraryDayTabList() {
  const { days, idPrefix, active, setActive } = useDays();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

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
          </button>
        );
      })}
    </div>
  );
}

/** The chosen day's full itinerary. */
export function ItineraryDayPanel({ className = "" }: { className?: string }) {
  const { days, idPrefix, active } = useDays();
  const day = days[active];
  if (!day) return null;
  return (
    <article
      id={`${idPrefix}-panel`}
      role="tabpanel"
      aria-labelledby={`${idPrefix}-tab-${day.dayNumber}`}
      tabIndex={0}
      className={`overflow-hidden rounded-none border border-obsidian-900/[0.08] bg-white p-6 shadow-sm sm:p-8 ${className}`}
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
  );
}
