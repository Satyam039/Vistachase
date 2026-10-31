"use client";

// Date calendar for tour and package requests on /contact-us. Same look as DepartureCalendar, but
// every future day is selectable (the team confirms availability by reply). For a multi-day
// package the guest picks the start day and the following days of the trip are highlighted.
// Keyboard: Tab lands on the selected (or first open) day; arrow keys move by day/week.

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
/** How far ahead guests can ask for (months, counting the current one). */
const MONTHS_AHEAD = 18;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (day: string) => new Date(`${day}T12:00:00`);
const monthKey = (day: string) => day.slice(0, 7);
const longDate = (day: string) =>
  parse(day).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const shortDate = (day: string) =>
  parse(day).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

/** The `days` consecutive dates starting at `start` (YYYY-MM-DD). */
export function tripDays(start: string, days: number): string[] {
  return Array.from({ length: Math.max(1, days) }, (_, i) => {
    const d = parse(start);
    d.setDate(d.getDate() + i);
    return iso(d);
  });
}

function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function RequestDateCalendar({
  days = 1,
  value,
  onChange,
  error,
  errorId,
}: {
  /** Length of the trip; 2+ highlights the days after the chosen start. */
  days?: number;
  /** Selected start day, YYYY-MM-DD, or "". */
  value: string;
  onChange: (day: string) => void;
  error?: string;
  errorId?: string;
}) {
  const today = iso(new Date());
  const firstMonth = monthKey(today);
  const lastMonth = addMonths(firstMonth, MONTHS_AHEAD - 1);
  const [month, setMonth] = useState(() => monthKey(value || today));
  const grid = useRef<HTMLDivElement>(null);

  const range = value ? tripDays(value, days) : [];
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(new Date(year, monthNumber - 1, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);

  const prevMonth = month > firstMonth ? addMonths(month, -1) : null;
  const nextMonth = month < lastMonth ? addMonths(month, 1) : null;
  const monthLabel = first.toLocaleDateString("en-CA", { month: "long", year: "numeric" });
  const open = (day: string) => day >= today;
  const firstOpen = cells.find((d): d is string => !!d && open(d));
  const tabStop = value && monthKey(value) === month ? value : firstOpen;

  const onKeyDown = (e: React.KeyboardEvent, day: string) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const d = parse(day);
    d.setDate(d.getDate() + step);
    const to = iso(d);
    if (!open(to) || monthKey(to) > lastMonth) return;
    onChange(to);
    if (monthKey(to) !== month) setMonth(monthKey(to));
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-day="${to}"]`)?.focus());
  };

  const navBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-full text-obsidian-900 transition-colors hover:bg-obsidian-900/[0.06] disabled:pointer-events-none disabled:text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600";

  return (
    <fieldset className="space-y-2.5" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5 block text-sm font-medium text-slate-700">
        {days > 1 ? `Preferred start date (${days} days)` : "Preferred date"}
      </legend>

      <div className={`rounded-xl border bg-white px-3 py-2 ${error ? "border-red-600" : "border-obsidian-900/10"}`}>
        <div className="mb-1 flex items-center justify-between">
          <button type="button" className={navBtn} onClick={() => prevMonth && setMonth(prevMonth)} disabled={!prevMonth} aria-label="Previous month">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="text-base text-obsidian-900" aria-live="polite">
            {monthLabel}
          </p>
          <button type="button" className={navBtn} onClick={() => nextMonth && setMonth(nextMonth)} disabled={!nextMonth} aria-label="Next month">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div ref={grid} role="group" aria-label={monthLabel}>
          <div className="grid grid-cols-7" aria-hidden="true">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-1 text-center text-[11px] uppercase tracking-[0.12em] text-slate-500">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <span key={`blank-${i}`} aria-hidden="true" />;
              const isStart = day === value;
              const inTrip = range.includes(day);
              const isOpen = open(day);
              return (
                <div key={day} className="flex justify-center">
                  <button
                    type="button"
                    data-day={day}
                    disabled={!isOpen}
                    tabIndex={day === tabStop ? 0 : -1}
                    aria-pressed={isOpen ? isStart : undefined}
                    aria-label={`${longDate(day)}${inTrip && !isStart ? `, day ${range.indexOf(day) + 1} of your trip` : ""}`}
                    onClick={() => onChange(day)}
                    onKeyDown={(e) => onKeyDown(e, day)}
                    className={`flex h-10 w-full max-w-11 items-center justify-center rounded-full text-base tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ocean-600 ${
                      isStart
                        ? "bg-obsidian-950 text-white"
                        : inTrip
                          ? "bg-summit-200 text-obsidian-900"
                          : isOpen
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
        {value ? (
          days > 1 ? (
            <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-obsidian-900">
              {range.map((d, i) => (
                <span key={d} className="whitespace-nowrap">
                  Day {i + 1}: {shortDate(d)}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-obsidian-900">{longDate(value)}</span>
          )
        ) : days > 1 ? (
          "Choose the first day of your trip. Need days apart? Tell us in the message."
        ) : (
          "Choose your preferred day. We confirm availability by email."
        )}
      </p>
      {error && (
        <span id={errorId} className="block text-sm text-red-700">
          {error}
        </span>
      )}
    </fieldset>
  );
}
