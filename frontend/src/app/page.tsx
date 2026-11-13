import React from "react";
import { ServicesHero, type HeroSlide } from "@/components/cinematic/ServicesHero";
import { categoryOffer, fromPrice, priceUnitLabel } from "@/lib/tours";
import { getCategoryExtras, getTours } from "@/lib/api/catalog";
import type { TourWithAvailability } from "@/lib/api/types";
import { SERVICES } from "@/lib/services";
import { TrustRow } from "@/components/home/TrustRow";
import { TopExperiences } from "@/components/home/TopExperiences";
import { toursForTourCards } from "@/lib/experiences";
import { ExperienceCategories } from "@/components/cinematic/ExperienceCategories";
import { DestinationStoryStream } from "@/components/cinematic/DestinationStoryStream";
import { PlanAheadGuaranteedAccess } from "@/components/cinematic/PlanAheadGuaranteedAccess";
import { WhyTravelersLove } from "@/components/cinematic/WhyTravelersLove";
import { NatGeoFeatureSection } from "@/components/brand/NatGeoFeatureSection";
import { VerifiedAwardSection } from "@/components/cinematic/VerifiedAwardSection";
import { GuestTestimonials } from "@/components/cinematic/GuestTestimonials";
import { LiveTrackingTeaser } from "@/components/cinematic/LiveTrackingTeaser";
import { TrustBar } from "@/components/cinematic/TrustBar";
import type { Metadata } from "next";
import { getSiteConfig, withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";
import { cachePublicData } from "@/lib/api/cachePolicy";

// Rendered once and served from cache, refreshed in the background at most every minute, instead of
// on every request (fix recheck, 10 Nov 2026, N2/R2: 2.7-10 s responses and 5xx under a crawl).
// Seats and prices on this page can be up to a minute old; checkout (/book) always reads them live.
export const revalidate = 60;

const baseMetadata: Metadata = {
  title: "Vista Chase | Luxury Private Tours & Shuttles in Banff",
  description:
    "Banff tour operator ranked #6 Experience in Canada, Tripadvisor Best of the Best 2026. Guaranteed Moraine Lake access, private SUV tours and shuttles.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Vista Chase | Canadian Rockies Luxury Tours & Shuttles",
    description:
      "Ranked #6 Experience in Canada by TripAdvisor 2026. Explore Banff, Lake Louise & Moraine Lake in comfort.",
    images: [
      {
        url: "/media/site/hero-background-image-3.webp",
        width: 1200,
        height: 630,
        alt: "Vista Chase Canadian Rockies",
      },
    ],
  },
};

export default async function HomePage() {
  cachePublicData();
  let tours: TourWithAvailability[] = [];
  try {
    tours = await getTours();
  } catch (err) {
    console.warn("[HomePage] getTours failed, fallback to empty array:", err);
  }

  let reviews: any[] = [];
  try {
    const extras = await getCategoryExtras(tours);
    reviews = extras?.reviews || [];
  } catch (err) {
    console.warn("[HomePage] getCategoryExtras failed:", err);
  }

  // A real review of the award-winning tour for the award section (none yet: the quote is left out).
  let awardQuote = null;
  try {
    const award = await getCategoryExtras(tours.filter((t) => t.slug === "banff-highlights-tour"));
    awardQuote = award.reviews[0] ?? null;
  } catch (err) {
    console.warn("[HomePage] award review lookup failed:", err);
  }

  const slides: HeroSlide[] = SERVICES.filter(
    (service) => service.id !== "tickets" && service.category !== "TICKET",
  ).map((service) => ({
    ...service,
    offer: categoryOffer(tours || [], service.category),
    tours: (tours || [])
      .filter((t) => t.category === service.category)
      .slice(0, 3)
      .map((t) => ({
        slug: t.slug,
        title: t.title,
        rating: t.rating,
        reviewCount: t.reviewCount,
        price: fromPrice(t),
        unit: t.category === "TICKET" ? "per ticket" : priceUnitLabel(t),
      })),
  }));

  return (
    <>
      <PageSeoExtras path="/" />
    <div className="flex w-full flex-col bg-white selection:bg-summit-500 selection:text-obsidian-900">
      <ServicesHero slides={slides} />
      {/* Below the first screen: rendered as they come near (vc-defer, globals.css). The sizes are
          each section's measured height on phones and from 1024px, so the page keeps its length. */}
      <TrustRow />
      <NatGeoFeatureSection />
      <div className="vc-defer [contain-intrinsic-size:auto_1849px] lg:[contain-intrinsic-size:auto_1088px]"><VerifiedAwardSection quote={awardQuote} /></div>
      <div className="vc-defer [contain-intrinsic-size:auto_1151px] lg:[contain-intrinsic-size:auto_1233px]"><TopExperiences tours={toursForTourCards(tours, 60)} /></div>
      <div className="vc-defer [contain-intrinsic-size:auto_2487px] lg:[contain-intrinsic-size:auto_1135px]"><ExperienceCategories /></div>
      <div className="vc-defer [contain-intrinsic-size:auto_4465px] lg:[contain-intrinsic-size:auto_4349px]"><DestinationStoryStream /></div>
      <div className="vc-defer [contain-intrinsic-size:auto_1613px] lg:[contain-intrinsic-size:auto_1019px]"><PlanAheadGuaranteedAccess /></div>
      <div className="vc-defer [contain-intrinsic-size:auto_2266px] lg:[contain-intrinsic-size:auto_1129px]"><WhyTravelersLove /></div>
      <div className="vc-defer [contain-intrinsic-size:auto_1636px] lg:[contain-intrinsic-size:auto_1434px]"><GuestTestimonials reviews={reviews} /></div>
      <div className="vc-defer [contain-intrinsic-size:auto_1018px] lg:[contain-intrinsic-size:auto_613px]"><LiveTrackingTeaser /></div>
      <div className="vc-defer [contain-intrinsic-size:auto_215px] lg:[contain-intrinsic-size:auto_192px]"><TrustBar /></div>
    </div>
    </>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  cachePublicData();
  // The Google site verification tag sits on the home page only (approved in the SEO portal).
  const [metadata, config] = await Promise.all([withSeo("/", baseMetadata), getSiteConfig()]);
  return config?.verification ? { ...metadata, verification: { google: config.verification } } : metadata;
}
