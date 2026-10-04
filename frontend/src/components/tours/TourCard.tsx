"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock, MapPin, Star, Users, ArrowUpRight } from "lucide-react";
import type { TourWithAvailability } from "@/lib/api/types";

const LOW_SEATS = 4;

const money = (amount: number) =>
  `$${amount.toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

export function fromPrice(tour: TourWithAvailability) {
  const prices = tour.departures.map((d) => d.price).filter((p) => p > 0);
  return prices.length > 0 ? Math.min(...prices) : tour.basePrice;
}

export function isVehicleTour(tour: TourWithAvailability) {
  return tour.category === "PRIVATE";
}

/** "Price from" unit label: private tours and packages are priced per group. */
export function priceUnitLabel(tour: TourWithAvailability) {
  return tour.priceUnit === "GROUP" ? "per group" : "per guest";
}

/** Duration as the product page states it ("9-11 hours"), falling back to the hours figure. */
export function durationLabel(tour: TourWithAvailability) {
  return tour.facts.find((f) => /duration/i.test(f.label))?.value ?? `${tour.durationHours} hours`;
}

/** Group size line; per-group tours list their vehicle sizes ("6 or 13 guests"). */
export function groupLabel(tour: TourWithAvailability) {
  if (tour.vehicleOptions.length > 0) {
    return `Private, up to ${tour.vehicleOptions.map((v) => v.seats).join(" or ")} guests`;
  }
  return `Max ${tour.maxGroupSize} guests`;
}

export function reviewsLabel(tour: TourWithAvailability) {
  return tour.reviewCount >= 1000
    ? `${tour.reviewCount.toLocaleString("en-CA")}+ reviews`
    : `${tour.reviewCount} reviews`;
}

/** Whether a departure can take this party. */
export function departureFits(tour: TourWithAvailability, departure: TourWithAvailability["departures"][number], seats: number) {
  return isVehicleTour(tour)
    ? departure.seatsAvailable >= departure.capacityTotal && seats <= departure.capacityTotal
    : departure.seatsAvailable >= seats;
}

export function nextDepartureFor(tour: TourWithAvailability, seats: number, date?: string) {
  return tour.departures.find((d) => departureFits(tour, d, seats) && (!date || d.date === date));
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

export function TourCard({
  tour,
  seats = 1,
  date,
}: {
  tour: TourWithAvailability;
  seats?: number;
  date?: string;
  headingLevel?: 2 | 3;
}) {
  const priceLabel = tour.priceUnit === "GROUP" ? "Per group from" : "Per guest from";
  const status = availability(tour, seats, date);
  const price = fromPrice(tour);

  return (
    <article className="group relative rounded-3xl overflow-hidden bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-[#3A9CA6]/40 transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Media Frame */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
          <Image
            src={tour.featuredImage}
            alt={tour.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 400px"
            className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />

          {/* Destination Badge & Rating */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1C1F23]/80 backdrop-blur-md text-[#FFE085] text-xs font-semibold uppercase tracking-wider border border-white/10">
              <MapPin className="w-3 h-3 text-[#F5BF03]" />
              {tour.destination.name}
            </span>

            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-xs font-bold text-[#1C1F23] shadow-sm">
              <Star className="w-3.5 h-3.5 fill-[#F5BF03] text-[#F5BF03]" />
              <span>{tour.rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Category Chip */}
          <div className="absolute bottom-3 left-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/90 bg-black/40 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/20">
              {tour.category}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#3A9CA6]" />
                <span>{durationLabel(tour)}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#3A9CA6]" />
                <span>{groupLabel(tour)}</span>
              </span>
            </div>

            <h3 className="text-xl font-serif font-medium text-[#1C1F23] group-hover:text-[#3A9CA6] transition-colors leading-snug">
              <Link href={`/${tour.slug}`}>
                <span className="absolute inset-0 z-10" />
                {tour.title}
              </Link>
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
              {tour.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Footer / Pricing & Availability */}
      <div className="p-6 pt-0 mt-auto">
        <div className="pt-4 border-t border-slate-100 flex items-end justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 block">{priceLabel}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-serif font-light text-[#1C1F23]">{money(price)}</span>
              <span className="text-xs font-semibold text-slate-500">{tour.currency}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                status.variant === "warning"
                  ? "bg-amber-100 text-amber-800"
                  : status.variant === "error"
                  ? "bg-red-100 text-red-800"
                  : status.variant === "neutral"
                  ? "bg-slate-100 text-slate-700"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {status.text}
            </span>

            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#3A9CA6] group-hover:translate-x-0.5 transition-transform">
              <span>View Experience</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
