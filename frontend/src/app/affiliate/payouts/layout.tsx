import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payout History | Vista Chase Affiliate Portal",
  description: "Disbursement history and payment transfer references.",
  robots: { index: false, follow: false },
};

export default function AffiliatePayoutsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
