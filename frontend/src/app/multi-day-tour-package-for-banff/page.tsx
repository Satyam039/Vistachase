// Multi-Day Journeys at the old multi-day product's vistachase.com URL (kept for search engines):
// only the multi-day journeys in the owner's product list (doc, 2026-11-05). This static route
// takes precedence over app/[slug] (the old enquiry product page).
import type { Metadata } from "next";
import { getTours } from "@/lib/api/catalog";
import { MultiDayLanding } from "@/components/tours/MultiDayLanding";
import { toursForCards } from "@/lib/experiences";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";
import type { TourWithAvailability } from "@/lib/api/types";

const PATH = "/multi-day-tour-package-for-banff";

export async function generateMetadata(): Promise<Metadata> {
  return withSeo(PATH, {
    title: "Multi-Day Canadian Rockies Tours from Banff | Vista Chase",
    description:
      "Two-, three- and four-day journeys through Banff, Yoho, the Icefields Parkway and Jasper, with a small group or in your own private vehicle. Hotel pickup in Banff and Canmore.",
    alternates: { canonical: PATH },
  });
}

export default async function MultiDayPage() {
  let tours: TourWithAvailability[] = [];
  try {
    tours = await getTours();
  } catch (err) {
    console.warn("[MultiDayPage] getTours failed:", err);
  }
  return (
    <>
      <PageSeoExtras path={PATH} />
      <MultiDayLanding tours={toursForCards(tours, 60)} />
    </>
  );
}
