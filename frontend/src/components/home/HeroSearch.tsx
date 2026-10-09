"use client";

// Booking search in the home hero (GetYourGuide / Viator / Expedia): experience type, date and
// guests in one bar, submitted as a plain GET form to /search so it works before hydration.
// Desktop: one compact white pill with labelled segments. Phones: a stacked card. The date
// field opens its calendar on click or focus (no need to hit the small calendar icon).

import { CalendarDays, Compass, Search, Users } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";
import { openDatePicker } from "@/lib/utils/datePicker";

const SEGMENT = "group relative flex min-w-0 flex-col justify-center rounded-[1.25rem] px-4 py-1.5 transition-colors hover:bg-obsidian-50 focus-within:bg-obsidian-50";
const LABEL = "flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-slate-600";
// Dropdown's bare trigger is text-base with a top margin; the compact bar wants text-sm.
const TRIGGER = "!mt-0 !text-sm";
const CONTROL =
  "w-full min-w-0 cursor-pointer appearance-none bg-transparent text-sm text-obsidian-900 focus:outline-none";

export function HeroSearch({ className = "" }: { className?: string }) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label="Find a tour"
      className={`grid gap-1 rounded-[1.5rem] bg-white p-1.5 text-left shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_0.85fr_auto] lg:items-stretch lg:rounded-full ${className}`}
    >
      <div className={`${SEGMENT} lg:rounded-full`}>
        <Dropdown
          variant="bare"
          name="category"
          defaultValue=""
          labelClassName={LABEL}
          triggerClassName={TRIGGER}
          label={
            <>
              <Compass className="h-3.5 w-3.5 text-ocean-600" aria-hidden="true" />
              Experience
            </>
          }
          options={[
            { value: "", label: "All experiences" },
            { value: "SHARED", label: "Shared tours" },
            { value: "PRIVATE", label: "Private tours" },
            { value: "SHUTTLE", label: "Lake shuttles" },
            { value: "MULTIDAY", label: "Multi-day trips" },
            { value: "TICKET", label: "Activity tickets" },
          ]}
        />
      </div>
      <label className={`${SEGMENT} lg:rounded-full lg:before:absolute lg:before:left-0 lg:before:top-1/4 lg:before:h-1/2 lg:before:w-px lg:before:bg-obsidian-900/10`}>
        <span className={LABEL}>
          <CalendarDays className="h-3.5 w-3.5 text-ocean-600" aria-hidden="true" />
          Date
        </span>
        <input type="date" name="date" onClick={openDatePicker} onFocus={openDatePicker} className={CONTROL} />
      </label>
      <div className={`${SEGMENT} lg:rounded-full lg:before:absolute lg:before:left-0 lg:before:top-1/4 lg:before:h-1/2 lg:before:w-px lg:before:bg-obsidian-900/10`}>
        <Dropdown
          variant="bare"
          name="seats"
          defaultValue="2"
          labelClassName={LABEL}
          triggerClassName={TRIGGER}
          label={
            <>
              <Users className="h-3.5 w-3.5 text-ocean-600" aria-hidden="true" />
              Guests
            </>
          }
          options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? "guest" : "guests"}` }))}
        />
      </div>
      <button
        type="submit"
        className="golden-summit-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-[1.25rem] px-6 text-sm sm:col-span-2 lg:col-span-1 lg:rounded-full"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        Search
      </button>
    </form>
  );
}
