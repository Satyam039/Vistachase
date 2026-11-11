// The business's own details for structured data, in one place. The site-wide organisation block
// (app/layout.tsx) and the "provider" of every tour and package (TouristTrip) use them, so each
// TouristInformationCenter on a page carries the address Google requires for a LocalBusiness.
// Site audit, 10 Nov 2026: "Invalid structured data: Local Business, address is required".

export const ORGANIZATION_ID = "https://www.vistachase.com/#organization";

export const BUSINESS_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "121 Bow Meadows Crescent #110",
  addressLocality: "Canmore",
  addressRegion: "AB",
  postalCode: "T1W 2W8",
  addressCountry: "CA",
} as const;

export const BUSINESS_TELEPHONE = "+1-825-734-9456";

/** The tour operator as a TouristTrip's provider: the same business as the site-wide block. */
export const TOUR_PROVIDER = {
  "@type": "TouristInformationCenter",
  // No @id: defining the organisation's @id twice on a page reads as a duplicate in audits.
  name: "Vista Chase",
  url: "https://www.vistachase.com",
  telephone: BUSINESS_TELEPHONE,
  address: BUSINESS_ADDRESS,
} as const;

/**
 * The share picture for a page that has none of its own. Next.js replaces the root layout's
 * openGraph as a whole when a page sets one, so a page's own og:title used to drop this image
 * (fix recheck, 10 Nov 2026, R4: 8 pages had no og:image).
 */
export const DEFAULT_SHARE_IMAGE = {
  url: "/media/photos/moraine-lake-perfect-reflection.webp",
  width: 1200,
  height: 630,
  alt: "Moraine Lake Valley of the Ten Peaks",
};
