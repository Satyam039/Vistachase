import { getCategoryExtras, getTours } from "@/lib/api/catalog";
import { FALLBACK_TOURS } from "@/lib/api/fallback-data";
import { SharedToursLanding } from "@/components/tours/SharedToursLanding";
import { BANFF_YOHO, ICEFIELD } from "@/lib/sharedTours";
import type { TourWithAvailability } from "@/lib/api/types";
import type { Metadata } from "next";
import { getSiteConfig, withSeo } from "@/lib/seo/server";
import { TrackingTags } from "@/components/seo/TrackingTags";
import { GA4_ID, GOOGLE_ADS_ID } from "@/lib/googleAds";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";
import { cachePublicData } from "@/lib/api/cachePolicy";

// Rendered once and served from cache, refreshed in the background at most every minute, instead of
// on every request (fix recheck, 10 Nov 2026, N2/R2: 2.7-10 s responses and 5xx under a crawl).
// Seats and prices on this page can be up to a minute old; checkout (/book) always reads them live.
export const revalidate = 60;

// Google tag for the Google Ads launch (owner, 16 Nov 2026): Ads + GA4 on this page first. Skipped
// when the site-wide tag is already switched on in the SEO portal, so gtag.js never loads twice.
const SHARED_TOURS_TRACKING = { ga4Id: GA4_ID, adsId: GOOGLE_ADS_ID, consentDefault: null };

const baseMetadata: Metadata = {
  title: "Small-Group Tours in Banff & the Rockies | Vista Chase",
  description:
    "Banff & Yoho Discovery, Columbia Icefield Adventure or both over two days. Small groups, local guides, park admission included, Banff & Canmore pickup.",
  alternates: {
    canonical: "/shared-tours",
  },
};

// The owner's doc keeps this page to three fixed options (two day tours and the two-day package),
// so there is no full grid or sort bar here; other shared tours stay reachable through search.
export default async function SharedToursPage() {
  cachePublicData();
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

  const siteConfig = await getSiteConfig();

  return (
    <>
      <PageSeoExtras path="/shared-tours" />
      <SharedToursLanding tours={featured} reviews={reviews} />
      {!siteConfig?.tracking && <TrackingTags tracking={SHARED_TOURS_TRACKING} />}
    </>
  );
}

export function generateMetadata(): Promise<Metadata> {
  cachePublicData();
  return withSeo("/shared-tours", baseMetadata);
}
