import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Content | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminContentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
