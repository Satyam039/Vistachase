import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { PRODUCT_MAP } from "@/modules/bokun/product-map";
import { videosFor, type PageVideo } from "@/modules/media/media.repository";
import { getExpiredHeldSeats, liveCapacity } from "@/modules/reservations/reservation.repository";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";

export interface TourFact {
  label: string;
  value: string;
}

export interface TourStop {
  name: string;
  text: string;
}

export interface TourSection {
  heading: string;
  body: string[];
  items: string[];
  steps: { time: string; text: string }[];
  stops: TourStop[];
  note: string | null;
}

export interface TourTab {
  label: string;
  sections: TourSection[];
}

export interface TourFaq {
  question: string;
  answer: string;
}

export interface VehicleOption {
  id: string;
  label: string;
  seats: number;
}

export interface TourWithAvailability {
  id: string;
  slug: string;
  title: string;
  category: string;
  durationHours: number;
  summary: string;
  description: string;
  inclusions: string[];
  exclusions: string[];
  highlights: string[];
  whatToBring: string[];
  featuredImage: string;
  galleryImages: string[];
  /** Background clips of the places the tour visits (backend/media/videos), best match first. */
  videos: PageVideo[];
  basePrice: number;
  currency: string;
  minGroupSize: number;
  maxGroupSize: number;
  isFeatured: boolean;
  rating: number;
  reviewCount: number;
  /** Bokun experience ID from the product mapping table; null until Vista Chase provides it. */
  bokunId: string | null;
  bookingMode: "BOKUN" | "ENQUIRY";
  /** PERSON: price per guest. GROUP: price per vehicle / private group. */
  priceUnit: "PERSON" | "GROUP";
  facts: TourFact[];
  tabs: TourTab[];
  faqs: TourFaq[];
  crossSells: string[];
  vehicleOptions: VehicleOption[];
  metaTitle: string | null;
  metaDescription: string | null;
  destination: {
    id: string;
    slug: string;
    name: string;
  };
  departures: {
    id: string;
    date: string;
    departureTime: string;
    returnTime: string | null;
    capacityTotal: number;
    capacityBooked: number;
    capacityHeld: number;
    seatsAvailable: number;
    price: number;
    childPrice: number | null;
    currency: string;
    status: string;
  }[];
}

const tourInclude = {
  destination: {
    select: { id: true, slug: true, name: true },
  },
  departures: {
    where: { status: "ACTIVE" as any },
    orderBy: [{ date: "asc" as const }, { departureTime: "asc" as const }],
  },
};

type TourRow = Prisma.TourGetPayload<{ include: typeof tourInclude }>;

function json<T>(value: any, fallback: T): T {
  if (!value) return fallback;
  return value as unknown as T;
}

function tourVideos(slug: string): PageVideo[] {
  const mapped = PRODUCT_MAP.find((p) => p.slug === slug);
  return mapped ? videosFor(mapped.places, mapped.season) : [];
}

function toTourDto(t: TourRow, expiredHeld: Map<string, number>): TourWithAvailability {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    category: t.category,
    durationHours: t.durationHours,
    summary: t.summary,
    description: t.description,
    inclusions: json(t.inclusions, []),
    exclusions: json(t.exclusions, []),
    highlights: json(t.highlights, []),
    whatToBring: json(t.whatToBring, []),
    featuredImage: t.featuredImage,
    galleryImages: json(t.galleryImages, []),
    videos: tourVideos(t.slug),
    basePrice: t.basePrice / 100,
    currency: t.currency,
    minGroupSize: t.minGroupSize,
    maxGroupSize: t.maxGroupSize,
    isFeatured: t.isFeatured,
    rating: t.rating,
    reviewCount: t.reviewCount,
    bokunId: t.bokunId,
    bookingMode: t.bookingMode === "ENQUIRY" ? "ENQUIRY" : "BOKUN",
    priceUnit: t.priceUnit === "GROUP" ? "GROUP" : "PERSON",
    facts: json(t.facts, []),
    tabs: json(t.tabs, []),
    faqs: json(t.faqs, []),
    crossSells: json(t.crossSells, []),
    vehicleOptions: json(t.vehicleOptions, []),
    metaTitle: t.metaTitle,
    metaDescription: t.metaDescription,
    destination: t.destination,
    departures: t.departures.map((d) => ({
      id: d.id,
      date: formatDateOnly(d.date),
      departureTime: formatTimeOfDay(d.departureTime),
      returnTime: formatTimeOfDay(d.returnTime),
      capacityTotal: d.capacityTotal,
      capacityBooked: d.capacityBooked,
      // Strict capacity calculation: Total - (Booked + live Held)
      ...liveCapacity(d, expiredHeld),
      price: d.price / 100,
      childPrice: d.childPrice != null ? d.childPrice / 100 : null,
      currency: d.currency,
      status: d.status,
    })),
  };
}

export async function getTours(options?: {
  category?: string;
  destinationSlug?: string;
  isFeatured?: boolean;
}): Promise<TourWithAvailability[]> {
  const where: Prisma.TourWhereInput = {};
  if (options?.category) where.category = options.category as any;
  if (options?.isFeatured !== undefined) where.isFeatured = options.isFeatured;
  if (options?.destinationSlug) {
    where.destination = { slug: options.destinationSlug };
  }

  // Live-site order (sortOrder), so listings match vistachase.com
  const tours = await prisma.tour.findMany({
    where,
    include: tourInclude,
    orderBy: [{ sortOrder: "asc" }, { basePrice: "asc" }],
  });

  const expiredHeld = await getExpiredHeldSeats(tours.flatMap((t) => t.departures.map((d) => d.id)));
  return tours.map((t) => toTourDto(t, expiredHeld));
}

export async function getTourBySlug(slug: string): Promise<TourWithAvailability | null> {
  const t = await prisma.tour.findUnique({ where: { slug }, include: tourInclude });
  if (!t) return null;

  const expiredHeld = await getExpiredHeldSeats(t.departures.map((d) => d.id));
  return toTourDto(t, expiredHeld);
}
