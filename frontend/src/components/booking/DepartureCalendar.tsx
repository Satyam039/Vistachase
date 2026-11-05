"use client";

// Departure date picker: a month calendar that fills its card. Each day is one of four states,
// told apart by more than colour:
//   available  dark number with a gold dot underneath (selectable)
//   selected   solid near-black circle, white number
//   sold out   faded, struck-through number (a departure exists but has no seats)
//   no tour    faded number, nothing underneath
// Month arrows only move to months that have departures. Keyboard: Tab lands on the selected (or
// first available) day; arrow keys move between available days, Home/End jump to the first/last.
// When a day has more than one departure, its times appear as a second choice underneath.
// With `collapseOnSelect`, picking a day (or a time) folds the calendar into one line with a
// "Change date" button, so the booking button stays in view on small laptops (owner's doc, 2026-11-04).

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DepartureAvailability } from "@/lib/api/types";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const dayOf = (d: DepartureAvailability) => d.date.slice(0, 10);
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const monthKey = (day: string) => day.slice(0, 7);
const longDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });

export function DepartureCalendar({
  departures,
  isBookable,
  value,
  onChange,
  describe,
  collapseOnSelect = false,
}: {
  departures: DepartureAvailability[];
  /** Whether this departure can be booked for the current party (seats left, whole vehicle free). */
  isBookable: (d: DepartureAvailability) => boolean;
  /** Selected departure id. */
  value: string;
  onChange: (departureId: string) => void;
  /** The line shown under the calendar for the selected departure (price, availability). */
  describe: (d: DepartureAvailability) => string;
  /** Fold into a one-line summary once the guest picks a date. */
  collapseOnSelect?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const changeButton = useRef<HTMLButtonElement>(null);
  const reopened = useRef(false);
  const bookable = departures.filter(isBookable);
  const bookableDays = Array.from(new Set(bookable.map(dayOf))).sort();
  const fullDays = new Set(departures.map(dayOf).filter((d) => !bookableDays.includes(d)));
  const months = Array.from(new Set(departures.map((d) => monthKey(dayOf(d))))).sort();

  const selected = departures.find((d) => d.id === value);
  const selectedDay = selected ? dayOf(selected) : undefined;
  const [month, setMonth] = useState(() => monthKey(selectedDay ?? bookableDays[0] ?? months[0] ?? new Date().toISOString()));
  const grid = useRef<HTMLDivElement>(null);

  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(year, monthNumber - 1, i + 1)),
  ];
  while (cells.length % 7) cells.push(null);

  const monthAt = months.indexOf(month);
  const prevMonth = monthAt > 0 ? months[monthAt - 1] : null;
  const nextMonth = monthAt >= 0 && monthAt < months.length - 1 ? months[monthAt + 1] : null;
  const monthLabel = first.toLocaleDateString("en-CA", { month: "long", year: "numeric" });

  const inMonth = bookableDays.filter((d) => monthKey(d) === month);
  const tabStop = selectedDay && monthKey(selectedDay) === month ? selectedDay : inMonth[0];
  const sameDay = selectedDay ? bookable.filter((d) => dayOf(d) === selectedDay) : [];

  const pick = (day: string) => {
    const dep = bookable.find((d) => dayOf(d) === day);
    if (dep) onChange(dep.id);
  };
  // A click (or Enter) chooses; arrow keys only move. A day with several times waits for the time.
  const choose = (day: string) => {
    pick(day);
    if (collapseOnSelect && bookable.filter((d) => dayOf(d) === day).length === 1) setOpen(false);
  };

  // Keep focus on the control that replaced the one the guest used.
  useEffect(() => {
    if (!open) changeButton.current?.focus();
    else if (reopened.current) grid.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  }, [open]);

  if (collapseOnSelect && !open && selected && selectedDay) {
    return (
      <fieldset className="space-y-2.5">
        <legend className="mb-1.5 block text-sm text-slate-700">Departure date</legend>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-obsidian-900/10 bg-white px-4 py-3">
          <p className="min-w-0 text-sm text-slate-700" aria-live="polite">
            <span className="block text-base text-obsidian-900">
              {longDate(selectedDay)} · {selected.departureTime.slice(0, 5)}
            </span>
            <span className="block text-slate-600">{describe(selected)}</span>
          </p>
          <button
            ref={changeButton}
            type="button"
            aria-expanded={false}
            onClick={() => {
              reopened.current = true;
              setOpen(true);
            }}
            className="min-h-10 shrink-0 rounded-full px-4 text-sm text-obsidian-900 ring-1 ring-obsidian-900/15 transition-colors hover:ring-obsidian-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600"
          >
            Change date
          </button>
        </div>
      </fieldset>
    );
  }

  const onKeyDown = (e: React.KeyboardEvent, day: string) => {
    const i = inMonth.indexOf(day);
    const to = {
      ArrowRight: inMonth[i + 1],
      ArrowDown: inMonth[i + 1],
      ArrowLeft: inMonth[i - 1],
      ArrowUp: inMonth[i - 1],
      Home: inMonth[0],
      End: inMonth[inMonth.length - 1],
    }[e.key];
    if (!to) return;
    e.preventDefault();
    pick(to);
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${to}"]`)?.focus();
  };

  const navBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-full text-obsidian-900 transition-colors hover:bg-obsidian-900/[0.06] disabled:pointer-events-none disabled:text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600";

  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-1.5 block text-sm text-slate-700">Departure date</legend>

      <div className="rounded-2xl border border-obsidian-900/10 bg-white px-3 py-2">
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
              const isSelected = day === selectedDay;
              const isAvailable = bookableDays.includes(day);
              const isFull = fullDays.has(day);
              const state = isSelected ? "selected" : isAvailable ? "available" : isFull ? "sold out" : "no departure";
              return (
                <div key={day} className="flex justify-center">
                  <button
                    type="button"
                    data-day={day}
                    disabled={!isAvailable}
                    tabIndex={day === tabStop ? 0 : -1}
                    aria-pressed={isAvailable ? isSelected : undefined}
                    aria-label={`${longDate(day)}, ${state}`}
                    onClick={() => choose(day)}
                    onKeyDown={(e) => onKeyDown(e, day)}
                    className={`flex h-10 w-full max-w-11 flex-col items-center justify-center rounded-full text-base tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ocean-600 ${
                      isSelected
                        ? "bg-obsidian-950 text-white"
                        : isAvailable
                          ? "text-obsidian-900 hover:bg-summit-100"
                          : "cursor-default text-slate-300"
                    }`}
                  >
                    <span className="mb-0.5 h-1" aria-hidden="true" />
                    <span className={`leading-none ${isFull ? "line-through decoration-slate-400" : ""}`}>{Number(day.slice(8))}</span>
                    {/* Marker row under the number, balanced by the spacer above so numbers stay centred. */}
                    <span className={`mt-0.5 h-1 w-1 rounded-full ${isAvailable && !isSelected ? "bg-summit-500" : ""}`} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600" aria-label="Calendar key">
        <li className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-summit-500" aria-hidden="true" />
          Available
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-obsidian-950" aria-hidden="true" />
          Selected
        </li>
        {fullDays.size > 0 && (
          <li className="flex items-center gap-1.5">
            <span className="text-slate-500 line-through" aria-hidden="true">
              12
            </span>
            Sold out
          </li>
        )}
      </ul>

      {sameDay.length > 1 && (
        <div role="radiogroup" aria-label="Departure time" className="flex flex-wrap gap-2">
          {sameDay.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={d.id === value}
              onClick={() => {
                onChange(d.id);
                if (collapseOnSelect) setOpen(false);
              }}
              className={`h-10 rounded-full px-4 text-sm ring-1 transition-colors ${
                d.id === value ? "bg-obsidian-950 text-white ring-obsidian-950" : "bg-white text-obsidian-900 ring-obsidian-900/15 hover:ring-obsidian-900/40"
              }`}
            >
              {d.departureTime.slice(0, 5)}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-slate-700" aria-live="polite">
        {selected && selectedDay ? (
          <>
            <span className="text-obsidian-900">
              {longDate(selectedDay)} · {selected.departureTime.slice(0, 5)}
            </span>
            <span className="block text-slate-600">{describe(selected)}</span>
          </>
        ) : bookable.length > 0 ? (
          "Choose a day marked with a dot."
        ) : (
          "No bookable dates right now."
        )}
      </p>
    </fieldset>
  );
}
