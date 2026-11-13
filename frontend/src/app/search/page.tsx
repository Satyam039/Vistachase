import { redirect } from "next/navigation";
import { getTours } from "@/lib/api/catalog";
import { MAX_SEARCH_GUESTS, groupEnquiryHref, toursForTourCards } from "@/lib/experiences";
import { TourSearch, type SearchFilters } from "@/components/search/TourSearch";
import type { Metadata } from "next";

export const metadata: Metadata = {
  // Checkout and search results have no search value of their own; keep them out of the index.
  robots: { index: false, follow: true },
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
  const date = searchParams.date && ISO_DATE.test(searchParams.date) ? searchParams.date : "";
  const asked = Math.max(1, parseInt(searchParams.seats || "1", 10) || 1);
  // More than 12 guests: the team plans it on the contact page (owner's doc, 2026-11-05).
  if (asked > MAX_SEARCH_GUESTS) redirect(groupEnquiryHref(date || undefined));
  const initialFilters: SearchFilters = {
    q: searchParams.q ?? "",
    category: searchParams.category?.toUpperCase() || "ALL",
    seats: asked,
    date,
  };

  // All tours load once; filtering happens in place on the client.
  const tours = await getTours();

  return <TourSearch tours={toursForTourCards(tours)} initialFilters={initialFilters} />;
}
