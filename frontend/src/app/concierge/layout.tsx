import type { Metadata } from "next";
import { withSeo } from "@/lib/seo/server";

// The page is a client component, so its title and description are set here (WCAG 2.4.2).
const baseMetadata: Metadata = {
  // Without this the page inherits the root layout's canonical ("/") and asks search engines to index the home page instead.
  alternates: { canonical: "/concierge" },
  title: "AI Travel Concierge | Vista Chase",
  description: "Plan your Canadian Rockies trip with the Vista Chase AI concierge: tours, shuttles, pickups and seat holds.",
};

export default function ConciergeLayout({ children }: { children: React.ReactNode }) {
  return children;
}

export function generateMetadata(): Promise<Metadata> {
  return withSeo("/concierge", baseMetadata);
}
