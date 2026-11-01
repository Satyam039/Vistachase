import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Dashboard | Vista Chase",
  description: "Overview of your referred bookings, earnings, and partner metrics.",
  robots: { index: false, follow: false },
};

export default function AffiliateDashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
