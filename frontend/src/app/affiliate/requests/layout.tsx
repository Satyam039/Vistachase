import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Change requests | Vista Chase Affiliate Portal",
  description: "Ask the Vista Chase team for any change to your partner account.",
  robots: { index: false, follow: false },
};

export default function AffiliateRequestsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
