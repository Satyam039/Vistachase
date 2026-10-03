import { notFound } from "next/navigation";
import { getTourBySlug } from "@/lib/api/catalog";
import { TourDetailView } from "@/components/tours/TourDetailView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Banff & Yoho National Parks Custom Private Tour | Vista Chase",
  description:
    "Cross the Continental Divide to Emerald Lake, Natural Bridge, and Takakkaw Falls. Luxury private van & certified Rockies guide.",
  alternates: {
    canonical: "/banff-yoho-custom-private-tour",
  },
};

export default async function BanffYohoTourPage() {
  const tour = await getTourBySlug("banff-yoho-custom-private-tour");
  if (!tour) notFound();
  return <TourDetailView tour={tour} />;
}
