// Multi-Day Journeys at the old multi-day product's vistachase.com URL (kept for search engines):
// only the multi-day journeys in the owner's product list (doc, 2026-11-05). This static route
// takes precedence over app/[slug] (the old enquiry product page).
import type { Metadata } from "next";
import { getTours } from "@/lib/api/catalog";
import { MultiDayLanding } from "@/components/tours/MultiDayLanding";
import { toursForCards } from "@/lib/experiences";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";
import { PackageListJsonLd } from "@/components/seo/PackageTripJsonLd";
import { TWO_DAY_PACKAGE } from "@/lib/sharedTours";
import { PRIVATE_PACKAGES } from "@/lib/privateTours";
import type { TourWithAvailability } from "@/lib/api/types";

const PATH = "/multi-day-tour-package-for-banff";

export async function generateMetadata(): Promise<Metadata> {
  return withSeo(PATH, {
    title: "Multi-Day Canadian Rockies Tours from Banff | Vista Chase",
    description:
      "Two-, three- and four-day journeys through Banff, Yoho, the Icefields Parkway and Jasper, small-group or private, with hotel pickup in Banff and Canmore.",
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
      <PackageListJsonLd
        items={[
          { name: TWO_DAY_PACKAGE.title, path: TWO_DAY_PACKAGE.href },
          { name: PRIVATE_PACKAGES.three.title, path: "/three-day-rockies-discovery" },
          { name: PRIVATE_PACKAGES.four.title, path: "/four-day-rockies-and-jasper" },
        ]}
      />
      <MultiDayLanding tours={toursForCards(tours, 60)} />
    </>
  );
}
