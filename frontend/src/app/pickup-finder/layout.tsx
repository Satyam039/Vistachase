import type { Metadata } from "next";
import { withSeo } from "@/lib/seo/server";

// The page is a client component, so its title and description are set here (WCAG 2.4.2).
const baseMetadata: Metadata = {
  // Without this the page inherits the root layout's canonical ("/") and asks search engines to index the home page instead.
  alternates: { canonical: "/pickup-finder" },
  title: "Hotel Pickup Finder | Vista Chase",
  description: "Find your Vista Chase pickup point and time for hotels in Banff, Canmore and Lake Louise.",
};

export default function PickupFinderLayout({ children }: { children: React.ReactNode }) {
  return children;
}

export function generateMetadata(): Promise<Metadata> {
  return withSeo("/pickup-finder", baseMetadata);
}
