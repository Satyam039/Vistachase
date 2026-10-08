import { getCategoryExtras, getTours } from "@/lib/api/catalog";
import { TourGallery } from "@/components/tours/TourGallery";
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
      service={serviceById("private")}
    />
  );
}
