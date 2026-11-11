import { getCategoryExtras, getTours } from "@/lib/api/catalog";
import { FALLBACK_TOURS } from "@/lib/api/fallback-data";
import { PrivateToursLanding } from "@/components/tours/PrivateToursLanding";
import { toursForCards } from "@/lib/experiences";
import type { TourWithAvailability } from "@/lib/api/types";
import type { Metadata } from "next";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";
import { cachePublicData } from "@/lib/api/cachePolicy";

// Rendered once and served from cache, refreshed in the background at most every minute, instead of
// on every request (fix recheck, 10 Nov 2026, N2/R2: 2.7-10 s responses and 5xx under a crawl).
// Seats and prices on this page can be up to a minute old; checkout (/book) always reads them live.
export const revalidate = 60;

const baseMetadata: Metadata = {
  title: "Private Tours in Banff & the Canadian Rockies | Vista Chase",
  description:
    "Explore the Canadian Rockies with your own guide and private vehicle for 1 to 5 days, with doorstep pickup, optional activities and airport transfers.",
  alternates: {
    canonical: "/private-tours",
  },
};

export default async function PrivateToursPage() {
  cachePublicData();
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
  cachePublicData();
  return withSeo("/private-tours", baseMetadata);
}
