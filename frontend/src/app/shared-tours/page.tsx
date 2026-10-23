import { getCategoryExtras, getTours } from "@/lib/api/catalog";
import { FALLBACK_TOURS } from "@/lib/api/fallback-data";
import { SharedToursLanding } from "@/components/tours/SharedToursLanding";
import { BANFF_YOHO, ICEFIELD } from "@/lib/sharedTours";
import type { TourWithAvailability } from "@/lib/api/types";
import type { Metadata } from "next";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";

const baseMetadata: Metadata = {
  title: "Small-Group Tours in the Canadian Rockies | Vista Chase (Max 12 Guests)",
  description:
    "Banff & Yoho Discovery, Columbia Icefield Adventure or both in the Two-Day Rockies Explorer. Maximum 12 guests, passionate local guides, park admission included, pickup in Banff & Canmore.",
  alternates: {
    canonical: "/shared-tours",
  },
};

// The owner's doc keeps this page to three fixed options (two day tours and the two-day package),
// so there is no full grid or sort bar here; other shared tours stay reachable through search.
export default async function SharedToursPage() {
  let tours: TourWithAvailability[] = [];
  try {
    tours = await getTours({ category: "SHARED" });
  } catch (err) {
    tours = FALLBACK_TOURS.filter((t) => t.category === "SHARED");
  }
  const featured = tours.filter((t) => t.slug === BANFF_YOHO.slug || t.slug === ICEFIELD.slug);
  let reviews: any[] = [];
  try {
    const extras = await getCategoryExtras(featured);
    reviews = extras?.reviews || [];
  } catch (err) {
    console.warn("[SharedToursPage] getCategoryExtras failed:", err);
  }

  return (
    <>
      <PageSeoExtras path="/shared-tours" />
      <SharedToursLanding tours={featured} reviews={reviews} />
    </>
  );
}

export function generateMetadata(): Promise<Metadata> {
  return withSeo("/shared-tours", baseMetadata);
}
