import type { Metadata } from "next";
import { ANNOUNCE_SCRIPT } from "@/lib/announcement";
// CSS order matters: layer order first, fonts, then Astryx reset + components, the Stone theme, then Tailwind.
import "./layers.css";
import "./fonts.css";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@/themes/vistachase/vistachase.css";
import "./globals.css";
import Script from "next/script";
import { AstryxThemeProvider } from "@/components/providers/AstryxThemeProvider";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { TrackingTags } from "@/components/seo/TrackingTags";
import { getSiteConfig } from "@/lib/seo/server";

export const metadata: Metadata = {
  title: "Vista Chase | Luxury Private Tours & Shuttles in Banff & Rockies",
  description:
    "Banff's premier tour operator. TripAdvisor #6 Best Experience in Canada. Guaranteed shuttles to Moraine Lake & Lake Louise, luxury private SUV tours & multi-day packages.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.vistachase.com"),
  // Browser icons: the gold horse emblem, served by the backend (backend/media/brand).
  icons: {
    icon: [
      { url: "/media/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/media/brand/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/media/brand/apple-touch-icon.png",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Vista Chase | Banff & Canadian Rockies Tours & Shuttles",
    description: "Guaranteed access to Moraine Lake & Lake Louise, luxury private tours, and Canadian Rockies adventures.",
    url: "https://www.vistachase.com",
    siteName: "Vista Chase",
    type: "website",
    images: [
      {
        url: "/media/photos/moraine-lake-perfect-reflection.webp",
        width: 1200,
        height: 630,
        alt: "Moraine Lake Valley of the Ten Peaks",
      },
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TouristInformationCenter",
  "@id": "https://www.vistachase.com/#organization",
  "name": "Vista Chase",
  "description": "Explore Banff, Moraine Lake & Lake Louise with Vista Chase. Luxury private tours, small groups & guaranteed shuttles.",
  "url": "https://www.vistachase.com",
  "telephone": "+1-825-734-9456",
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "121 Bow Meadows Crescent #110",
    "addressLocality": "Canmore",
    "addressRegion": "AB",
    "postalCode": "T1W 2W8",
    "addressCountry": "CA",
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 51.0858,
    "longitude": -115.3484,
  },
  "areaServed": [
    "Banff National Park",
    "Lake Louise",
    "Moraine Lake",
    "Canmore",
    "Yoho National Park",
    "Icefields Parkway",
    "Jasper National Park",
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "5.0",
    "reviewCount": "742",
  },
};

/**
 * Site-wide JSON-LD: the coded organisation block above, unless an admin published a replacement
 * with the same @id in the SEO portal; other published site-wide blocks are added after it.
 */
function siteSchema(published: Record<string, unknown>[]) {
  const replacesOrg = published.some((b) => b["@id"] === jsonLd["@id"]);
  return [...(replacesOrg ? [] : [jsonLd]), ...published];
}

const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await getSiteConfig();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before paint: keep a closed announcement closed on reload (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: ANNOUNCE_SCRIPT }} />
        {/* Before paint: mark hero pages so transparent header renders without flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=window.location.pathname;if(p==='/'||p==='/shared-tours'||p==='/private-tours'||p==='/shuttles'||p==='/multi-day-tour-package-for-banff'){document.documentElement.setAttribute('data-hero-page','true');}}catch(e){}})();`,
          }}
        />
        {siteSchema(config?.siteSchema ?? []).map((block, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(block) }} />
        ))}
      </head>
      <body suppressHydrationWarning className="font-sans min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AstryxThemeProvider>
          <SiteFrame>{children}</SiteFrame>
        </AstryxThemeProvider>
        <TrackingTags tracking={config?.tracking ?? null} />
      </body>
    </html>
  );
}
