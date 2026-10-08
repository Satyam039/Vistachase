import { getCategoryExtras, getTours } from "@/lib/api/catalog";
import { TourGallery } from "@/components/tours/TourGallery";
import { SignatureDays } from "@/components/tours/SignatureDays";
import { serviceById } from "@/lib/services";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Luxury Private SUV Tours in Banff & Canadian Rockies | Vista Chase",
  description:
    "Private tours with your own guide: a luxury SUV for up to 6 guests or an executive van for up to 13. Customizable itineraries, hotel pickup and guaranteed Moraine Lake access.",
  alternates: {
    canonical: "/private-tours",
  },
};

// Three genuinely different days from this category, compared side by side above the full list.
const SIGNATURE = [
  { slug: "banff-private-tour", theme: "Banff’s best-selling lakes, privately" },
  { slug: "icefields-jasper-private-tour", theme: "The Icefields Parkway to Jasper" },
  { slug: "jasper-custom-private-tour", theme: "Jasper, on a route you choose" },
];

export default async function PrivateToursPage() {
  const tours = await getTours({ category: "PRIVATE" });
  const { reviews, faqs } = await getCategoryExtras(tours);

  return (
    <TourGallery
      heading="Luxury private SUV tours"
      intro="Your day, your way. A private guide and vehicle for your group only, from a luxury SUV to an executive van: set your own pace, stop wherever you like and build the route around what you want to see."
      ctaLabel="Plan with the concierge"
      ctaHref="/concierge"
      tours={tours}
      reviews={reviews}
      faqs={faqs}
      signature={
        <SignatureDays
          eyebrow="Three signature days"
          title="Which private tour is right for you?"
          intro="Three different private days, each with your own vehicle and guide. Compare them here, or see every private tour below."
          picks={SIGNATURE}
          tours={tours}
        />
      }
      service={serviceById("private")}
    />
  );
}
