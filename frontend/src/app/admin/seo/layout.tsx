import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SEO | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminSeoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
