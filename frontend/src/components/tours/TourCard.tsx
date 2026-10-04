"use client";

// Tour tile for the search and listing grids. Card anatomy follows the Astryx
// `product-gallery` / `library` templates: media on top, then title, supporting
// line and price. The whole card is one link (ClickableCard), so it holds no other
// interactive controls.

import Image from "next/image";
import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Divider } from "@astryxdesign/core/Divider";
import { Icon } from "@astryxdesign/core/Icon";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { MapPin, Star } from "lucide-react";
import type { TourWithAvailability } from "@/lib/api/types";

const LOW_SEATS = 4;

// What the dot colour means; the visible text next to it carries the details.
const STATUS_MEANING = {
  success: "Good availability",
  warning: "Few seats left",
  error: "Unavailable",
  neutral: "On request",
} as const;

const money = (amount: number) =>
  `$${amount.toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Lowest price a guest can actually book: the cheapest scheduled departure, or the
 * tour's list price when nothing is scheduled (dates on request).
 */
export function fromPrice(tour: TourWithAvailability) {
  const prices = tour.departures.map((d) => d.price).filter((p) => p > 0);
  return prices.length > 0 ? Math.min(...prices) : tour.basePrice;
}

/** Private tours are sold per vehicle: a departure is either wholly free or booked. */
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

/** The first departure that fits the party (and the date, when one is chosen). */
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
      text: date ? `Full for ${seats} on ${formatShortDate(date)}` : `No dates for ${seats} guests`,
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
  headingLevel = 3,
}: {
  tour: TourWithAvailability;
  seats?: number;
  date?: string;
  headingLevel?: 2 | 3;
}) {
  const priceLabel = tour.priceUnit === "GROUP" ? "Per group, from" : "Per guest, from";
  const status = availability(tour, seats, date);
  const price = fromPrice(tour);

  return (
    <ClickableCard
      href={`/${tour.slug}`}
      label={`${tour.title}, ${priceLabel.toLowerCase()} ${money(price)} ${tour.currency}`}
      padding={0}
    >
      <AspectRatio ratio={16 / 9}>
        <Image
          src={tour.featuredImage}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 400px"
          className="object-cover"
        />
      </AspectRatio>
      <Section variant="transparent" padding={4}>
        <VStack gap={3}>
          <HStack gap={2} wrap="wrap" vAlign="center">
            <Token size="sm" label={tour.destination.name} icon={<Icon icon={MapPin} size="xsm" />} />
            <Token
              size="sm"
              label={`${tour.rating.toFixed(1)} · ${reviewsLabel(tour)}`}
              icon={<Icon icon={Star} size="xsm" />}
            />
          </HStack>
          <VStack gap={1}>
            <Heading level={headingLevel}>{tour.title}</Heading>
            <Text type="body" color="secondary" maxLines={2}>
              {tour.summary}
            </Text>
            <Text type="supporting" color="secondary">
              {durationLabel(tour)} · {groupLabel(tour)}
            </Text>
          </VStack>
          <Divider />
          <HStack hAlign="between" vAlign="end" gap={3} wrap="wrap">
            <VStack gap={0.5}>
              <Text type="supporting" color="secondary">
                {priceLabel}
              </Text>
              <Text type="large" weight="bold">
                {money(price)} {tour.currency}
              </Text>
            </VStack>
            <HStack gap={1.5} vAlign="center">
              <StatusDot variant={status.variant} label={STATUS_MEANING[status.variant]} />
              <Text type="supporting">{status.text}</Text>
            </HStack>
          </HStack>
        </VStack>
      </Section>
    </ClickableCard>
  );
}
