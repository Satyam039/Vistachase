import { getCategoryExtras, getTours } from "@/lib/api/catalog";
import { TourGallery } from "@/components/tours/TourGallery";
import { serviceById } from "@/lib/services";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Tours in Banff & Lake Louise | Vista Chase (Max 12 Guests)",
  description:
    "Explore Banff, Moraine Lake, and Lake Louise with award-winning small group shared tours. Max 12 passengers, local expert guides, and guaranteed access.",
  alternates: {
    canonical: "/shared-tours",
  },
};

export default async function SharedToursPage() {
  const tours = await getTours({ category: "SHARED" });
  const { reviews, faqs } = await getCategoryExtras(tours);

  return (
    <TourGallery
      heading="Shared small-group tours"
      intro="See the Canadian Rockies in groups capped at 12 guests: more time with your guide, better photo stops and no crowded tour buses. Hotel pickup in Banff, Canmore and Lake Louise is included."
      ctaLabel="Find a departure"
      ctaHref="/search?category=SHARED"
      tours={tours}
      reviews={reviews}
      faqs={faqs}
      service={serviceById("shared")}
    />
  );
}
