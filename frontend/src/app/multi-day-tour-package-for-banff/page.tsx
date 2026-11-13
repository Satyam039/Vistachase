// Multi-Day Journeys at the old multi-day product's vistachase.com URL (kept for search engines):
// only the multi-day journeys in the owner's product list (doc, 2026-11-05). This static route
// takes precedence over app/[slug] (the old enquiry product page).
import type { Metadata } from "next";
import { getTours } from "@/lib/api/catalog";
import { MultiDayLanding } from "@/components/tours/MultiDayLanding";
import { toursForTourCards } from "@/lib/experiences";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";
import { PackageListJsonLd } from "@/components/seo/PackageTripJsonLd";
import { TWO_DAY_PACKAGE } from "@/lib/sharedTours";
import { PRIVATE_PACKAGES } from "@/lib/privateTours";
import type { TourWithAvailability } from "@/lib/api/types";
import { cachePublicData } from "@/lib/api/cachePolicy";

// Rendered once and served from cache, refreshed in the background at most every minute, instead of
// on every request (fix recheck, 10 Nov 2026, N2/R2: 2.7-10 s responses and 5xx under a crawl).
// Seats and prices on this page can be up to a minute old; checkout (/book) always reads them live.
export const revalidate = 60;

const PATH = "/multi-day-tour-package-for-banff";

export async function generateMetadata(): Promise<Metadata> {
  cachePublicData();
  return withSeo(PATH, {
    title: "Multi-Day Canadian Rockies Tours from Banff | Vista Chase",
    description:
      "Two-, three- and four-day journeys through Banff, Yoho, the Icefields Parkway and Jasper, small-group or private, with hotel pickup in Banff and Canmore.",
    alternates: { canonical: PATH },
  });
}

export default async function MultiDayPage() {
  cachePublicData();
  let tours: TourWithAvailability[] = [];
  try {
    tours = await getTours();
  } catch (err) {
    console.warn("[MultiDayPage] getTours failed:", err);
  }
  return (
    <>
      <PageSeoExtras path={PATH} />
      <PackageListJsonLd
        items={[
          { name: TWO_DAY_PACKAGE.title, path: TWO_DAY_PACKAGE.href },
          { name: PRIVATE_PACKAGES.three.title, path: "/three-day-rockies-discovery" },
          { name: PRIVATE_PACKAGES.four.title, path: "/four-day-rockies-and-jasper" },
        ]}
      />
      <MultiDayLanding tours={toursForTourCards(tours, 60)} />
    </>
  );
}
