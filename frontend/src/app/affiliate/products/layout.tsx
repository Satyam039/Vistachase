import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Products & Your Links | Vista Chase Affiliate Portal",
  description: "Your own referral link for every Vista Chase tour, shuttle and multi-day package.",
  robots: { index: false, follow: false },
};

export default function AffiliateProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
