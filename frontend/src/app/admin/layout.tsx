import type { Metadata } from "next";

// The page is a client component, so its title and description are set here (WCAG 2.4.2).
export const metadata: Metadata = {
  title: "Admin Dashboard | Vista Chase",
  description: "Vista Chase operations dashboard.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
