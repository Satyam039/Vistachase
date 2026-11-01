import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Settings & Profile | Vista Chase Affiliate Portal",
  description: "Manage your business details, contact information, and payout preferences.",
  robots: { index: false, follow: false },
};

export default function AffiliateSettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
