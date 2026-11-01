import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Performance Reports | Vista Chase Affiliate Portal",
  description: "Click analytics, conversion rates, and revenue performance.",
  robots: { index: false, follow: false },
};

export default function AffiliateReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
