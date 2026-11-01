import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vista Chase Affiliate Portal",
  description: "Dedicated partner portal for referrals, commissions and payouts.",
};

export default function AffiliateRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
