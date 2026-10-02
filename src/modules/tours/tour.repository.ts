import prisma from "@/lib/db/prisma";

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
  basePrice: number;
  currency: string;
  minGroupSize: number;
  maxGroupSize: number;
  isFeatured: boolean;
  rating: number;
  reviewCount: number;
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
    currency: string;
    status: string;
  }[];
}

export async function getTours(options?: {
  category?: string;
  destinationSlug?: string;
  isFeatured?: boolean;
}): Promise<TourWithAvailability[]> {
  const where: Record<string, unknown> = {};
  if (options?.category) where.category = options.category;
  if (options?.isFeatured !== undefined) where.isFeatured = options.isFeatured;
  if (options?.destinationSlug) {
    where.destination = { slug: options.destinationSlug };
  }

  const tours = await prisma.tour.findMany({
    where,
    include: {
      destination: {
        select: { id: true, slug: true, name: true },
      },
      departures: {
        where: {
          status: "ACTIVE",
        },
        orderBy: [{ date: "asc" }, { departureTime: "asc" }],
      },
    },
    orderBy: { basePrice: "asc" },
  });

  return tours.map((t) => ({
    id: t.id,
    slug: t.slug,
    title: t.title,
    category: t.category,
    durationHours: t.durationHours,
    summary: t.summary,
    description: t.description,
    inclusions: JSON.parse(t.inclusions || "[]"),
    exclusions: JSON.parse(t.exclusions || "[]"),
    highlights: JSON.parse(t.highlights || "[]"),
    whatToBring: JSON.parse(t.whatToBring || "[]"),
    featuredImage: t.featuredImage,
    galleryImages: JSON.parse(t.galleryImages || "[]"),
    basePrice: t.basePrice,
    currency: t.currency,
    minGroupSize: t.minGroupSize,
    maxGroupSize: t.maxGroupSize,
    isFeatured: t.isFeatured,
    rating: t.rating,
    reviewCount: t.reviewCount,
    destination: t.destination,
    departures: t.departures.map((d) => ({
      id: d.id,
      date: d.date,
      departureTime: d.departureTime,
      returnTime: d.returnTime,
      capacityTotal: d.capacityTotal,
      capacityBooked: d.capacityBooked,
      capacityHeld: d.capacityHeld,
      // Strict capacity calculation: Total - (Booked + Held)
      seatsAvailable: Math.max(0, d.capacityTotal - (d.capacityBooked + d.capacityHeld)),
      price: d.price,
      currency: d.currency,
      status: d.status,
    })),
  }));
}

export async function getTourBySlug(slug: string): Promise<TourWithAvailability | null> {
  const t = await prisma.tour.findUnique({
    where: { slug },
    include: {
      destination: {
        select: { id: true, slug: true, name: true },
      },
      departures: {
        where: { status: "ACTIVE" },
        orderBy: [{ date: "asc" }, { departureTime: "asc" }],
      },
    },
  });

  if (!t) return null;

  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    category: t.category,
    durationHours: t.durationHours,
    summary: t.summary,
    description: t.description,
    inclusions: JSON.parse(t.inclusions || "[]"),
    exclusions: JSON.parse(t.exclusions || "[]"),
    highlights: JSON.parse(t.highlights || "[]"),
    whatToBring: JSON.parse(t.whatToBring || "[]"),
    featuredImage: t.featuredImage,
    galleryImages: JSON.parse(t.galleryImages || "[]"),
    basePrice: t.basePrice,
    currency: t.currency,
    minGroupSize: t.minGroupSize,
    maxGroupSize: t.maxGroupSize,
    isFeatured: t.isFeatured,
    rating: t.rating,
    reviewCount: t.reviewCount,
    destination: t.destination,
    departures: t.departures.map((d) => ({
      id: d.id,
      date: d.date,
      departureTime: d.departureTime,
      returnTime: d.returnTime,
      capacityTotal: d.capacityTotal,
      capacityBooked: d.capacityBooked,
      capacityHeld: d.capacityHeld,
      seatsAvailable: Math.max(0, d.capacityTotal - (d.capacityBooked + d.capacityHeld)),
      price: d.price,
      currency: d.currency,
      status: d.status,
    })),
  };
}
