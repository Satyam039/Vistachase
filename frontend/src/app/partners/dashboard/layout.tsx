import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Dashboard | Vista Chase",
  robots: { index: false, follow: false },
};

export default function PartnerDashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
