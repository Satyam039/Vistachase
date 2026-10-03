import { notFound } from "next/navigation";
import { getTourBySlug } from "@/lib/api/catalog";
import { TourDetailView } from "@/components/tours/TourDetailView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lake Louise, Moraine Lake & Banff Highlights Tour | Vista Chase (#6 in Canada)",
  description:
    "TripAdvisor #6 Best Experience in Canada. Guaranteed Moraine Lake access, small group (max 12), complimentary hot drinks, and local expert guide.",
  alternates: {
    canonical: "/banff-highlights-tour",
  },
};

export default async function BanffHighlightsTourPage() {
  const tour = await getTourBySlug("banff-highlights-tour");
  if (!tour) notFound();
  return <TourDetailView tour={tour} />;
}
