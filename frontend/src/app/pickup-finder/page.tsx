"use client";

// Hotel pickup finder: photo hero with the search card overlapping it (like the home search),
// town pills, and a photo card per pickup point (Airbnb / GetYourGuide "meeting point" pattern):
// the place, where exactly to wait, the services that stop there and directions. Photos come from
// lib/pickupPhotos (the hotel itself where we have it, otherwise its town, labelled as such).
// Title/description are in layout.tsx.

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Bus,
  ChevronRight,
  Clock,
  Footprints,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { pickupPhoto } from "@/lib/pickupPhotos";
import type { PickupLocation } from "@/lib/api/types";

const TOWNS = ["All", "Banff", "Canmore", "Lake Louise"];

export default function PickupFinderPage() {
  const [query, setQuery] = useState("");
  const [town, setTown] = useState("All");
  const [pickups, setPickups] = useState<PickupLocation[] | null>(null);

  useEffect(() => {
    fetch("/api/pickups")
      .then((res) => res.json())
      .then((data) => setPickups(data.pickups || []))
      .catch(() => setPickups([]));
  }, []);

  const shown = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (pickups ?? []).filter(
      (p) =>
        (town === "All" || p.town === town) &&
        (!q || `${p.name} ${p.address} ${p.town}`.toLowerCase().includes(q)),
    );
  }, [pickups, query, town]);

  // Each stop's position among its town's non-hotel stops in the full list, so area photos
  // alternate and a stop keeps the same photo whatever the filter.
  const photoTurn = useMemo(() => {
    const seen: Record<string, number> = {};
    const turns = new Map<string, number>();
    for (const p of pickups ?? []) {
      if (pickupPhoto(p.name, p.town)?.kind === "hotel") continue;
      turns.set(p.id, (seen[p.town] = (seen[p.town] ?? -1) + 1));
    }
    return turns;
  }, [pickups]);

  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      {/* Hero */}
      <section className="relative isolate flex min-h-[46vh] items-end overflow-hidden bg-ocean-950 text-white">
        <Image
          src="/media/photos/fairmont-banff-springs.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover"
          data-parallax="10"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/60 to-ocean-950/20" />
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-page pb-24 pt-20 text-center">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center justify-center gap-1.5 text-sm text-slate-200">
              <li>
                <Link href="/" className="hover:text-white hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-white">
                Pickup finder
              </li>
            </ol>
          </nav>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-6xl motion-safe:animate-[fadeUp_900ms_ease-out]">
            Find your hotel pickup
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-light leading-relaxed text-white/85 motion-safe:animate-[fadeUp_1100ms_ease-out]">
            Search your hotel to see your pickup point and where to wait in
            Banff, Canmore and Lake Louise.
          </p>
        </div>
      </section>

      {/* Search card */}
      <div className="relative z-10 mx-auto -mt-14 max-w-6xl px-page">
        <div className="space-y-4 rounded-[1.75rem] bg-white p-4 shadow-[0_30px_70px_-35px_rgba(12,31,33,0.5)] ring-1 ring-obsidian-900/5 sm:p-5">
          <label className="relative block">
            <span className="sr-only">Search your hotel</span>
            <Search
              className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Your hotel, e.g. Fairmont, Caribou Lodge, Coast Canmore"
              className="h-14 w-full rounded-full border border-obsidian-900/15 bg-obsidian-50 pl-14 pr-5 text-base text-obsidian-900 placeholder:text-slate-500 focus:border-ocean-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ocean-600/30"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Filter by town"
              className="flex flex-wrap gap-2"
            >
              {TOWNS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={town === t}
                  onClick={() => setTown(t)}
                  className={`min-h-11 rounded-full border px-5 text-sm transition-colors ${
                    town === t
                      ? "border-obsidian-900 bg-obsidian-900 text-white"
                      : "border-obsidian-900/15 bg-white text-obsidian-900 hover:border-obsidian-900/40"
                  }`}
                >
                  {t === "All" ? "All towns" : t}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-600" aria-live="polite">
              {pickups === null
                ? "Loading pickup points…"
                : `${shown.length} pickup ${shown.length === 1 ? "point" : "points"}`}
            </p>
          </div>
        </div>
      </div>

      {/* Results */}
      <section
        aria-label="Pickup points"
        className="mx-auto max-w-6xl px-page py-12"
      >
        {pickups !== null && shown.length === 0 ? (
          <div className="rounded-[1.75rem] bg-white p-10 text-center ring-1 ring-obsidian-900/[0.07]">
            <Building2
              className="mx-auto h-9 w-9 text-ocean-600"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-2xl font-light text-obsidian-900">
              No match for your hotel
            </h2>
            <p className="mx-auto mt-2 max-w-md text-base text-slate-600">
              Staying in a rental or a hotel that&rsquo;s not listed?
              We&rsquo;ll confirm the nearest pickup point before your travel
              date.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setTown("All");
                }}
                className="inline-flex h-11 items-center rounded-full border border-obsidian-900/15 px-5 text-sm text-obsidian-900 hover:bg-obsidian-50"
              >
                Show all pickup points
              </button>
              <Link
                href="/contact-us"
                className="golden-summit-btn inline-flex h-11 items-center rounded-full px-5 text-sm"
              >
                Ask us about your hotel
              </Link>
            </div>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-stagger>
            {shown.map((p) => {
              const photo = pickupPhoto(
                p.name,
                p.town,
                photoTurn.get(p.id) ?? 0,
              );
              return (
                <li key={p.id}>
                  <article
                    aria-labelledby={`pickup-${p.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07] transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-36px_rgba(12,31,33,0.55)]"
                  >
                    {/* Photo with the town and, for area photos, an honest label */}
                    <div className="relative aspect-[16/10] overflow-hidden bg-obsidian-100">
                      {photo && (
                        <Image
                          src={photo.src}
                          alt={photo.alt}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.05]"
                        />
                      )}
                      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-sm text-obsidian-900 shadow-sm">
                        <MapPin
                          className="h-3.5 w-3.5 text-ocean-600"
                          aria-hidden="true"
                        />
                        {p.town}
                      </span>
                      {photo?.kind === "area" && (
                        <span className="absolute bottom-3 right-3 rounded-full bg-obsidian-950/70 px-2.5 py-0.5 text-xs text-white backdrop-blur-sm">
                          Area photo · {photo.place}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <h2
                        id={`pickup-${p.id}`}
                        className="text-xl font-light leading-snug text-obsidian-900"
                      >
                        {p.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">{p.address}</p>

                      {/* Where exactly to wait */}
                      <div className="mt-5 flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-summit-100 text-obsidian-900">
                          <Footprints className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <p className="text-sm leading-relaxed text-slate-700">
                          <span className="block text-xs uppercase tracking-[0.14em] text-slate-600">
                            Where to wait
                          </span>
                          {p.instructions}
                        </p>
                      </div>

                      {p.shuttleLines.length > 0 && (
                        <div className="mt-4 flex items-start gap-3">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ocean-50 text-ocean-700">
                            <Bus className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-600">
                              Picked up here
                            </p>
                            <ul className="mt-1.5 flex flex-wrap gap-1.5">
                              {p.shuttleLines.map((line) => (
                                <li
                                  key={line}
                                  className="rounded-full bg-obsidian-50 px-2.5 py-0.5 text-sm text-obsidian-900 ring-1 ring-obsidian-900/[0.06]"
                                >
                                  {line}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* mt-auto keeps the footer at the card's foot; pt-6 guarantees a gap above the
                          divider even on the fullest card. */}
                      <div className="mt-auto pt-6">
                        <div className="flex items-center justify-between gap-3 border-t border-obsidian-900/[0.06] pt-5">
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ocean-600 px-4 text-sm text-white hover:bg-ocean-700"
                          >
                            Directions
                            <ArrowUpRight
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                            <span className="sr-only">
                              to {p.name} (opens Google Maps in a new tab)
                            </span>
                          </a>
                          <Link
                            href="/search"
                            className="inline-flex h-10 items-center gap-1 text-sm text-ocean-700 underline-offset-4 hover:underline"
                          >
                            Find a tour
                            <ChevronRight
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* On the day */}
      <section
        aria-labelledby="tips-heading"
        className="mx-auto max-w-6xl px-page pb-20"
      >
        <div className="grid gap-6 rounded-[1.75rem] bg-ocean-950 p-7 text-white sm:p-9 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <h2 id="tips-heading" className="text-2xl font-light text-white">
              On the day
            </h2>
            <ul className="mt-4 space-y-2.5 text-base text-white/85">
              <li className="flex items-start gap-2.5">
                <Clock
                  className="mt-0.5 h-5 w-5 shrink-0 text-summit-400"
                  aria-hidden="true"
                />
                Be at your pickup point 10 minutes early; vehicles keep to Parks
                Canada timed windows and can&rsquo;t wait.
              </li>
              <li className="flex items-start gap-2.5">
                <Sparkles
                  className="mt-0.5 h-5 w-5 shrink-0 text-summit-400"
                  aria-hidden="true"
                />
                We confirm your exact pickup time the day before your trip.
              </li>
            </ul>
          </div>
          <Link
            href="/account/trips"
            className="golden-summit-btn inline-flex h-12 items-center justify-center rounded-full px-6 text-base"
          >
            Check my booking
          </Link>
        </div>
      </section>
    </div>
  );
}
