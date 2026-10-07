"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock, MapPin, Star, Users } from "lucide-react";
import { PriceTag } from "@/components/pricing/PriceTag";
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

const LOW_SEATS = 4;

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
  return {
    variant: next.seatsAvailable <= LOW_SEATS ? ("warning" as const) : ("success" as const),
    text: `${next.seatsAvailable} seats left · ${formatShortDate(next.date)}`,
  };
}

/** Earned badges only: the shared Banff tour is TripAdvisor's #6 experience in Canada (2025). */
const AWARD_BADGE: Record<string, string> = {
  "banff-highlights-tour": "Best of the Best 2025",
};

// Card anatomy shared by GetYourGuide, Viator and Civitatis: photo first with at most two
// chips, then place, title, rating + count as one unit, a meta line, free cancellation, and
// the price (struck original + offer) at the foot. The whole card is one link (title link
// stretched over it), so there is a single tab stop per card.
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
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07] transition-[box-shadow,transform] duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(12,31,33,0.45)]">
      {/* Media */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-obsidian-100">
        <Image
          src={tour.featuredImage}
          alt=""
          fill
          sizes="(max-width: 640px) 85vw, (max-width: 1024px) 46vw, (max-width: 1280px) 31vw, 300px"
          className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]"
        />
        <div className="absolute inset-x-0 top-0 flex flex-wrap gap-2 p-3.5">
          {award ? (
            <span className="rounded-full bg-summit-500 px-3 py-1 text-xs text-obsidian-900 shadow-sm">{award}</span>
          ) : (
            <span className="rounded-full bg-white/95 px-3 py-1 text-xs text-obsidian-900 shadow-sm">
              {CATEGORY_LABEL[tour.category] ?? tour.category}
            </span>
          )}
          {tour.category === "SHUTTLE" && (
            <span className="rounded-full bg-obsidian-900/80 px-3 py-1 text-xs text-white backdrop-blur">Guaranteed lake access</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <p className="flex items-center gap-1.5 text-sm text-slate-600">
          <MapPin className="h-3.5 w-3.5 text-ocean-600" aria-hidden="true" />
          {tour.destination.name}
        </p>

        <TitleTag className="text-lg leading-snug text-obsidian-900 transition-colors group-hover:text-ocean-700">
          <Link href={`/${tour.slug}`} className="focus-visible:outline-none">
            <span className="absolute inset-0 z-10 rounded-[1.75rem] group-has-[:focus-visible]:outline group-has-[:focus-visible]:outline-2 group-has-[:focus-visible]:outline-offset-2 group-has-[:focus-visible]:outline-ocean-600" />
            {tour.title}
          </Link>
        </TitleTag>

        {tour.reviewCount > 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-obsidian-900">
            <Star className="h-4 w-4 fill-summit-500 text-summit-500" aria-hidden="true" />
            <span>
              {tour.rating.toFixed(1)}
              <span className="sr-only"> out of 5,</span> <span className="text-slate-600">({reviewsLabel(tour)})</span>
            </span>
          </p>
        ) : (
          <p className="text-sm text-slate-600">New on Vista Chase</p>
        )}

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {durationLabel(tour)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {groupLabel(tour)}
          </span>
        </p>

        <p className="flex items-center gap-1.5 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Free cancellation up to 24 hours before
        </p>

        <p
          className={`text-sm ${
            status.variant === "warning"
              ? "text-amber-800"
              : status.variant === "error"
              ? "text-red-700"
              : status.variant === "neutral"
              ? "text-slate-600"
              : "text-emerald-800"
          }`}
        >
          {status.text}
        </p>

        <div className="mt-auto border-t border-obsidian-900/[0.07] pt-4">
          <PriceTag price={price} currency={tour.currency} lead={priceLabel} size="sm" />
        </div>
      </div>
    </article>
  );
}
