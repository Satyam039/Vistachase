import { apiGet, apiGetOrNull } from "@/lib/api/server";
import type {
  BookingDetail,
  CheckoutData,
  DestinationDetail,
  DestinationSummary,
  ShuttleWithDepartures,
  TourWithAvailability,
} from "@/lib/api/types";

export async function getTours(options?: {
  category?: string;
  destinationSlug?: string;
  isFeatured?: boolean;
}): Promise<TourWithAvailability[]> {
  const data = await apiGet<{ tours: TourWithAvailability[] }>("/api/tours", {
    category: options?.category,
    destination: options?.destinationSlug,
    featured: options?.isFeatured === undefined ? undefined : String(options.isFeatured),
  });
  return data.tours;
}

export async function getTourBySlug(slug: string): Promise<TourWithAvailability | null> {
  const data = await apiGetOrNull<{ tour: TourWithAvailability }>(`/api/tours/${encodeURIComponent(slug)}`);
  return data?.tour ?? null;
}

export async function getShuttleRoutes(): Promise<ShuttleWithDepartures[]> {
  const data = await apiGet<{ routes: ShuttleWithDepartures[] }>("/api/shuttles");
  return data.routes;
}

export async function getDestinations(): Promise<DestinationSummary[]> {
  const data = await apiGet<{ destinations: DestinationSummary[] }>("/api/destinations");
  return data.destinations;
}

export async function getDestinationBySlug(slug: string): Promise<DestinationDetail | null> {
  const data = await apiGetOrNull<{ destination: DestinationDetail }>(
    `/api/destinations/${encodeURIComponent(slug)}`
  );
  return data?.destination ?? null;
}

export async function getCheckoutData(departureId?: string): Promise<CheckoutData | null> {
  return await apiGetOrNull<CheckoutData>("/api/departures/checkout", { departureId });
}

export async function getBookingByReference(reference: string): Promise<BookingDetail | null> {
  const data = await apiGetOrNull<{ booking: BookingDetail }>("/api/bookings", { ref: reference });
  return data?.booking ?? null;
}
