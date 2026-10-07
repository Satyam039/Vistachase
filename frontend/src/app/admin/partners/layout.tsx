import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partners | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminPartnersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
