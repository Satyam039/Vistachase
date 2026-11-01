import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Referral Links & Tools | Vista Chase Affiliate Portal",
  description: "Generate customized tracking links for Banff tours and experiences.",
  robots: { index: false, follow: false },
};

export default function AffiliateReferralsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
