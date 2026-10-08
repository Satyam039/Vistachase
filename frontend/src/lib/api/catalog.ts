import { apiGet, apiGetOrNull } from "@/lib/api/server";
import {
  FALLBACK_TOURS,
  FALLBACK_SHUTTLES,
  FALLBACK_DESTINATIONS,
} from "@/lib/api/fallback-data";
import type {
  BookingDetail,
  CheckoutData,
  DestinationDetail,
  DestinationSummary,
  ShuttleWithDepartures,
  TourWithAvailability,
} from "@/lib/api/types";

/**
 * The hard-coded catalog (fallback-data.ts) is for local development and CI builds without a
 * backend. In production it is used only with FEATURE_FALLBACK_CATALOG=true: otherwise the site
 * shows what the API returns, or an error, never possibly stale tours and prices.
 */
function fallbackAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.FEATURE_FALLBACK_CATALOG === "true";
}

export async function getTours(options?: {
  category?: string;
  destinationSlug?: string;
  isFeatured?: boolean;
}): Promise<TourWithAvailability[]> {
  try {
    const data = await apiGet<{ tours: TourWithAvailability[] }>("/api/tours", {
      category: options?.category,
      destination: options?.destinationSlug,
      featured: options?.isFeatured === undefined ? undefined : String(options.isFeatured),
    });
    if (data?.tours && (data.tours.length > 0 || !fallbackAllowed())) return data.tours;
  } catch (err) {
    console.warn("[Catalog] Backend unavailable, serving authoritative fallback catalog");
    if (!fallbackAllowed()) throw new Error("Backend unavailable");
}

  // Graceful fallback to authoritative catalog
  return FALLBACK_TOURS.filter((t) => {
    if (options?.category && t.category !== options.category) return false;
    if (options?.destinationSlug && t.destination.slug !== options.destinationSlug) return false;
    if (options?.isFeatured !== undefined && t.isFeatured !== options.isFeatured) return false;
    return true;
  });
}

export async function getTourBySlug(slug: string): Promise<TourWithAvailability | null> {
  try {
    const data = await apiGetOrNull<{ tour: TourWithAvailability }>(`/api/tours/${encodeURIComponent(slug)}`);
    if (data?.tour) return data.tour;
  } catch (err) {
    console.warn(`[Catalog] Backend unavailable for slug ${slug}, serving authoritative fallback`);
    if (!fallbackAllowed()) throw new Error("Backend unavailable");
}

  // Only a matching tour: product pages live at top-level URLs, so an unknown slug must 404.
  if (!fallbackAllowed()) return null;
  return FALLBACK_TOURS.find((t) => t.slug === slug) ?? null;
}

export async function getShuttleRoutes(): Promise<ShuttleWithDepartures[]> {
  try {
    const data = await apiGet<{ routes: ShuttleWithDepartures[] }>("/api/shuttles");
    if (data?.routes && (data.routes.length > 0 || !fallbackAllowed())) return data.routes;
  } catch (err) {
    console.warn("[Catalog] Backend unavailable for shuttles, serving authoritative fallback");
    if (!fallbackAllowed()) throw new Error("Backend unavailable");
}

  return FALLBACK_SHUTTLES;
}

export async function getDestinations(): Promise<DestinationSummary[]> {
  try {
    const data = await apiGet<{ destinations: DestinationSummary[] }>("/api/destinations");
    if (data?.destinations && (data.destinations.length > 0 || !fallbackAllowed())) return data.destinations;
  } catch (err) {
    console.warn("[Catalog] Backend unavailable for destinations, serving authoritative fallback");
    if (!fallbackAllowed()) throw new Error("Backend unavailable");
}

  return FALLBACK_DESTINATIONS;
}

export async function getDestinationBySlug(slug: string): Promise<DestinationDetail | null> {
  try {
    const data = await apiGetOrNull<{ destination: DestinationDetail }>(
      `/api/destinations/${encodeURIComponent(slug)}`
    );
    if (data?.destination) return data.destination;
  } catch (err) {
    console.warn(`[Catalog] Backend unavailable for destination ${slug}, serving authoritative fallback`);
    if (!fallbackAllowed()) throw new Error("Backend unavailable");
}

  if (!fallbackAllowed()) return null;
  const found = FALLBACK_DESTINATIONS.find((d) => d.slug === slug || d.slug.includes(slug)) ?? FALLBACK_DESTINATIONS[0];
  if (!found) return null;

  return {
    id: found.id,
    slug: found.slug,
    name: found.name,
    province: found.province,
    region: found.region,
    description: found.description,
    heroImage: found.heroImage,
    isFeatured: found.isFeatured,
    metaTitle: found.metaTitle,
    metaDescription: found.metaDescription,
    tours: FALLBACK_TOURS.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      category: t.category,
      durationHours: t.durationHours,
      summary: t.summary,
      featuredImage: t.featuredImage,
      basePrice: t.basePrice,
      currency: t.currency,
      maxGroupSize: t.maxGroupSize,
      departures: t.departures.map((d) => ({
        id: d.id,
        date: d.date,
        departureTime: d.departureTime,
        price: d.price,
      })),
    })),
  };
}

export async function getCheckoutData(departureId?: string): Promise<CheckoutData | null> {
  try {
    const data = await apiGetOrNull<CheckoutData>("/api/departures/checkout", { departureId });
    if (data) return data;
  } catch (err) {
    console.warn("[Catalog] Backend unavailable for checkout, serving authoritative fallback");
    if (!fallbackAllowed()) throw new Error("Backend unavailable");
}

  // Never a made-up departure in production: checkout shows its "not available" state instead.
  if (!fallbackAllowed()) return null;
  const tour = FALLBACK_TOURS[0];
  const dep = tour.departures[0];

  return {
    departure: {
      id: departureId || dep.id,
      date: dep.date,
      departureTime: dep.departureTime,
      returnTime: dep.returnTime,
      capacityTotal: dep.capacityTotal,
      capacityBooked: dep.capacityBooked,
      capacityHeld: dep.capacityHeld,
      seatsAvailable: dep.seatsAvailable,
      price: dep.price,
      currency: dep.currency,
      tour: {
        id: tour.id,
        title: tour.title,
        slug: tour.slug,
        durationHours: tour.durationHours,
        featuredImage: tour.featuredImage,
        category: tour.category,
        maxGroupSize: tour.maxGroupSize,
      },
      shuttleRoute: null,
    },
    stops: [
      {
        id: "stop-fairmont",
        name: "Fairmont Banff Springs Hotel",
        town: "Banff",
        address: "405 Spray Ave, Banff, AB T1L 1J4",
        instructions: "Meet outside the main motor court entrance 10 minutes before departure.",
      },
      {
        id: "stop-caribou",
        name: "Banff Caribou Lodge",
        town: "Banff",
        address: "521 Banff Ave, Banff, AB T1L 1H8",
        instructions: "Wait in the lobby by the fireplace.",
      },
    ],
  };
}

/**
 * A booking for its voucher page. Opens with the signed token from the confirmation email (`t`),
 * or for the signed-in owner or staff (their session cookie is forwarded).
 */
export async function getBookingByReference(
  reference: string,
  access: { token?: string; cookie?: string } = {},
): Promise<BookingDetail | null> {
  return await apiGetOrNull<{ booking: BookingDetail }>(
    "/api/bookings",
    { ref: reference, t: access.token },
    access.cookie ? { cookie: access.cookie } : undefined,
  ).then((d) => d?.booking ?? null);
}

export interface CategoryReview {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  isFeatured?: boolean;
  tourTitle: string;
  tourSlug: string;
}

/** Real guest reviews and FAQs of a category's tours (category pages): featured, highest rated first. */
export async function getCategoryExtras(tours: TourWithAvailability[]) {
  const lists = await Promise.all(
    tours.map(async (t) => {
      const data = await apiGetOrNull<{ reviews: Omit<CategoryReview, "tourTitle" | "tourSlug">[] }>("/api/reviews", { tourId: t.id }).catch(() => null);
      return (data?.reviews ?? []).map((r) => ({ ...r, tourTitle: t.title, tourSlug: t.slug }));
    }),
  );
  const reviews = lists
    .flat()
    .sort((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) || b.rating - a.rating)
    .slice(0, 8);
  const seen = new Set<string>();
  const faqs = tours
    .flatMap((t) => t.faqs ?? [])
    .filter((f) => {
      const key = f.question.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6)
    // The imported live-site copy has stray spaces before punctuation ("11 hours ,").
    .map((f) => ({ question: f.question.replace(/\s+([,.;:!?])/g, "$1"), answer: f.answer.replace(/[ \t]+([,.;:!?])/g, "$1") }));
  return { reviews, faqs };
}
