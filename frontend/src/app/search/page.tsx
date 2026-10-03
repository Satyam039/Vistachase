import { getDestinations, getTours } from "@/lib/api/catalog";
import { TourSearch, type SearchFilters } from "@/components/search/TourSearch";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search Canadian Rockies Tours & Shuttles | Vista Chase",
  description: "Find real-time departures, live seat availability, and guaranteed Moraine Lake tours across Banff and the Rockies.",
  alternates: {
    canonical: "/search",
  },
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function SearchResultsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    destination?: string;
    seats?: string;
    date?: string;
  }>;
}) {
  const searchParams = await searchParamsPromise;
  const seats = Math.min(7, Math.max(1, parseInt(searchParams.seats || "1", 10) || 1));
  const initialFilters: SearchFilters = {
    q: searchParams.q ?? "",
    category: searchParams.category?.toUpperCase() || "ALL",
    destination: searchParams.destination || "ALL",
    seats,
    date: searchParams.date && ISO_DATE.test(searchParams.date) ? searchParams.date : "",
  };

  // All tours load once; filtering happens in place on the client.
  const [tours, destinations] = await Promise.all([getTours(), getDestinations()]);

  return (
    <TourSearch
      tours={tours}
      destinations={destinations.map((d) => ({ slug: d.slug, name: d.name }))}
      initialFilters={initialFilters}
    />
  );
}
