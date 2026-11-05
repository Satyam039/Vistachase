import type { Metadata } from "next";

// The partner portal is a signed-in tool. The public page for the programme is /partners, so the
// portal stays out of search (it used to compete with /partners and inherited the homepage canonical).
export const metadata: Metadata = {
  title: "Vista Chase Affiliate Portal",
  description: "Dedicated partner portal for referrals, commissions and payouts.",
  robots: { index: false, follow: true },
};

export default function AffiliateRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
