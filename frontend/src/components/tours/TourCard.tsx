"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Clock, MapPin, Star, Users } from "lucide-react";
import { PriceTag } from "@/components/pricing/PriceTag";
import { hasPrice } from "@/lib/pricing";
import { cancellationShort, SEATS_MESSAGE } from "@/lib/policy";
import type { TourWithAvailability } from "@/lib/api/types";
import {
  CATEGORY_LABEL,
  departureFits,
  durationLabel,
  fromPrice,
  groupLabel,
  isVehicleTour,
  nextDepartureFor,
  priceUnitLabel,
  reviewsLabel,
} from "@/lib/tours";

export {
  CATEGORY_LABEL,
  departureFits,
  durationLabel,
  fromPrice,
  groupLabel,
  isVehicleTour,
  nextDepartureFor,
  priceUnitLabel,
  reviewsLabel,
};

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

function availability(tour: TourWithAvailability, seats: number, date?: string) {
  if (tour.bookingMode === "ENQUIRY") {
    return { variant: "neutral" as const, text: "Custom dates on request" };
  }
  if (tour.departures.length === 0) {
    return { variant: "neutral" as const, text: "Dates on request" };
  }
  const next = nextDepartureFor(tour, seats, date);
  if (!next) {
    return {
      variant: "error" as const,
      text: date ? `Full on ${formatShortDate(date)}` : `No dates for ${seats} guests`,
    };
  }
  if (isVehicleTour(tour)) {
    return { variant: "success" as const, text: `Available · ${formatShortDate(next.date)}` };
  }
  return { variant: "success" as const, text: `${SEATS_MESSAGE} · ${formatShortDate(next.date)}` };
}

/** Rail item width for TourCards: a little wider than the Rail default at 1280px+ so the compact card stays near-square. */
export const TOUR_CARD_RAIL_ITEM = "w-[80vw] max-w-[22rem] sm:w-[21rem]";

/** Earned badges only: the shared Banff tour is TripAdvisor's #6 experience in Canada (2026). */
const AWARD_BADGE: Record<string, string> = {
  "banff-highlights-tour": "Best of the Best 2026",
};

// Compact luxury card, Rolls-Royce style ("Explore further" tiles): a large 16:10 photo carrying
// the badges and the destination, then a short near-black panel with a letter-spaced title, one
// line of key facts, the cancellation terms with live availability, and a one-line price. Near-square
// overall, hairline border, tight spacing; the catalog summary stays on the product page. The
// whole card is one link (title link stretched over it), so there is a single tab stop per card.
export function TourCard({
  tour,
  seats = 1,
  date,
  headingLevel = 3,
}: {
  tour: TourWithAvailability;
  seats?: number;
  date?: string;
  headingLevel?: 2 | 3;
}) {
  const TitleTag = headingLevel === 2 ? "h2" : "h3";
  const unitLabel = tour.priceUnit === "GROUP" ? "group" : tour.category === "TICKET" ? "ticket" : "guest";
  const status = availability(tour, seats, date);
  const price = fromPrice(tour);
  const award = AWARD_BADGE[tour.slug];
  // Short visible form of the policy; screen readers get the full wording.
  const cancelLabel = tour.category === "TICKET" ? "Operator's cancellation rules" : "Free cancellation · 72 h";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg bg-obsidian-950 text-white ring-1 ring-white/[0.08] transition-shadow duration-500 ease-out hover:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.6)]">
      {/* Media: the photo leads; badges on top, destination over a soft scrim */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-obsidian-900">
        <Image
          src={tour.featuredImage}
          alt=""
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 46vw, (max-width: 1280px) 31vw, 400px"
          className="object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-obsidian-950/85 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 flex flex-wrap gap-1.5 p-3">
          {award ? (
            <span className="rounded-full bg-summit-200 px-2.5 py-0.5 text-xs text-obsidian-900">{award}</span>
          ) : (
            <span className="rounded-full bg-obsidian-950/55 px-2.5 py-0.5 text-xs text-white ring-1 ring-white/15 backdrop-blur-md">
              {CATEGORY_LABEL[tour.category] ?? tour.category}
            </span>
          )}
          {tour.category === "SHUTTLE" && (
            <span className="rounded-full bg-obsidian-950/55 px-2.5 py-0.5 text-xs text-white ring-1 ring-white/15 backdrop-blur-md">Guaranteed lake access</span>
          )}
        </div>
        <p className="absolute inset-x-0 bottom-0 flex min-w-0 items-center gap-1 px-4 pb-2.5 text-xs uppercase tracking-[0.14em] text-white">
          <MapPin className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
          <span className="truncate">{tour.destination.name}</span>
        </p>
      </div>

      {/* Body: title, key facts, terms + availability, price */}
      <div className="flex flex-1 flex-col px-4 pb-3.5 pt-3.5">
        <TitleTag className="line-clamp-2 text-sm font-light uppercase leading-snug tracking-[0.12em] text-white sm:text-[0.95rem]">
          <Link href={`/${tour.slug}`} className="focus-visible:outline-none">
            <span className="absolute inset-0 z-10 rounded-lg group-has-[:focus-visible]:outline group-has-[:focus-visible]:outline-2 group-has-[:focus-visible]:outline-offset-2 group-has-[:focus-visible]:outline-summit-300" />
            {tour.title}
          </Link>
        </TitleTag>

        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/75" aria-label="Key details">
          <li className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
            {durationLabel(tour)}
          </li>
          <li className="flex min-w-0 items-center gap-1">
            <Users className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
            <span className="truncate">{groupLabel(tour)}</span>
          </li>
          <li className="flex items-center gap-1 whitespace-nowrap">
            {tour.reviewCount > 0 ? (
              <>
                <Star className="h-3 w-3 shrink-0 fill-summit-300 text-summit-300" aria-hidden="true" />
                <span>
                  {tour.rating.toFixed(1)}
                  <span className="sr-only"> out of 5,</span> <span className="text-white/50">({reviewsLabel(tour)})</span>
                </span>
              </>
            ) : (
              <span className="text-white/60">New on Vista Chase</span>
            )}
          </li>
        </ul>

        <p className="mb-3 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/55">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
            <span aria-hidden="true">{cancelLabel}</span>
            <span className="sr-only">{cancellationShort(tour.category)}.</span>
          </span>
          <span className={`inline-flex items-center gap-1 ${status.variant === "error" ? "text-red-300" : ""}`}>
            <CalendarDays className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
            {status.text}
          </span>
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/[0.08] pt-2.5">
          <div className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
            {hasPrice(price) && <span className="text-xs text-white/55">From</span>}
            <PriceTag price={price} currency={tour.currency} unit={`${tour.currency}/${unitLabel}`} size="sm" tone="dark" layout="inline" />
          </div>
          <span className="mb-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ring-summit-200/40 text-summit-200 transition-colors duration-300 group-hover:bg-summit-200 group-hover:text-obsidian-900" aria-hidden="true">
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
