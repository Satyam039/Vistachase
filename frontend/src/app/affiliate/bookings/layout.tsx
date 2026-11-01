import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Referred Bookings | Vista Chase Affiliate Portal",
  description: "Track all bookings attributed to your partner referral code.",
  robots: { index: false, follow: false },
};

export default function AffiliateBookingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
