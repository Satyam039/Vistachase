import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminSecurityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
