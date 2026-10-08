"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, MapPin, Star, Users } from "lucide-react";
import { PriceTag } from "@/components/pricing/PriceTag";
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

/** Earned badges only: the shared Banff tour is TripAdvisor's #6 experience in Canada (2026). */
const AWARD_BADGE: Record<string, string> = {
  "banff-highlights-tour": "Best of the Best 2026",
};

// Dark editorial card (premium brief, item 3): a large photo takes most of the card, then the
// title, a two-line description (the tour's own catalog summary), key details, the price and a
// call to action. Near-black surface, hairline border, generous spacing. The whole card is one
// link (title link stretched over it), so there is a single tab stop per card.
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
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-obsidian-950 text-white ring-1 ring-white/[0.08] transition-[box-shadow,transform] duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
      {/* Media: the photo gets most of the card */}
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-obsidian-900">
        <Image
          src={tour.featuredImage}
          alt=""
          fill
          sizes="(max-width: 640px) 85vw, (max-width: 1024px) 46vw, (max-width: 1280px) 31vw, 400px"
          className="object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.05]"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-obsidian-950/70 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 flex flex-wrap gap-2 p-4">
          {award ? (
            <span className="rounded-full bg-summit-200 px-3 py-1 text-xs text-obsidian-900">{award}</span>
          ) : (
            <span className="rounded-full bg-obsidian-950/55 px-3 py-1 text-xs text-white ring-1 ring-white/15 backdrop-blur-md">
              {CATEGORY_LABEL[tour.category] ?? tour.category}
            </span>
          )}
          {tour.category === "SHUTTLE" && (
            <span className="rounded-full bg-obsidian-950/55 px-3 py-1 text-xs text-white ring-1 ring-white/15 backdrop-blur-md">Guaranteed lake access</span>
          )}
        </div>
      </div>

      {/* Body: title, description, key details, price, CTA */}
      <div className="flex flex-1 flex-col p-6">
        <TitleTag className="text-xl font-light leading-snug text-white">
          <Link href={`/${tour.slug}`} className="focus-visible:outline-none">
            <span className="absolute inset-0 z-10 rounded-[1.75rem] group-has-[:focus-visible]:outline group-has-[:focus-visible]:outline-2 group-has-[:focus-visible]:outline-offset-2 group-has-[:focus-visible]:outline-summit-300" />
            {tour.title}
          </Link>
        </TitleTag>
        {tour.summary && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/60">{tour.summary}</p>}

        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75" aria-label="Key details">
          <li className="flex min-w-0 max-w-full items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-summit-300" aria-hidden="true" />
            <span className="truncate">{tour.destination.name}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0 text-summit-300" aria-hidden="true" />
            {durationLabel(tour)}
          </li>
          <li className="flex min-w-0 items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0 text-summit-300" aria-hidden="true" />
            <span className="truncate">{groupLabel(tour)}</span>
          </li>
          <li className="flex items-center gap-1.5 whitespace-nowrap">
            {tour.reviewCount > 0 ? (
              <>
                <Star className="h-3.5 w-3.5 shrink-0 fill-summit-300 text-summit-300" aria-hidden="true" />
                <span>
                  {tour.rating.toFixed(1)}
                  <span className="sr-only"> out of 5,</span> <span className="text-white/50">({reviewsLabel(tour)})</span>
                </span>
              </>
            ) : (
              <span className="text-white/60">New on Vista Chase</span>
            )}
          </li>
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-summit-300" aria-hidden="true" />
            {cancellationShort(tour.category)}
          </li>
        </ul>

        <p className={`mt-3 text-sm ${status.variant === "error" ? "text-red-300" : "text-white/55"}`}>{status.text}</p>

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-white/[0.08] pt-5">
          <PriceTag price={price} currency={tour.currency} lead={priceLabel} size="sm" tone="dark" />
          <span className="inline-flex shrink-0 items-center gap-1.5 pb-1 text-sm text-summit-200" aria-hidden="true">
            View
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </article>
  );
}
