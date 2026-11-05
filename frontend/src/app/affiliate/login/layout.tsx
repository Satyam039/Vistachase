import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Portal Sign In | Vista Chase",
  description: "Sign in to your Vista Chase partner and affiliate dashboard.",
  alternates: { canonical: "/affiliate/login" },
  robots: { index: false, follow: false },
};

export default function AffiliateLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
