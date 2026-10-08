"use client";

// Departure date picker: a month calendar (Astryx Calendar) where only days with a bookable
// departure can be picked. Those days carry a small gold dot; days without a departure, or sold
// out, are greyed out. A legend explains the three states, and the chosen departure is spelled out
// underneath. When a day has more than one departure, its times appear as a second choice.

import { Calendar, type ISODateString } from "@astryxdesign/core/Calendar";
import type { DepartureAvailability } from "@/lib/api/types";

const dayOf = (d: DepartureAvailability) => d.date.slice(0, 10) as ISODateString;
const isoOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` as ISODateString;

export function DepartureCalendar({
  departures,
  isBookable,
  value,
  onChange,
  describe,
}: {
  departures: DepartureAvailability[];
  /** Whether this departure can be booked for the current party (seats left, whole vehicle free). */
  isBookable: (d: DepartureAvailability) => boolean;
  /** Selected departure id. */
  value: string;
  onChange: (departureId: string) => void;
  /** The line shown under the calendar for the selected departure (price, availability). */
  describe: (d: DepartureAvailability) => string;
}) {
  const bookable = departures.filter(isBookable);
  const bookableDays = new Set(bookable.map(dayOf));
  const selected = departures.find((d) => d.id === value);
  const selectedDay = selected ? dayOf(selected) : undefined;
  const sameDay = selectedDay ? bookable.filter((d) => dayOf(d) === selectedDay) : [];
  const days = Array.from(bookableDays).sort();

  const time = (d: DepartureAvailability) => d.departureTime.slice(0, 5);
  const longDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });

  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 block text-sm text-slate-700">Departure date</legend>
      <div className="vc-departure-cal rounded-2xl border border-obsidian-900/10 bg-white p-2">
        <Calendar
          value={selectedDay}
          min={days[0]}
          max={days[days.length - 1]}
          dateConstraints={[(date) => bookableDays.has(isoOf(date))]}
          hasOutsideDays={false}
          hasVariableRowCount
          onChange={(iso) => {
            const first = bookable.find((d) => dayOf(d) === iso);
            if (first) onChange(first.id);
          }}
        />
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Calendar key">
        <li className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-summit-500" aria-hidden="true" />
          Available
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-ocean-600" aria-hidden="true" />
          Selected
        </li>
        <li className="flex items-center gap-1.5">
          <span className="text-slate-500 line-through" aria-hidden="true">
            12
          </span>
          Not available
        </li>
      </ul>

      {sameDay.length > 1 && (
        <div role="radiogroup" aria-label="Departure time" className="flex flex-wrap gap-2">
          {sameDay.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={d.id === value}
              onClick={() => onChange(d.id)}
              className={`h-10 rounded-full px-4 text-sm ring-1 transition-colors ${
                d.id === value ? "bg-obsidian-900 text-white ring-obsidian-900" : "bg-white text-obsidian-900 ring-obsidian-900/15 hover:ring-obsidian-900/40"
              }`}
            >
              {time(d)}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-slate-700" aria-live="polite">
        {selected && selectedDay ? (
          <>
            <span className="text-obsidian-900">
              {longDate(selectedDay)} · {time(selected)}
            </span>
            <span className="block text-slate-600">{describe(selected)}</span>
          </>
        ) : bookable.length > 0 ? (
          "Choose a highlighted day."
        ) : (
          "No bookable dates right now."
        )}
      </p>
    </fieldset>
  );
}
