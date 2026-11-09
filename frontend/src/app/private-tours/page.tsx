import { getCategoryExtras, getTours } from "@/lib/api/catalog";
import { FALLBACK_TOURS } from "@/lib/api/fallback-data";
import { PrivateToursLanding } from "@/components/tours/PrivateToursLanding";
import { toursForCards } from "@/lib/experiences";
import type { TourWithAvailability } from "@/lib/api/types";
import type { Metadata } from "next";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";

const baseMetadata: Metadata = {
  title: "Private Tours in Banff & the Canadian Rockies | Vista Chase",
  description:
    "Explore the Canadian Rockies with your own guide and private vehicle for 1 to 5 days, with doorstep pickup, optional activities and airport transfers.",
  alternates: {
    canonical: "/private-tours",
  },
};

export default async function PrivateToursPage() {
  let tours: TourWithAvailability[] = [];
  try {
    tours = await getTours({ category: "PRIVATE" });
  } catch (err) {
    console.warn("[PrivateToursPage] getTours failed, fallback to FALLBACK_TOURS:", err);
    tours = FALLBACK_TOURS.filter((t) => t.category === "PRIVATE");
  }

  let reviews: any[] = [];
  try {
    const extras = await getCategoryExtras(tours);
    reviews = extras?.reviews || [];
  } catch (err) {
    console.warn("[PrivateToursPage] getCategoryExtras failed:", err);
  }

  return (
    <>
      <PageSeoExtras path="/private-tours" />
      <PrivateToursLanding tours={toursForCards(tours, 60)} reviews={reviews} />
    </>
  );
}

export function generateMetadata(): Promise<Metadata> {
  return withSeo("/private-tours", baseMetadata);
}
