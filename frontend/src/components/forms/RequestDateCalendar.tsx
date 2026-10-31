"use client";

// Preferred-date calendar for request forms (private tours, multi-day packages, shuttle requests):
// the same month view as the booking calendar (DepartureCalendar), but any day from today on can be
// chosen, because these trips are confirmed by the team rather than sold from fixed departures.
// For an N-day trip the chosen day starts the trip and the following days are highlighted too.
//
// Keyboard: Tab lands on the selected (or first selectable) day; arrow keys move by day/week,
// Home/End jump to the first/last day of the month; Page Up/Down change month.

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const addDays = (day: string, n: number) => {
  const d = parse(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const longDay = (day: string) =>
  parse(day).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDay = (day: string) => parse(day).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** Today in Banff ("YYYY-MM-DD"): trips run on Mountain Time whatever the visitor's zone. */
function todayInBanff() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** The days of a trip starting on `start`. */
export const tripDates = (start: string, days: number) => Array.from({ length: Math.max(1, days) }, (_, i) => addDays(start, i));

export function RequestDateCalendar({
  value,
  onChange,
  tripDays = 1,
  labelId,
  invalid,
  describedBy,
}: {
  /** Selected (start) date, "YYYY-MM-DD", or "". */
  value: string;
  onChange: (day: string) => void;
  /** Days in the trip: 1 for a day tour, 2–4 for the multi-day packages. */
  tripDays?: number;
  /** id of the visible label that names the calendar. */
  labelId: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const today = todayInBanff();
  const [month, setMonth] = useState(() => (value || today).slice(0, 7));
  const grid = useRef<HTMLDivElement>(null);

  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array<null>(first.getUTCDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => iso(year, monthNumber - 1, i + 1))];
  while (cells.length % 7) cells.push(null);
  const monthLabel = first.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });

  const canGoBack = month > today.slice(0, 7);
  const shiftMonth = (by: number) => {
    const d = new Date(Date.UTC(year, monthNumber - 1 + by, 1));
    const next = d.toISOString().slice(0, 7);
    if (next >= today.slice(0, 7)) setMonth(next);
  };

  const trip = value ? new Set(tripDates(value, tripDays)) : new Set<string>();
  const selectable = (day: string) => day >= today;
  const inMonth = cells.filter((d): d is string => !!d && selectable(d));
  const tabStop = value && value.slice(0, 7) === month && selectable(value) ? value : inMonth[0];

  const focusDay = (day: string) => {
    if (day.slice(0, 7) !== month) setMonth(day.slice(0, 7));
    // After a month change React re-renders first; focus on the next frame.
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent, day: string) => {
    const moves: Record<string, () => string> = {
      ArrowRight: () => addDays(day, 1),
      ArrowLeft: () => addDays(day, -1),
      ArrowDown: () => addDays(day, 7),
      ArrowUp: () => addDays(day, -7),
      Home: () => inMonth[0] ?? day,
      End: () => inMonth[inMonth.length - 1] ?? day,
      PageDown: () => addDays(day, 30),
      PageUp: () => addDays(day, -30),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const to = move();
    if (!selectable(to)) return;
    onChange(to);
    focusDay(to);
  };

  const navBtn =
    "inline-flex h-10 w-10 items-center justify-center rounded-full text-obsidian-900 transition-colors hover:bg-obsidian-900/[0.06] disabled:pointer-events-none disabled:text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600";

  const days = value ? tripDates(value, tripDays) : [];

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl border bg-white px-3 py-2 ${invalid ? "border-red-600" : "border-obsidian-900/10"}`}>
        <div className="mb-1 flex items-center justify-between">
          <button type="button" className={navBtn} onClick={() => shiftMonth(-1)} disabled={!canGoBack} aria-label="Previous month">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="text-base text-obsidian-900" aria-live="polite">
            {monthLabel}
          </p>
          <button type="button" className={navBtn} onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div ref={grid} role="group" aria-labelledby={labelId} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
          <div className="grid grid-cols-7" aria-hidden="true">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-1 text-center text-xs uppercase tracking-[0.12em] text-slate-500">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <span key={`blank-${i}`} aria-hidden="true" />;
              const isStart = day === value;
              const inTrip = trip.has(day);
              const open = selectable(day);
              return (
                <div key={day} className="flex justify-center">
                  <button
                    type="button"
                    data-day={day}
                    disabled={!open}
                    tabIndex={day === tabStop ? 0 : -1}
                    aria-pressed={open ? isStart : undefined}
                    aria-label={`${longDay(day)}${isStart && tripDays > 1 ? `, day 1 of ${tripDays}` : inTrip ? ", part of your trip" : ""}`}
                    onClick={() => onChange(day)}
                    onKeyDown={(e) => onKeyDown(e, day)}
                    className={`flex h-10 w-full max-w-11 items-center justify-center rounded-full text-base tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ocean-600 ${
                      isStart
                        ? "bg-obsidian-950 text-white"
                        : inTrip
                          ? "bg-summit-200 text-obsidian-900"
                          : open
                            ? "text-obsidian-900 hover:bg-summit-100"
                            : "cursor-default text-slate-300"
                    }`}
                  >
                    {Number(day.slice(8))}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="text-sm text-slate-700" aria-live="polite">
        {days.length === 0
          ? tripDays > 1
            ? `Choose the first day of your ${tripDays}-day trip.`
            : "Choose your preferred day."
          : days.length === 1
            ? longDay(days[0])
            : days.map((d, i) => `Day ${i + 1}: ${shortDay(d)}`).join(" · ")}
      </p>
    </div>
  );
}
