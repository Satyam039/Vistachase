// Pages a partner can send guests to with their referral code (affiliate portal → Referrals and
// Products). Every entry is a real public page address; the partner link is that address plus
// ?ref=<code>, which the site stores for 30 days (src/middleware.ts) and keeps in the address bar
// while the guest browses (ReferralLinkKeeper).
//
// Banff activity tickets are left out: they are booked on the operator's own site, so a referral
// can't be credited (and the tickets page is hidden from guests for now). /guides is left out too:
// it redirects to /blog.

import { docTitleAndSummary } from "@/lib/tourContent";
import { TWO_DAY_PACKAGE } from "@/lib/sharedTours";
import { PRIVATE_PACKAGES } from "@/lib/privateTours";

export interface ReferralPage {
  path: string;
  title: string;
  image?: string | null;
}

export interface ReferralGroup {
  id: string;
  title: string;
  pages: ReferralPage[];
}

export interface ReferralTour {
  slug: string;
  title: string;
  category: string;
  featuredImage?: string | null;
}

export interface ReferralDestination {
  slug: string;
  name: string;
}

export interface ReferralPost {
  path: string;
  label: string;
}

/** Multi-day packages that have their own pages (not catalog rows). */
export const PACKAGE_PAGES: ReferralPage[] = [
  { path: TWO_DAY_PACKAGE.href, title: TWO_DAY_PACKAGE.title, image: TWO_DAY_PACKAGE.images[0]?.src },
  { path: "/two-day-rockies-explorer/private", title: PRIVATE_PACKAGES.two.title, image: "/media/photos/moraine-lake-classic.webp" },
  { path: `/${PRIVATE_PACKAGES.three.slug}`, title: PRIVATE_PACKAGES.three.title, image: "/media/photos/athabasca-glacier.webp" },
  { path: `/${PRIVATE_PACKAGES.four.slug}`, title: PRIVATE_PACKAGES.four.title, image: "/media/photos/athabasca-glacier.webp" },
];

/** Collection pages: the home page and each service's landing page. */
export const COLLECTION_PAGES: ReferralPage[] = [
  { path: "/", title: "Home page" },
  { path: "/shared-tours", title: "All shared tours" },
  { path: "/private-tours", title: "All private tours" },
  { path: "/multi-day-tour-package-for-banff", title: "All multi-day tours" },
  { path: "/shuttles", title: "Moraine Lake & Lake Louise shuttles" },
  { path: "/search", title: "Search all tours" },
];

/** Other public pages worth linking to (guides, help and planning pages). */
export const INFO_PAGES: ReferralPage[] = [
  { path: "/destinations", title: "All destinations" },
  { path: "/blog", title: "Blog" },
  { path: "/about-us", title: "About us" },
  { path: "/faq", title: "FAQ" },
  { path: "/gallery", title: "Gallery" },
  { path: "/pickup-finder", title: "Pickup finder" },
  { path: "/contact-us", title: "Contact us" },
];

const TOUR_GROUPS: { id: string; title: string }[] = [
  { id: "SHARED", title: "Shared tours" },
  { id: "PRIVATE", title: "Private tours" },
  { id: "MULTIDAY", title: "Multi-day tours" },
  { id: "SHUTTLE", title: "Shuttles" },
];

/** Tour pages grouped by service, multi-day packages included; empty groups are left out. */
export function tourGroups(tours: ReferralTour[]): ReferralGroup[] {
  const by: Record<string, ReferralPage[]> = { SHARED: [], PRIVATE: [], MULTIDAY: [...PACKAGE_PAGES], SHUTTLE: [] };
  const seen = new Set(PACKAGE_PAGES.map((p) => p.path));
  for (const t of tours) {
    const path = `/${t.slug}`;
    if (!(t.category in by) || seen.has(path)) continue;
    seen.add(path);
    by[t.category].push({ path, title: docTitleAndSummary(t.slug)?.title ?? t.title, image: t.featuredImage });
  }
  return TOUR_GROUPS.map((g) => ({ ...g, pages: by[g.id] })).filter((g) => g.pages.length);
}

/** Every page a partner can link to, grouped, in the order the Referrals list shows them. */
export function referralGroups(tours: ReferralTour[], destinations: ReferralDestination[], posts: ReferralPost[]): ReferralGroup[] {
  const groups: ReferralGroup[] = [
    { id: "PAGES", title: "Collection pages", pages: COLLECTION_PAGES },
    ...tourGroups(tours),
    { id: "DESTINATIONS", title: "Destinations", pages: destinations.map((d) => ({ path: `/destinations/${d.slug}`, title: d.name })) },
    { id: "INFO", title: "Guides & info", pages: INFO_PAGES },
    {
      id: "BLOG",
      title: "Blog posts",
      pages: posts.filter((p) => p.path.startsWith("/blog-post/")).map((p) => ({ path: p.path, title: p.label })),
    },
  ];
  return groups.filter((g) => g.pages.length);
}

/** The partner link for a page: the page's address on this site plus ?ref=<code>. */
export function referralLink(origin: string, path: string, code: string): string {
  const url = new URL(path || "/", origin);
  url.searchParams.set("ref", code);
  return url.toString();
}
