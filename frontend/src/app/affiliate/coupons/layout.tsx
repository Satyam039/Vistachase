import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coupons | Vista Chase Affiliate Portal",
  description: "Create coupon codes for your guests.",
  robots: { index: false, follow: false },
};

export default function AffiliateCouponsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
