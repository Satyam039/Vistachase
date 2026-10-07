// Floating search card overlapping the bottom of the hero (Expedia / GetYourGuide): experience
// type, date and guests, submitted as a plain GET form to /search, so it works before hydration.

import { CalendarDays, Compass, Search, Users } from "lucide-react";

const FIELD =
  "h-12 w-full appearance-none rounded-xl border border-obsidian-900/10 bg-obsidian-50 pl-11 pr-4 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30";

export function HeroSearch() {
  return (
    <div className="relative z-20 mx-auto -mt-14 max-w-6xl px-page sm:-mt-16" data-reveal>
      <form
        action="/search"
        method="get"
        role="search"
        aria-label="Find a tour"
        className="grid gap-3 rounded-[1.75rem] bg-white p-4 shadow-[0_30px_80px_-30px_rgba(12,31,33,0.45)] ring-1 ring-obsidian-900/5 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1.3fr_1fr_0.8fr_auto]"
      >
        <label className="block">
          <span className="mb-1.5 block px-1 text-sm text-slate-600">Experience</span>
          <span className="relative block">
            <Compass className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ocean-600" aria-hidden="true" />
            <select name="category" defaultValue="" className={FIELD}>
              <option value="">All experiences</option>
              <option value="SHARED">Shared tours</option>
              <option value="PRIVATE">Private tours</option>
              <option value="SHUTTLE">Lake shuttles</option>
              <option value="MULTIDAY">Multi-day packages</option>
              <option value="TICKET">Activity tickets</option>
            </select>
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block px-1 text-sm text-slate-600">Date</span>
          <span className="relative block">
            <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ocean-600" aria-hidden="true" />
            <input type="date" name="date" className={FIELD} />
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block px-1 text-sm text-slate-600">Guests</span>
          <span className="relative block">
            <Users className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ocean-600" aria-hidden="true" />
            <select name="seats" defaultValue="2" className={FIELD}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "guest" : "guests"}
                </option>
              ))}
            </select>
          </span>
        </label>
        <button
          type="submit"
          className="golden-summit-btn inline-flex h-12 items-center justify-center gap-2 self-end rounded-xl px-8 text-base sm:col-span-2 lg:col-span-1"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
          Search
        </button>
      </form>
    </div>
  );
}
