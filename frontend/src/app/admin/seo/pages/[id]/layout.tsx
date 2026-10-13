import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit page SEO | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminSeoPageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
