import { getTours } from "@/lib/api/catalog";
import { TourGallery } from "@/components/tours/TourGallery";
import { serviceById } from "@/lib/services";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Luxury Private SUV Tours in Banff & Canadian Rockies | Vista Chase",
  description:
    "Private SUV tours (GMC Yukon XL / Suburban) with dedicated guide for up to 6-7 guests. Fully customizable itineraries, hotel pickup, and guaranteed Moraine Lake access.",
  alternates: {
    canonical: "/private-tours",
  },
};

export default async function PrivateToursPage() {
  const tours = await getTours({ category: "PRIVATE" });

  return (
    <TourGallery
      heading="Luxury private SUV tours"
      intro="Your day, your way. A private guide and a GMC Yukon XL for your group only: set your own pace, stop wherever you like and build the route around what you want to see."
      ctaLabel="Plan with the concierge"
      ctaHref="/concierge"
      tours={tours}
      service={serviceById("private")}
    />
  );
}
