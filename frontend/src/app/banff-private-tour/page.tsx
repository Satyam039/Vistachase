import { notFound } from "next/navigation";
import { getTourBySlug } from "@/lib/api/catalog";
import { TourDetailView } from "@/components/tours/TourDetailView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Luxury Private SUV Tour: Banff & Lake Louise | Vista Chase",
  description:
    "Explore the Canadian Rockies with a private guide and full-size luxury SUV (GMC Yukon XL). Customizable itinerary, door-to-door hotel pickup, and guaranteed Moraine Lake access.",
  alternates: {
    canonical: "/banff-private-tour",
  },
};

export default async function BanffPrivateTourPage() {
  const tour = await getTourBySlug("banff-private-tour");
  if (!tour) notFound();
  return <TourDetailView tour={tour} />;
}
