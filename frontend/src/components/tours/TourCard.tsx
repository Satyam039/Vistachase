"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, MapPin, Star, Users } from "lucide-react";
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

// Compact luxury card, Rolls-Royce style: a wide photo, then a tight near-black panel with the
// title, a one-line description (the tour's own catalog summary), key details in one small row,
// availability and the price. Near-square overall, hairline border, minimal spacing. The whole
// card is one link (title link stretched over it), so there is a single tab stop per card.
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
  const priceLabel = tour.priceUnit === "GROUP" ? "Per group from" : tour.category === "TICKET" ? "Per ticket from" : "Per guest from";
  const status = availability(tour, seats, date);
  const price = fromPrice(tour);
  const award = AWARD_BADGE[tour.slug];

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-obsidian-950 text-white ring-1 ring-white/[0.08] transition-[box-shadow,transform] duration-500 ease-out hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.6)]">
      {/* Media: a wide photo with the badges on top and the destination over a soft scrim */}
      <div className="relative aspect-[2/1] w-full overflow-hidden bg-obsidian-900">
        <Image
          src={tour.featuredImage}
          alt=""
          fill
          sizes="(max-width: 640px) 85vw, (max-width: 1024px) 46vw, (max-width: 1280px) 31vw, 400px"
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

      {/* Body: title, description, key details, availability, price */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <TitleTag className="line-clamp-2 text-base font-light leading-snug tracking-[0.01em] text-white sm:text-lg">
          <Link href={`/${tour.slug}`} className="focus-visible:outline-none">
            <span className="absolute inset-0 z-10 rounded-2xl group-has-[:focus-visible]:outline group-has-[:focus-visible]:outline-2 group-has-[:focus-visible]:outline-offset-2 group-has-[:focus-visible]:outline-summit-300" />
            {tour.title}
          </Link>
        </TitleTag>
        {tour.summary && <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-white/60">{tour.summary}</p>}

        <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/75" aria-label="Key details">
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
          <li className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
            {cancellationShort(tour.category)}
          </li>
        </ul>

        <p className={`mb-3 mt-1.5 text-xs ${status.variant === "error" ? "text-red-300" : "text-white/55"}`}>{status.text}</p>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/[0.08] pt-3">
          <div className="min-w-0">
            {hasPrice(price) && <p className="text-xs text-white/55">{priceLabel}</p>}
            <PriceTag price={price} currency={tour.currency} unit={tour.currency} size="sm" tone="dark" layout="inline" />
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 pb-1.5 text-xs uppercase tracking-[0.14em] text-summit-200" aria-hidden="true">
            View
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </article>
  );
}
