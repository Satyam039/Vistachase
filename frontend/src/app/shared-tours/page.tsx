import { getCategoryExtras, getTours } from "@/lib/api/catalog";
import { TourGallery } from "@/components/tours/TourGallery";
import { SignatureDays } from "@/components/tours/SignatureDays";
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

// Three genuinely different days from this category, compared side by side above the full list.
const SIGNATURE = [
  { slug: "shared-tours-heart-of-banff", theme: "Banff town, Bow Falls & the Gondola" },
  { slug: "banff-highlights-tour", theme: "The famous lakes: Moraine, Louise & Peyto" },
  { slug: "shared-tours-icefields-jasper", theme: "Glaciers of the Icefields Parkway" },
];

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
      signature={
        <SignatureDays
          eyebrow="Three signature days"
          title="Which shared tour is right for you?"
          intro="Three different days in the Rockies, each with its own route. Compare them here, or see every shared tour below."
          picks={SIGNATURE}
          tours={tours}
        />
      }
      service={serviceById("shared")}
    />
  );
}
