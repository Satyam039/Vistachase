import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Portal Sign In | Vista Chase",
  description: "Sign in to your Vista Chase partner and affiliate dashboard.",
  alternates: { canonical: "/affiliate/login" },
  // Sign-in forms stay out of the index, but their links are followed (audit spreadsheet: Nofollow).
  robots: { index: false, follow: true },
};

export default function AffiliateLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
