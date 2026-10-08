"use client";

// Tour search / all experiences, laid out like the listing pages of GetYourGuide and Viator:
// a header with the keyword field, type chips, a sticky filter bar (destination, guests, date,
// sort) with the live result count, then results grouped by type in the shared TourCard grid.
//
// Filters live in the URL (/search?q=&category=&destination=&seats=&date=), so a search can be
// shared or bookmarked and Back restores it. The server renders the first result set from the
// same params, so the page works without JS.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronRight, MapPin, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";
import { TourCard, fromPrice, nextDepartureFor } from "@/components/tours/TourCard";
import type { TourWithAvailability } from "@/lib/api/types";

export interface SearchFilters {
  q: string;
  category: string;
  destination: string;
  seats: number;
  date: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  SHARED: "Shared tours",
  PRIVATE: "Private tours",
  SHUTTLE: "Lake shuttles",
  MULTIDAY: "Multi-day packages",
  TICKET: "Activity tickets",
};

const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
] as const;
type SortValue = (typeof SORTS)[number]["value"];

const KEYWORD_URL_DELAY_MS = 300;
const EMPTY: SearchFilters = { q: "", category: "ALL", destination: "ALL", seats: 1, date: "" };
const CONTROL =
  "h-11 w-full appearance-none rounded-full border border-obsidian-900/15 bg-white pl-10 pr-4 text-sm text-obsidian-900 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30";

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function filterTours(tours: TourWithAvailability[], filters: SearchFilters) {
  const keyword = filters.q.trim().toLowerCase();
  return tours.filter((tour) => {
    if (filters.category !== "ALL" && tour.category !== filters.category) return false;
    if (filters.destination !== "ALL" && tour.destination.slug !== filters.destination) return false;
    if (keyword) {
      const text = `${tour.title} ${tour.summary} ${tour.description} ${tour.destination.name} ${tour.highlights.join(" ")}`.toLowerCase();
      if (!text.includes(keyword)) return false;
    }
    // A chosen date narrows to tours that actually run that day with room for the party.
    if (filters.date && !nextDepartureFor(tour, filters.seats, filters.date)) return false;
    return true;
  });
}

function filtersToQuery(filters: SearchFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.category !== "ALL") params.set("category", filters.category);
  if (filters.destination !== "ALL") params.set("destination", filters.destination);
  if (filters.seats !== 1) params.set("seats", String(filters.seats));
  if (filters.date) params.set("date", filters.date);
  return params.toString();
}

// "Price on request" (0) always sorts after priced tours.
const priceKey = (t: TourWithAvailability, dir: 1 | -1) => {
  const p = fromPrice(t);
  return p > 0 ? p * dir : Number.POSITIVE_INFINITY;
};

export function TourSearch({
  tours,
  destinations,
  initialFilters,
}: {
  tours: TourWithAvailability[];
  destinations: { slug: string; name: string }[];
  initialFilters: SearchFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [sort, setSort] = useState<SortValue>("recommended");
  const update = (patch: Partial<SearchFilters>) => setFilters((current) => ({ ...current, ...patch }));

  // Mirror filters into the URL; typing is debounced so each keystroke isn't a history entry.
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = filtersToQuery(filters);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, KEYWORD_URL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [filters, pathname, router]);

  const categories = useMemo(() => ["ALL", ...Object.keys(CATEGORY_LABELS).filter((c) => tours.some((t) => t.category === c))], [tours]);
  const destinationOptions = useMemo(() => destinations.filter((d) => tours.some((t) => t.destination.slug === d.slug)), [destinations, tours]);

  const results = useMemo(() => {
    const filtered = filterTours(tours, filters);
    return [...filtered].sort((a, b) => {
      if (sort === "price-asc") return priceKey(a, 1) - priceKey(b, 1);
      if (sort === "price-desc") return priceKey(a, -1) - priceKey(b, -1);
      if (sort === "rating") return b.rating - a.rating || b.reviewCount - a.reviewCount;
      return b.reviewCount - a.reviewCount || Number(b.isFeatured) - Number(a.isFeatured);
    });
  }, [tours, filters, sort]);

  const sections = useMemo(() => {
    if (filters.category !== "ALL") return [{ category: filters.category, items: results }];
    return categories
      .filter((c) => c !== "ALL")
      .map((category) => ({ category, items: results.filter((t) => t.category === category) }))
      .filter((s) => s.items.length > 0);
  }, [filters.category, results, categories]);

  const hasActiveFilters = filtersToQuery(filters) !== "";

  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      {/* Header + keyword */}
      <section className="border-b border-obsidian-900/[0.06] bg-white">
        <div className="mx-auto max-w-7xl px-page pb-8 pt-10 text-center sm:pt-14">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
              <li>
                <Link href="/" className="hover:text-obsidian-900 hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-obsidian-900">
                All experiences
              </li>
            </ol>
          </nav>
          <h1 className="text-balance text-4xl font-light leading-[1.05] tracking-tight text-obsidian-900 sm:text-5xl">Find your Rockies tour</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg font-light text-slate-600">Tours, shuttles and tickets across Banff, Lake Louise, Moraine Lake, Yoho and Jasper.</p>

          <label className="relative mx-auto mt-7 block max-w-3xl text-left">
            <span className="sr-only">Search tours</span>
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="Search Moraine Lake, sunrise, Icefields…"
              className="h-14 w-full rounded-full border border-obsidian-900/15 bg-white pl-14 pr-5 text-base text-obsidian-900 shadow-[0_12px_30px_-20px_rgba(12,31,33,0.4)] placeholder:text-slate-500 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30"
            />
          </label>

          <div role="group" aria-label="Filter by type" className="vc-rail -mx-page mt-5 flex gap-2 overflow-x-auto px-page [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={filters.category === c}
                onClick={() => update({ category: c })}
                className={`min-h-11 shrink-0 rounded-full border px-5 text-sm transition-colors ${
                  filters.category === c ? "border-obsidian-900 bg-obsidian-900 text-white" : "border-obsidian-900/15 bg-white text-obsidian-900 hover:border-obsidian-900/40"
                }`}
              >
                {c === "ALL" ? "All experiences" : CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Sticky filter bar */}
      <div className="z-20 mx-auto mt-6 max-w-7xl px-page lg:sticky lg:top-[calc(var(--vc-header-h,80px)+16px)]">
        <div className="grid gap-2 rounded-[1.75rem] bg-white p-2 shadow-[0_12px_24px_-20px_rgba(12,31,33,0.45)] ring-1 ring-obsidian-900/[0.08] sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_1fr_1fr_auto] lg:items-center lg:rounded-full">
          <Dropdown
            variant="pill"
            label="Destination"
            hideLabel
            icon={MapPin}
            value={filters.destination}
            onChange={(v) => update({ destination: v })}
            options={[{ value: "ALL", label: "All destinations" }, ...destinationOptions.map((d) => ({ value: d.slug, label: d.name }))]}
          />
          <Dropdown
            variant="pill"
            label="Guests"
            hideLabel
            icon={Users}
            value={String(filters.seats)}
            onChange={(v) => update({ seats: Number(v) || 1 })}
            options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: n === 7 ? "7+ guests" : `${n} ${n === 1 ? "guest" : "guests"}` }))}
          />
          <label className="relative block">
            <span className="sr-only">Date</span>
            <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-600" aria-hidden="true" />
            <input type="date" value={filters.date} min={todayIso()} onChange={(e) => update({ date: e.target.value })} className={CONTROL} />
          </label>
          <Dropdown
            variant="pill"
            label="Sort by"
            hideLabel
            icon={SlidersHorizontal}
            value={sort}
            onChange={(v) => setSort(v as SortValue)}
            options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
          />
          <p className="px-3 text-sm text-slate-600 sm:col-span-2 lg:col-span-1 lg:whitespace-nowrap" aria-live="polite">
            {results.length} {results.length === 1 ? "result" : "results"}
          </p>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-7xl px-page pb-20 pt-10">
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY)}
            className="mb-6 inline-flex h-10 items-center gap-1.5 rounded-full border border-obsidian-900/15 bg-white px-4 text-sm text-obsidian-900 hover:bg-obsidian-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Clear filters
          </button>
        )}

        {results.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-[1.75rem] bg-white p-10 text-center ring-1 ring-obsidian-900/[0.07]">
            <Search className="mx-auto h-8 w-8 text-ocean-600" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-light text-obsidian-900">No tours match these filters</h2>
            <p className="mt-2 text-base text-slate-600">
              {filters.date ? "Nothing runs that day with room for your party. Try another date or a smaller group." : "Try a different keyword, destination or type."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => setFilters(EMPTY)} className="golden-summit-btn inline-flex h-11 items-center rounded-full px-6 text-sm">
                Clear filters
              </button>
              <Link href="/concierge" className="inline-flex h-11 items-center rounded-full border border-obsidian-900/15 px-6 text-sm text-obsidian-900 hover:bg-obsidian-50">
                Ask the concierge
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-14">
            {sections.map((section) => (
              <section key={section.category} aria-labelledby={`results-${section.category}`}>
                <div className="mb-6 flex items-baseline justify-between gap-4">
                  <h2 id={`results-${section.category}`} className="text-2xl font-light tracking-tight text-obsidian-900 sm:text-3xl">
                    {CATEGORY_LABELS[section.category] ?? "Experiences"}
                  </h2>
                  <span className="text-sm text-slate-600">{section.items.length}</span>
                </div>
                <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                  {section.items.map((tour) => (
                    <li key={tour.id}>
                      <TourCard tour={tour} seats={filters.seats} date={filters.date || undefined} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
