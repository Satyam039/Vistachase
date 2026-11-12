import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Promo codes | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminPromoCodesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
