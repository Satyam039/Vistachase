// TouristTrip structured data for the multi-day package pages, like the tour pages have (fix
// recheck, 9 Nov 2026, N6: these pages had only the organisation block). Describes only what the
// page shows: its name, summary, photo and day-by-day plan. No price or rating is claimed here.

import { JsonLd, BreadcrumbJsonLd, type Crumb } from "@/components/seo/JsonLd";
import { siteOrigin } from "@/lib/seo/server";
import { TOUR_PROVIDER } from "@/lib/seo/business";

export function PackageTripJsonLd({
  path,
  name,
  description,
  image,
  days,
  touristType,
  crumbs,
}: {
  path: string;
  name: string;
  description: string;
  image: string;
  days: string[];
  touristType: string;
  crumbs: Crumb[];
}) {
  const origin = siteOrigin();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name,
          description,
          url: `${origin}${path}`,
          image: image.startsWith("/") ? `${origin}${image}` : image,
          touristType,
          provider: TOUR_PROVIDER,
          itinerary: {
            "@type": "ItemList",
            numberOfItems: days.length,
            itemListElement: days.map((day, i) => ({ "@type": "ListItem", position: i + 1, name: `Day ${i + 1}: ${day}` })),
          },
        }}
      />
      <BreadcrumbJsonLd origin={origin} items={crumbs} />
    </>
  );
}

/** ItemList of the package pages, for the multi-day landing page. */
export function PackageListJsonLd({ items }: { items: { name: string; path: string }[] }) {
  const origin = siteOrigin();
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, url: `${origin}${item.path}` })),
      }}
    />
  );
}
