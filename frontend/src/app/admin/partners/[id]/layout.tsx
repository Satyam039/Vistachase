import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminPartnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
