import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Registration & Application | Vista Chase Affiliate Portal",
  description: "Apply to the Vista Chase partner program to earn commissions on Banff tours and shuttles.",
  alternates: { canonical: "/affiliate/register" },
  // Sign-in forms stay out of the index, but their links are followed (audit spreadsheet: Nofollow).
  robots: { index: false, follow: true },
};

export default function AffiliateRegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
