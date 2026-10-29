"use client";

import Image from "next/image";
import Link from "next/link";
import { CARD_BADGE, CARD_EYEBROW, CARD_PANEL, CARD_TITLE } from "@/components/cards/MediaCard";
import { ArrowRight, CalendarDays, CheckCircle2, Clock, MapPin, Star, Users } from "lucide-react";
import { PriceTag } from "@/components/pricing/PriceTag";
import { hasPrice } from "@/lib/pricing";
import { cancellationBadge, cancellationShort, SEATS_MESSAGE } from "@/lib/policy";
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

// Square-cornered card, Rolls-Royce style ("Explore further" tiles): the photo is its own block
// on top (badges only, no text over it), then a separate near-black panel with a hairline border
// holding the destination, a letter-spaced uppercase title, one line of key facts, the cancellation
// terms with live availability, and a one-line price. The catalog summary stays on the product
// page. The whole card is one link (title link stretched over it), so there is a single tab stop.
export function TourCard({
  tour,
  seats = 1,
  date,
  headingLevel = 3,
  title,
  image,
}: {
  tour: TourWithAvailability;
  seats?: number;
  date?: string;
  headingLevel?: 2 | 3;
  /** Name and photo to show instead of the catalog's (home rail cards use the landing pages'). */
  title?: string;
  image?: string;
}) {
  const TitleTag = headingLevel === 2 ? "h2" : "h3";
  const unitLabel = tour.priceUnit === "GROUP" ? "group" : tour.category === "TICKET" ? "ticket" : "guest";
  const status = availability(tour, seats, date);
  const price = fromPrice(tour);
  const award = AWARD_BADGE[tour.slug];
  // Short visible form of the policy; screen readers get the full wording.
  const cancelLabel = cancellationBadge(tour.category);
  // Every tour and shuttle in the catalog picks up in Banff and Canmore; tickets have no pickup.
  const pickup = tour.category !== "TICKET";

  return (
    <article className="group relative flex h-full flex-col text-white transition-transform duration-500 ease-out hover:-translate-y-1">
      {/* Image block: square corners, nothing over the photo but the badges */}
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-obsidian-900">
        <Image
          src={image ?? tour.featuredImage}
          alt=""
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 46vw, (max-width: 1280px) 31vw, 400px"
          className="object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-0 top-0 flex flex-wrap gap-1.5 p-3">
          {award ? (
            <span className="bg-summit-200 px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.12em] text-obsidian-900">{award}</span>
          ) : (
            <span className={CARD_BADGE}>
              {CATEGORY_LABEL[tour.category] ?? tour.category}
            </span>
          )}
          {tour.category === "SHUTTLE" && (
            <span className={CARD_BADGE}>Guaranteed lake access</span>
          )}
        </div>
      </div>

      {/* Content panel: separate from the photo, square, hairline border */}
      <div className={CARD_PANEL}>
        <p className={CARD_EYEBROW}>
          <MapPin className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
          <span className="truncate">{tour.destination.name}</span>
        </p>
        <TitleTag className={CARD_TITLE}>
          <Link href={`/${tour.slug}`} className="focus-visible:outline-none">
            <span className="absolute inset-0 z-10 group-has-[:focus-visible]:outline group-has-[:focus-visible]:outline-2 group-has-[:focus-visible]:outline-offset-2 group-has-[:focus-visible]:outline-summit-300" />
            {title ?? tour.title}
          </Link>
        </TitleTag>

        <ul className="mt-3 flex gap-x-3 text-xs text-white/75" aria-label="Key details">
          <li className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            <Clock className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
            {durationLabel(tour)}
          </li>
          {/* Capacity and rating stay together on one line (rating right after capacity, no review count). */}
          <li className="flex min-w-0 items-center gap-3">
            <span className="flex min-w-0 items-center gap-1">
              <Users className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
              <span className="truncate">{groupLabel(tour)}</span>
            </span>
            {tour.reviewCount > 0 ? (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                <Star className="h-3 w-3 shrink-0 fill-summit-300 text-summit-300" aria-hidden="true" />
                <span>
                  {tour.rating.toFixed(1)}
                  <span className="sr-only"> out of 5</span>
                </span>
              </span>
            ) : (
              <span className="shrink-0 whitespace-nowrap text-white/60">New on Vista Chase</span>
            )}
          </li>
        </ul>

        {pickup && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-white/55">
            <MapPin className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
            Pickup in Banff &amp; Canmore
          </p>
        )}

        <p className="mb-4 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/55">
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

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/[0.1] pt-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
              {hasPrice(price) && <span className="text-xs text-white/55">From</span>}
              <PriceTag price={price} currency={tour.currency} unit={`${tour.currency}/${unitLabel}`} size="sm" tone="dark" layout="inline" />
            </div>
            {hasPrice(price) && <p className="mt-0.5 text-xs text-white/55">Taxes and required fees included</p>}
          </div>
          <span className="mb-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center ring-1 ring-summit-200/40 text-summit-200 transition-colors duration-300 group-hover:bg-summit-200 group-hover:text-obsidian-900" aria-hidden="true">
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
