import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Registration & Application | Vista Chase Affiliate Portal",
  description: "Apply to the Vista Chase partner program to earn commissions on Banff tours and shuttles.",
  robots: { index: false, follow: false },
};

export default function AffiliateRegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
