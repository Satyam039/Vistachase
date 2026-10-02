import { notFound } from "next/navigation";
import { getTourBySlug } from "@/modules/tours/tour.repository";
import { TourDetailView } from "@/components/tours/TourDetailView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jasper National Park Custom Private Tour | Vista Chase",
  description:
    "Explore Maligne Lake, Spirit Island cruise access, and Maligne Canyon at your own pace with a dedicated private guide.",
  alternates: {
    canonical: "/jasper-custom-private-tour",
  },
};

export default async function JasperCustomTourPage() {
  const tour = await getTourBySlug("jasper-custom-private-tour");
  if (!tour) notFound();
  return <TourDetailView tour={tour} />;
}
