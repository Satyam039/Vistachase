import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Commission Statement | Vista Chase Affiliate Portal",
  description: "Detailed ledger of earned commissions and pending disbursements.",
  robots: { index: false, follow: false },
};

export default function AffiliateCommissionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
