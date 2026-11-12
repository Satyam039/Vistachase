"use client";

// Tour recommendations and one tour's details inside the AI concierge (owner, 12 November 2026:
// recommend only what fits, as clickable cards, then explain the tour and book it in the chat).
// The data comes from the backend's product knowledgebase (lib/ai/knowledge) with live prices and
// departures. Tapping a card asks the concierge for that tour; "Book" on a departure opens the
// in-chat checkout (ConciergeCheckout) through the parent.

import Image from "next/image";
import { ArrowRight, CalendarDays, Check, Clock, ExternalLink, MapPin, Users, X } from "lucide-react";

export interface TourCardData {
  slug: string;
  name: string;
  type: "SHARED" | "PRIVATE" | "SHUTTLE";
  days: number;
  image: string;
  overview: string;
  duration: string;
  price: string;
  fromAmount: number | null;
  priceUnit: "per guest" | "per vehicle";
  page: string;
  bookIn: "chat" | "page";
  departures: { id: string; date: string; time: string; seats: number; price: number }[];
}

export interface TourDetailData extends TourCardData {
  stops: string[];
  included: string[];
  notIncluded: string[];
  pickup: string;
  capacity: string;
  season: string;
  seasonNotes: string[];
  cancellation: string;
  departureTimes: string | null;
}

const TYPE_LABEL: Record<TourCardData["type"], string> = { SHARED: "Shared small-group", PRIVATE: "Private", SHUTTLE: "Lake shuttle" };

const shortDate = (d: string) => {
  const parsed = new Date(`${d}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
};
const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const fromLabel = (t: TourCardData) => (t.fromAmount != null ? `From CAD $${t.fromAmount.toLocaleString("en-CA")} ${t.priceUnit}` : t.price);

function TypeBadge({ type, days }: { type: TourCardData["type"]; days: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ocean-50 px-2 py-0.5 text-xs text-ocean-800">
      {TYPE_LABEL[type]}
      {days > 1 ? ` · ${days} days` : ""}
    </span>
  );
}

/** Recommended tours: tap one to see its details in the chat. */
export function ConciergeTourCards({ tours, onOpen }: { tours: TourCardData[]; onOpen: (tour: TourCardData) => void }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-2" aria-label="Recommended tours">
      {tours.map((t) => (
        <li key={t.slug}>
          <button
            type="button"
            onClick={() => onOpen(t)}
            className="group flex w-full gap-3 border border-obsidian-900/10 bg-white p-2.5 text-left transition-colors hover:border-ocean-600/50 hover:bg-ocean-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ocean-600"
          >
            <span className="relative h-24 w-24 shrink-0 overflow-hidden bg-obsidian-100 sm:h-28 sm:w-28">
              <Image src={t.image} alt="" fill sizes="112px" className="object-cover" />
            </span>
            <span className="min-w-0 flex-1">
              <TypeBadge type={t.type} days={t.days} />
              <span className="mt-1 block text-sm leading-snug text-obsidian-900">{t.name}</span>
              <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-600">{t.overview}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-700">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {t.duration}
                </span>
                <span>{fromLabel(t)}</span>
              </span>
              {t.departures[0] ? (
                <span className="mt-0.5 flex items-center gap-1 text-xs text-emerald-800">
                  <CalendarDays className="h-3 w-3" aria-hidden="true" />
                  Next: {shortDate(t.departures[0].date)} · {clock(t.departures[0].time)}
                </span>
              ) : t.bookIn === "page" ? (
                <span className="mt-0.5 block text-xs text-slate-600">Choose dates for each day when booking</span>
              ) : null}
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-ocean-700 group-hover:underline">
                View details
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One tour: overview, stops, inclusions, pickup, price and dates to book in the chat. */
export function ConciergeTourDetail({
  tour,
  onBook,
  onAsk,
}: {
  tour: TourDetailData;
  onBook: (departure: TourDetailData["departures"][number]) => void;
  onAsk: (text: string) => void;
}) {
  return (
    <article className="overflow-hidden border border-obsidian-900/10 bg-white" aria-label={tour.name}>
      <div className="relative aspect-[16/9] w-full bg-obsidian-100">
        <Image src={tour.image} alt={tour.name} fill sizes="(max-width: 640px) 100vw, 480px" className="object-cover" />
      </div>
      <div className="space-y-3 p-4">
        <div>
          <TypeBadge type={tour.type} days={tour.days} />
          <h3 className="mt-1.5 text-lg leading-snug text-obsidian-900">{tour.name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{tour.overview}</p>
        </div>
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
          <div className="flex gap-1.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
            <dt className="sr-only">Duration</dt>
            <dd>{tour.duration}</dd>
          </div>
          <div className="flex gap-1.5">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
            <dt className="sr-only">Group</dt>
            <dd>{tour.capacity}</dd>
          </div>
          <div className="flex gap-1.5 sm:col-span-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
            <dt className="sr-only">Pickup</dt>
            <dd>{tour.pickup}</dd>
          </div>
        </dl>
        <p className="text-base text-obsidian-900">
          {tour.price}
          <span className="block text-xs text-slate-600">Taxes and required fees included. {tour.season}.</span>
        </p>

        <details className="group border-t border-obsidian-900/[0.07] pt-2">
          <summary className="cursor-pointer text-sm text-ocean-700">Itinerary ({tour.stops.length} stops)</summary>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-slate-700">
            {tour.stops.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {tour.seasonNotes.map((n) => (
            <p key={n} className="mt-2 text-xs text-slate-600">
              {n}
            </p>
          ))}
        </details>
        <details className="border-t border-obsidian-900/[0.07] pt-2">
          <summary className="cursor-pointer text-sm text-ocean-700">What&apos;s included</summary>
          <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
            {tour.included.map((s) => (
              <li key={s} className="flex gap-1.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                {s}
              </li>
            ))}
            {tour.notIncluded.map((s) => (
              <li key={s} className="flex gap-1.5 text-slate-600">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <span>
                  <span className="sr-only">Not included: </span>
                  {s}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600">{tour.cancellation}</p>
        </details>

        <div className="border-t border-obsidian-900/[0.07] pt-3">
          {tour.bookIn === "chat" ? (
            tour.departures.length ? (
              <>
                <p className="mb-2 text-sm text-slate-700">Next dates with room</p>
                <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                  {tour.departures.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => onBook(d)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-obsidian-900/10 px-3.5 py-2.5 text-left hover:border-ocean-600/50 hover:bg-ocean-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600"
                      >
                        <span className="text-sm text-obsidian-900">
                          {shortDate(d.date)} · {clock(d.time)}
                        </span>
                        <span className="text-right text-sm text-obsidian-900">
                          CAD ${d.price.toLocaleString("en-CA")}
                          <span className="block text-xs text-ocean-700">Book</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => onAsk(`Other dates for ${tour.name}`)} className="mt-2 text-sm text-ocean-700 underline-offset-4 hover:underline">
                  Other dates
                </button>
              </>
            ) : (
              <button type="button" onClick={() => onAsk(`What dates are available for ${tour.name}?`)} className="text-sm text-ocean-700 underline-offset-4 hover:underline">
                Check dates
              </button>
            )
          ) : (
            <a href={tour.page} target="_blank" rel="noopener" className="golden-summit-btn inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm">
              Choose dates and book
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
